"use server";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";

const normalizeStatus = (status?: string | null) => {
  if (!status || status === "Placed") return "Pending";
  return status;
};

const formatStatusFilter = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const buildPipeline = (vendorId: mongoose.Types.ObjectId, statusFilter?: string | null) => {
  const pipeline: mongoose.PipelineStage[] = [
    {
      $match: {
        status: { $ne: "Pending" },
      },
    },
    {
      $addFields: {
        productLineCount: {
          $size: {
            $filter: {
              input: "$items",
              as: "line",
              cond: { $eq: ["$$line.itemType", "Product"] },
            },
          },
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "buyer",
      },
    },
    {
      $unwind: {
        path: "$buyer",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $unwind: "$items" },
    { $match: { "items.itemType": "Product" } },
    {
      $lookup: {
        from: "products",
        localField: "items.itemId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $match: {
        "product.sellerId": vendorId,
      },
    },
    {
      $addFields: {
        isRentalItem: {
          $eq: ["$product.listingType", "rent"],
        },
        rentalDays: {
          $ifNull: ["$items.rentalDays", 1],
        },
        unitPrice: {
          $cond: [
            { $eq: ["$product.listingType", "rent"] },
            {
              $ifNull: [
                "$product.rentPriceDay",
                {
                  $ifNull: [
                    "$items.variant.price",
                    { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
                  ],
                },
              ],
            },
            {
              $ifNull: [
                "$items.variant.price",
                { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        soldAmount: {
          $multiply: [
            "$unitPrice",
            "$items.quantity",
            {
              $cond: ["$isRentalItem", "$rentalDays", 1],
            },
          ],
        },
      },
    },
  ];

  if (statusFilter) {
    pipeline.push({
      $match: {
        $or: [
          { "items.status": statusFilter },
          { status: statusFilter },
        ],
      },
    });
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  return pipeline;
};

const mapRow = (row: any) => {
  const productImage =
    row?.items?.variant?.photos?.[0] ||
    row?.product?.images?.[0] ||
    row?.product?.photos?.[0] ||
    null;

  const listingType = row?.product?.listingType ?? "buy";
  const quantity = Number(row?.items?.quantity ?? 0);
  const safeQuantity = quantity > 0 ? quantity : 1;
  const unitPrice = Number(row?.unitPrice ?? 0);
  const rentalStartDate = row?.items?.rentalStartDate ?? row?.product?.rentalStartDate ?? null;
  const rentalEndDate = row?.items?.rentalEndDate ?? row?.product?.rentalEndDate ?? null;
  const explicitRentalDays = Number(row?.items?.rentalDays ?? 0);

  let computedRentalDays = 0;
  if (rentalStartDate && rentalEndDate) {
    const start = new Date(rentalStartDate);
    const end = new Date(rentalEndDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      computedRentalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const rentalDays = listingType === "rent" ? (explicitRentalDays > 0 ? explicitRentalDays : computedRentalDays || 1) : null;
  const inferredRentalDaysFromTotal =
    listingType === "rent" &&
    Number(row?.productLineCount ?? 0) === 1 &&
    Number(row?.totalAmount ?? 0) > 0 &&
    unitPrice > 0
      ? Math.max(1, Math.round(Number(row.totalAmount) / (unitPrice * safeQuantity)))
      : 0;
  const effectiveRentalDays =
    listingType === "rent"
      ? explicitRentalDays > 0
        ? explicitRentalDays
        : computedRentalDays > 0
          ? computedRentalDays
          : inferredRentalDaysFromTotal > 0
            ? inferredRentalDaysFromTotal
            : 1
      : 0;
  const soldAmount =
    listingType === "rent"
      ? unitPrice * safeQuantity * Number(effectiveRentalDays || 1)
      : unitPrice * safeQuantity;

  return {
    orderId: row?._id?.toString(),
    itemId: row?.items?.itemId?.toString(),
    variantId: row?.items?.variantId?.toString() ?? null,
    productName: row?.product?.name ?? "Unknown product",
    listingType,
    productImage,
    quantity: row?.items?.quantity ?? 0,
    unitPrice,
    soldAmount,
    rentalStartDate,
    rentalEndDate,
    rentalDays: listingType === "rent" ? effectiveRentalDays : null,
    buyerName: row?.address?.name ?? row?.buyer?.fullName ?? "Unknown",
    buyerEmail: row?.buyer?.email ?? null,
    buyerPhone: row?.address?.phone ?? row?.buyer?.contactNumber ?? null,
    buyerAddress: {
      line1: row?.address?.address ?? "",
      city: row?.address?.city ?? "",
      state: row?.address?.state ?? "",
      pincode: row?.address?.pincode ?? "",
    },
    deliveryDate: row?.items?.deliveryDate ?? null,
    status: normalizeStatus(row?.items?.status ?? row?.status),
    orderStatus: normalizeStatus(row?.status),
    orderCreatedAt: row?.createdAt ?? null,
    cancellationReason: row?.cancellationReason ?? null,
    cancelledAt: row?.cancelledAt ?? null,
    cancelledByRole: row?.cancelledByRole ?? null,
    cancellationBreakdown: row?.cancellationBreakdown ?? null,
  };
};

export const GET = auth(async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    if (user.accountType !== "vendor") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    const vendorId = new mongoose.Types.ObjectId(user.id || user._id);
    const { searchParams } = new URL(req.url);
    const statusFilter = formatStatusFilter(searchParams.get("status"));

    const productRows = await Order.aggregate(buildPipeline(vendorId, statusFilter));

    const rows = productRows.map(mapRow).sort((a: any, b: any) => {
      const ad = a?.orderCreatedAt ? new Date(a.orderCreatedAt).getTime() : 0;
      const bd = b?.orderCreatedAt ? new Date(b.orderCreatedAt).getTime() : 0;
      return bd - ad;
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Vendor orders fetch failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load vendor orders" }, { status: 500 });
  }
});


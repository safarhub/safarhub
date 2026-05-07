"use server";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";
import UserRequirement from "@/models/Userrequirement";

const formatStatusFilter = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const buildPipeline = (scope: "admin" | "vendor", statusFilter?: string | null) => {
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
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "product.sellerId",
        foreignField: "_id",
        as: "vendor",
      },
    },
    {
      $unwind: {
        path: "$vendor",
        preserveNullAndEmptyArrays: true,
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
                    {
                      $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }],
                    },
                  ],
                },
              ],
            },
            {
              $ifNull: [
                "$items.variant.price",
                {
                  $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }],
                },
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

  if (scope === "admin") {
    pipeline.push({
      $match: {
        $or: [{ "product.sellerId": { $exists: false } }, { "product.sellerId": null }],
      },
    });
  } else {
    pipeline.push({
      $match: {
        "product.sellerId": { $type: "objectId" },
      },
    });
  }

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

const normalizeStatus = (status?: string | null) => {
  if (!status || status === "Placed") return "Pending";
  return status;
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
  const sellerUnitPrice =
    listingType === "rent"
      ? Number(row?.product?.sellerRentPriceDay ?? unitPrice)
      : Number(row?.product?.sellerBasePrice ?? unitPrice);
  const vendorPayableAmount =
    listingType === "rent"
      ? sellerUnitPrice * safeQuantity * Number(effectiveRentalDays || 1)
      : sellerUnitPrice * safeQuantity;
  const platformCommissionAmount = Math.max(soldAmount - vendorPayableAmount, 0);

  return {
    orderId: row?._id?.toString(),
    buyerId: row?.user?.toString?.() ?? null,
    productId: row?.items?.itemId?.toString?.() ?? row?.product?._id?.toString?.(),
    itemId: row?.items?.itemId?.toString(),
    variantId: row?.items?.variantId?.toString() ?? null,
    productName: row?.product?.name ?? "Unknown product",
    listingType,
    productImage,
    quantity: row?.items?.quantity ?? 0,
    unitPrice,
    soldAmount,
    sellerUnitPrice,
    vendorPayableAmount,
    platformCommissionAmount,
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
    vendorName: row?.vendor?.fullName ?? null,
    vendorEmail: row?.vendor?.email ?? null,
    vendorPhone: row?.vendor?.contactNumber ?? null,
    vendorId: row?.vendor?._id?.toString() ?? null,
    cancellationReason: row?.cancellationReason ?? null,
    cancelledAt: row?.cancelledAt ?? null,
    cancelledByRole: row?.cancelledByRole ?? null,
    cancellationBreakdown: row?.cancellationBreakdown ?? null,
  };
};

const mapRequirementOrderRow = (order: any) => {
  const requirementItem = Array.isArray(order?.items)
    ? order.items.find((item: any) => item?.itemType === "Requirement")
    : null;

  const negotiatedAmount = Number(order?.requirementDeal?.confirmedPrice ?? order?.totalAmount ?? 0);
  const totalPayable = Number(order?.requirementDeal?.totalPayable ?? order?.totalAmount ?? negotiatedAmount);
  const explicitCommissionAmount = Number(order?.requirementDeal?.commissionAmount ?? 0);
  const commissionAmount =
    Number.isFinite(explicitCommissionAmount) && explicitCommissionAmount > 0
      ? explicitCommissionAmount
      : Math.max(totalPayable - negotiatedAmount, 0);
  const buyer = order?.user;
  const vendor = order?.requirementDeal?.vendorId;
  const requirement = order?.requirementDeal?.requirementId;

  return {
    orderId: order?._id?.toString(),
    buyerId: buyer?._id?.toString?.() ?? order?.user?.toString?.() ?? null,
    productId: requirement?._id?.toString?.() ?? requirementItem?.itemId?.toString?.() ?? null,
    itemId: requirementItem?.itemId?.toString?.() ?? requirement?._id?.toString?.(),
    itemType: "Requirement",
    variantId: null,
    productName: requirement?.title ?? "Requirement",
    productImage: null,
    quantity: 1,
    unitPrice: totalPayable,
    soldAmount: totalPayable,
    sellerUnitPrice: negotiatedAmount,
    vendorPayableAmount: negotiatedAmount,
    platformCommissionAmount: commissionAmount,
    buyerName: order?.address?.name ?? buyer?.fullName ?? "Unknown",
    buyerEmail: buyer?.email ?? null,
    buyerPhone: order?.address?.phone ?? buyer?.contactNumber ?? null,
    buyerAddress: {
      line1: order?.address?.address ?? "",
      city: order?.address?.city ?? "",
      state: order?.address?.state ?? "",
      pincode: order?.address?.pincode ?? "",
    },
    deliveryDate: null,
    status: normalizeStatus(requirementItem?.status ?? order?.status),
    orderStatus: normalizeStatus(order?.status),
    orderCreatedAt: order?.createdAt ?? null,
    vendorName: vendor?.fullName ?? "Vendor",
    vendorEmail: vendor?.email ?? null,
    vendorPhone: vendor?.contactNumber ?? null,
    vendorId: vendor?._id?.toString?.() ?? null,
    cancellationReason: order?.cancellationReason ?? null,
    cancelledAt: order?.cancelledAt ?? null,
    cancelledByRole: order?.cancelledByRole ?? null,
    cancellationBreakdown: order?.cancellationBreakdown ?? null,
    requirementCheckIn: requirement?.checkIn ?? null,
    requirementCheckOut: requirement?.checkOut ?? null,
    requirementGuests: requirement?.numberOfGuests ?? null,
    requirementDays:
      requirement?.checkIn && requirement?.checkOut
        ? Math.ceil(
            (new Date(requirement.checkOut).getTime() - new Date(requirement.checkIn).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
  };
};

export const GET = auth(async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    if (user.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const scopeParam = searchParams.get("scope") === "vendor" ? "vendor" : "admin";
    const statusFilter = formatStatusFilter(searchParams.get("status"));
    const itemTypeFilter = searchParams.get("itemType")?.toLowerCase() || "";

    const [productRows, requirementOrders] = await Promise.all([
      Order.aggregate(buildPipeline(scopeParam, statusFilter)),
      scopeParam === "vendor"
        ? Order.find({
            orderContext: "requirement_deal",
            ...(statusFilter
              ? {
                  $or: [{ status: statusFilter }, { "items.status": statusFilter }],
                }
              : {}),
          })
            .populate("user", "fullName email contactNumber")
            .populate("requirementDeal.vendorId", "fullName email contactNumber")
            .populate({
              path: "requirementDeal.requirementId",
              model: UserRequirement,
              select: "title checkIn checkOut numberOfGuests",
            })
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve([]),
    ]);

    const rows = [
      ...productRows.map(mapRow),
      ...requirementOrders.map((order: any) => mapRequirementOrderRow(order)),
    ]
      .filter((row: any) => {
        if (itemTypeFilter === "requirement") return (row?.itemType || "").toLowerCase() === "requirement";
        if (itemTypeFilter === "product") return (row?.itemType || "product").toLowerCase() === "product";
        return true;
      })
      .sort((a: any, b: any) => {
      const ad = a?.orderCreatedAt ? new Date(a.orderCreatedAt).getTime() : 0;
      const bd = b?.orderCreatedAt ? new Date(b.orderCreatedAt).getTime() : 0;
      return bd - ad;
    });

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error("Admin orders fetch failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load orders" }, { status: 500 });
  }
});


"use server";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";
import Product from "@/models/Product";

const DAY_MS = 1000 * 60 * 60 * 24;

const parseDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ceilDaysDiff = (start: Date, end: Date) => {
  if (end.getTime() <= start.getTime()) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
};

const addDays = (base: Date, days: number) => {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

type BackfillBody = {
  dryRun?: boolean;
  limit?: number;
};

export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    if (user?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as BackfillBody;
    const dryRun = Boolean(body?.dryRun ?? false);
    const limit = Math.max(1, Math.min(Number(body?.limit ?? 5000), 20000));

    const orders = await Order.find({
      "items.itemType": "Product",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("items totalAmount")
      .lean();

    const productIds = new Set<string>();
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item?.itemType === "Product" && item?.itemId) {
          productIds.add(String(item.itemId));
        }
      }
    }

    const products = await Product.find({ _id: { $in: Array.from(productIds) } })
      .select("_id listingType rentPriceDay price basePrice rentalStartDate rentalEndDate")
      .lean();

    const productMap = new Map(products.map((product: any) => [String(product._id), product]));

    let scannedOrders = 0;
    let touchedOrders = 0;
    let touchedItems = 0;
    const updates: Array<{ orderId: string; changedItems: number }> = [];

    for (const order of orders as any[]) {
      scannedOrders += 1;
      let orderChangedItems = 0;

      const productLineCount = (order.items || []).filter((line: any) => line?.itemType === "Product").length;

      const nextItems = (order.items || []).map((item: any) => {
        if (item?.itemType !== "Product") return item;

        const product = productMap.get(String(item.itemId));
        const itemStart = parseDateSafe(item.rentalStartDate);
        const itemEnd = parseDateSafe(item.rentalEndDate);
        const itemDays = Number(item.rentalDays ?? 0);

        const productStart = parseDateSafe(product?.rentalStartDate);
        const productEnd = parseDateSafe(product?.rentalEndDate);
        const isLikelyRental =
          product?.listingType === "rent" ||
          itemDays > 0 ||
          Boolean(itemStart) ||
          Boolean(itemEnd);

        if (!isLikelyRental) return item;

        const quantity = Math.max(1, Number(item.quantity ?? 1));
        const unitPrice = Number(
          item?.variant?.price ??
            product?.rentPriceDay ??
            product?.price ??
            product?.basePrice ??
            0
        );

        let start = itemStart || productStart;
        let end = itemEnd || productEnd;

        let inferredDays = 0;
        if (productLineCount === 1 && unitPrice > 0) {
          inferredDays = Math.max(1, Math.round(Number(order.totalAmount ?? 0) / (unitPrice * quantity)));
        }

        let nextDays = itemDays > 0 ? itemDays : 0;
        if (!nextDays && start && end) {
          nextDays = ceilDaysDiff(start, end);
        }
        if (!nextDays && inferredDays > 0) {
          nextDays = inferredDays;
        }
        if (!nextDays) {
          nextDays = 1;
        }

        if (!start && end) {
          start = addDays(end, -nextDays);
        }
        if (!end && start) {
          end = addDays(start, nextDays);
        }

        const prevStartIso = itemStart ? itemStart.toISOString() : null;
        const prevEndIso = itemEnd ? itemEnd.toISOString() : null;
        const nextStartIso = start ? start.toISOString() : null;
        const nextEndIso = end ? end.toISOString() : null;

        const changed =
          itemDays !== nextDays ||
          prevStartIso !== nextStartIso ||
          prevEndIso !== nextEndIso;

        if (!changed) return item;

        orderChangedItems += 1;
        touchedItems += 1;

        return {
          ...item,
          rentalDays: nextDays,
          rentalStartDate: start,
          rentalEndDate: end,
        };
      });

      if (orderChangedItems > 0) {
        touchedOrders += 1;
        updates.push({ orderId: String(order._id), changedItems: orderChangedItems });

        if (!dryRun) {
          await Order.updateOne(
            { _id: new mongoose.Types.ObjectId(String(order._id)) },
            { $set: { items: nextItems } }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scannedOrders,
      touchedOrders,
      touchedItems,
      sample: updates.slice(0, 25),
      message: dryRun
        ? "Dry run completed. Re-run with { dryRun: false } to apply updates."
        : "Rental metadata backfill applied successfully.",
    });
  } catch (error: any) {
    console.error("Rental backfill failed:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to run rental backfill" },
      { status: 500 }
    );
  }
});

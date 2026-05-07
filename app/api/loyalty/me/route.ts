// app/api/loyalty/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Review from "@/models/Review";
import LoyaltyScore from "@/models/LoyaltyScore";
import Product from "@/models/Product";
import Order from "@/models/Order";
import {
  calculateUserScore,
  calculateVendorScore,
  resolveUserLevel,
  resolveVendorLevel,
  getLevelProgress,
  getNextLevel,
  shouldDemote,
  getPreviousLevel,
} from "@/lib/utils/loyaltyCalculator";

// Cast lean() result to access typed fields from the User schema
interface LeanUser {
  _id: mongoose.Types.ObjectId;
  accountType?: "user" | "vendor" | "admin";
  [key: string]: unknown;
}

const normalizeOrderStatus = (status?: string) => {
  if (!status) return "Pending";
  if (status === "Placed") return "Pending";
  return status;
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const userId = decoded.id || decoded._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const user = (await User.findById(userId).lean()) as LeanUser | null;
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const accountType: "user" | "vendor" = user.accountType === "vendor" ? "vendor" : "user";
    const now = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // VENDOR
    // ─────────────────────────────────────────────────────────────────────────
    if (accountType === "vendor") {
      const bookings = await Booking.find({ vendorId: userId }).lean();
      const completedBookings = bookings.filter((b) => b.status !== "cancelled");
      const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

      const vendorProducts = await Product.find({ sellerId: userId }).select("_id basePrice price rentPriceDay").lean();
      const vendorProductIds = vendorProducts.map((p: any) => p._id).filter(Boolean);
      const vendorProductPriceMap = new Map<string, number>(
        vendorProducts.map((p: any) => [
          p._id.toString(),
          Number(p.rentPriceDay ?? p.price ?? p.basePrice ?? 0),
        ])
      );

      let productOrderCount = 0;
      let productRevenue = 0;
      let productCancellations = 0;

      if (vendorProductIds.length > 0) {
        const vendorOrders = await Order.find({
          status: "Placed",
          items: {
            $elemMatch: {
              itemType: "Product",
              itemId: { $in: vendorProductIds },
            },
          },
        })
          .select("status items")
          .lean();

        vendorOrders.forEach((order: any) => {
          const orderStatus = normalizeOrderStatus(order?.status);
          const orderItems = Array.isArray(order?.items) ? order.items : [];

          orderItems.forEach((item: any) => {
            if (item?.itemType !== "Product") return;
            const itemId = item?.itemId?.toString?.();
            if (!itemId || !vendorProductPriceMap.has(itemId)) return;

            const lineStatus = normalizeOrderStatus(item?.status || orderStatus);
            if (lineStatus === "Cancelled") {
              productCancellations += 1;
              return;
            }

            const quantity = Math.max(1, Number(item?.quantity || 1));
            const fallbackPrice = vendorProductPriceMap.get(itemId) || 0;
            const isRentalItem =
              Number(item?.rentalDays || 0) > 0;
            const rentalDays = isRentalItem ? Math.max(1, Number(item?.rentalDays || 1)) : 1;
            const unitPrice = Number(item?.variant?.price ?? fallbackPrice);
            productRevenue += unitPrice * quantity * rentalDays;
            productOrderCount += 1;
          });
        });
      }

      const bookingRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalRevenue = bookingRevenue + productRevenue;
      const totalBookings = completedBookings.length + productOrderCount;
      const cancellations = cancelledBookings.length + productCancellations;

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyCancel = cancelledBookings.filter(
        (b) => b.cancelledAt && new Date(b.cancelledAt as Date) >= monthStart
      ).length;
      const repeatCancellations = monthlyCancel >= 3 ? Math.floor(monthlyCancel / 3) : 0;

      const vendorStayIds = completedBookings.map((b) => b.stayId).filter(Boolean);
      const vendorTourIds = completedBookings.map((b) => b.tourId).filter(Boolean);
      const vendorAdventureIds = completedBookings.map((b) => b.adventureId).filter(Boolean);
      const vendorVehicleIds = completedBookings.map((b) => b.vehicleRentalId).filter(Boolean);

      let avgRating = 0;
      const reviewFilters: any[] = [];
      if (vendorStayIds.length > 0) {
        reviewFilters.push({ targetType: "Stay", targetId: { $in: vendorStayIds } });
      }
      if (vendorTourIds.length > 0) {
        reviewFilters.push({ targetType: "Tour", targetId: { $in: vendorTourIds } });
      }
      if (vendorAdventureIds.length > 0) {
        reviewFilters.push({ targetType: "Adventure", targetId: { $in: vendorAdventureIds } });
      }
      if (vendorVehicleIds.length > 0) {
        reviewFilters.push({ targetType: "VehicleRental", targetId: { $in: vendorVehicleIds } });
      }
      if (vendorProductIds.length > 0) {
        reviewFilters.push({ targetType: "Product", targetId: { $in: vendorProductIds } });
      }

      if (reviewFilters.length > 0) {
        const reviews = await Review.find({
          status: "approved",
          $or: reviewFilters,
        }).lean();
        if (reviews.length > 0) {
          avgRating = reviews.reduce((sum, r) => sum + (r.rating as number), 0) / reviews.length;
        }
      }

      // const — existing doc is only read, never reassigned
      const existing = await LoyaltyScore.findOne({ userId });
      const policyViolations = existing?.metrics?.policyViolations ?? 0;
      const fakeReviewAttempts = existing?.metrics?.fakeReviewAttempts ?? 0;
      const noShows = existing?.metrics?.noShows ?? 0;

      const metrics = {
        totalBookings,
        totalRevenue,
        avgRating: parseFloat(avgRating.toFixed(2)),
        cancellations,
        policyViolations,
        noShows,
        repeatCancellations,
        fakeReviewAttempts,
        ratingsGiven: 0,
        promoActivity: 0,
      };

      const rawScore = calculateVendorScore({
        totalBookings,
        totalRevenue,
        avgRating,
        cancellations,
        policyViolations,
        noShows,
        repeatCancellations,
        fakeReviewAttempts,
      });

      const compositeScore = Math.max(0, rawScore);

      const levelData = resolveVendorLevel(compositeScore);
      const nextLevel = getNextLevel(compositeScore, "vendor");
      const progress = getLevelProgress(compositeScore, "vendor");

      // These ARE mutated inside the demotion block → let
      let demotionCount = existing?.demotionCount ?? 0;
      let demotionHistory = [...(existing?.demotionHistory ?? [])];
      let scoreBelowThresholdSince: Date | undefined = existing?.scoreBelowThresholdSince ?? undefined;
      let levelFrozen = existing?.levelFrozen ?? false;
      // isSuspended is never mutated → const
      const isSuspended = existing?.isSuspended ?? false;

      const currentLevelName = existing?.level ?? "Seedling";

      if (shouldDemote(currentLevelName, compositeScore, "vendor")) {
        if (!scoreBelowThresholdSince) {
          scoreBelowThresholdSince = now;
        } else {
          const daysBelowThreshold =
            (now.getTime() - scoreBelowThresholdSince.getTime()) / (1000 * 60 * 60 * 24);
          if (daysBelowThreshold >= 60) {
            const prevLevel = getPreviousLevel(currentLevelName, "vendor");
            demotionCount += 1;
            demotionHistory = [
              ...demotionHistory,
              {
                fromLevel: currentLevelName,
                toLevel: prevLevel.name,
                at: now,
                reason: "Score below threshold for 60 days",
              },
            ];
            scoreBelowThresholdSince = undefined;
            if (demotionCount >= 3) {
              levelFrozen = true;
            }
          }
        }
      } else {
        scoreBelowThresholdSince = undefined;
      }

      const loyaltyDoc = await LoyaltyScore.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            accountType: "vendor",
            level: levelData.name,
            compositeScore,
            metrics,
            demotionCount,
            demotionHistory,
            scoreBelowThresholdSince,
            levelFrozen,
            isSuspended,
            currentDiscount: 0,
            perks: levelData.perks,
            lastCalculated: now,
          },
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({
        success: true,
        loyalty: {
          accountType: "vendor",
          level: levelData,
          compositeScore,
          nextLevel,
          progress,
          metrics,
          penaltyHistory: loyaltyDoc.penaltyHistory?.slice(-5) ?? [],
          isSuspended,
          levelFrozen,
          demotionCount,
          demotionHistory: loyaltyDoc.demotionHistory?.slice(-3) ?? [],
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER
    // ─────────────────────────────────────────────────────────────────────────
    const bookings = await Booking.find({
      $or: [
        { customerId: userId },
        { "customer.email": (user as any).email },
        { "metadata.bookedByUserId": userId },
      ],
    }).lean();
    const completedBookings = bookings.filter((b) => b.status !== "cancelled");
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

    const userOrders = await Order.find({ user: userId, status: "Placed" })
      .select("status items")
      .lean();

    let userProductPurchases = 0;
    let userProductCancellations = 0;

    userOrders.forEach((order: any) => {
      const orderStatus = normalizeOrderStatus(order?.status);
      const orderItems = Array.isArray(order?.items) ? order.items : [];

      orderItems.forEach((item: any) => {
        if (item?.itemType !== "Product") return;
        const lineStatus = normalizeOrderStatus(item?.status || orderStatus);
        if (lineStatus === "Cancelled") {
          userProductCancellations += 1;
        } else {
          userProductPurchases += 1;
        }
      });
    });

    const totalBookings = completedBookings.length + userProductPurchases;
    const cancellations = cancelledBookings.length + userProductCancellations;
    const ratingsGiven = await Review.countDocuments({ userId, status: "approved" });

    // const — existing doc is only read, never reassigned
    const existing = await LoyaltyScore.findOne({ userId });
    const policyViolations = existing?.metrics?.policyViolations ?? 0;
    const promoActivity = existing?.metrics?.promoActivity ?? 0;
    const noShows = existing?.metrics?.noShows ?? 0;
    const avgRating = existing?.metrics?.avgRating ?? 5;
    const ratingDroppedBelow3 = avgRating < 3;

    const metrics = {
      totalBookings,
      ratingsGiven,
      promoActivity,
      policyViolations,
      cancellations,
      noShows,
      avgRating,
      totalRevenue: 0,
      fakeReviewAttempts: 0,
      repeatCancellations: 0,
    };

    const rawScore = calculateUserScore({
      totalBookings,
      ratingsGiven,
      promoActivity,
      policyViolations,
      cancellations,
      noShows,
      ratingDroppedBelow3,
    });

    const compositeScore = Math.max(0, rawScore);

    const levelData = resolveUserLevel(compositeScore);
    const nextLevel = getNextLevel(compositeScore, "user");
    const progress = getLevelProgress(compositeScore, "user");
    const invoiceThreshold = 4000;
    const currentDiscount = levelData.discount;

    // These ARE mutated inside the demotion block → let
    let demotionCount = existing?.demotionCount ?? 0;
    let demotionHistory = [...(existing?.demotionHistory ?? [])];
    let scoreBelowThresholdSince: Date | undefined = existing?.scoreBelowThresholdSince ?? undefined;
    let levelFrozen = existing?.levelFrozen ?? false;
    // isSuspended is never mutated → const
    const isSuspended = existing?.isSuspended ?? false;

    const currentLevelName = existing?.level ?? "Scout";

    if (shouldDemote(currentLevelName, compositeScore, "user")) {
      if (!scoreBelowThresholdSince) {
        scoreBelowThresholdSince = now;
      } else {
        const daysBelowThreshold =
          (now.getTime() - scoreBelowThresholdSince.getTime()) / (1000 * 60 * 60 * 24);
        if (daysBelowThreshold >= 60) {
          const prevLevel = getPreviousLevel(currentLevelName, "user");
          demotionCount += 1;
          demotionHistory = [
            ...demotionHistory,
            {
              fromLevel: currentLevelName,
              toLevel: prevLevel.name,
              at: now,
              reason: "Score below threshold for 60 days",
            },
          ];
          scoreBelowThresholdSince = undefined;
          if (demotionCount >= 3) {
            levelFrozen = true;
          }
        }
      }
    } else {
      scoreBelowThresholdSince = undefined;
    }

    const loyaltyDoc = await LoyaltyScore.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          accountType: "user",
          level: levelData.name,
          compositeScore,
          metrics,
          demotionCount,
          demotionHistory,
          scoreBelowThresholdSince,
          levelFrozen,
          isSuspended,
          currentDiscount,
          perks: levelData.perks,
          lastCalculated: now,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      loyalty: {
        accountType: "user",
        level: levelData,
        compositeScore,
        nextLevel,
        progress,
        metrics,
        penaltyHistory: loyaltyDoc.penaltyHistory?.slice(-5) ?? [],
        currentDiscount,
        invoiceThreshold,
        isSuspended,
        levelFrozen,
        demotionCount,
        demotionHistory: loyaltyDoc.demotionHistory?.slice(-3) ?? [],
      },
    });
  } catch (err) {
    console.error("Loyalty/me error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
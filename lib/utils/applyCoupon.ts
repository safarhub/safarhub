// lib/utils/applyCoupon.ts
// Drop-in helper for the booking route — replaces the repeated coupon logic in each service type.
// Checks personalized coupon ownership and marks it as used after a successful booking.

import mongoose from "mongoose";
import Coupon, { ICoupon } from "@/models/Coupon";

interface ApplyCouponOptions {
  couponCode?: string;
  subtotalForCoupon: number;
  customerEmail: string;
  customerId?: string | null;
}

interface ApplyCouponResult {
  appliedCoupon: (ICoupon & { _id: mongoose.Types.ObjectId }) | null;
  discountAmount: number;
}

export async function applyCoupon({
  couponCode,
  subtotalForCoupon,
  customerEmail,
  customerId,
}: ApplyCouponOptions): Promise<ApplyCouponResult> {
  if (!couponCode) return { appliedCoupon: null, discountAmount: 0 };

  const coupon = await Coupon.findOne({
    code: couponCode.toUpperCase(),
    isActive: true,
  });

  if (!coupon) return { appliedCoupon: null, discountAmount: 0 };

  const now = new Date();

  // Basic validity
  if (coupon.startDate > now || coupon.expiryDate < now) {
    return { appliedCoupon: null, discountAmount: 0 };
  }

  // ── Personalized coupon check ─────────────────────────────────────────────
  if (coupon.isPersonalized) {
    // Already used — hard reject
    if (coupon.isUsed) return { appliedCoupon: null, discountAmount: 0 };

    // Must match customer email
    if (
      !coupon.assignedToEmail ||
      coupon.assignedToEmail.toLowerCase() !== customerEmail.toLowerCase()
    ) {
      return { appliedCoupon: null, discountAmount: 0 };
    }
  } else {
    // General coupon: check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { appliedCoupon: null, discountAmount: 0 };
    }
  }

  // Minimum purchase
  if (subtotalForCoupon < coupon.minPurchase) {
    return { appliedCoupon: null, discountAmount: 0 };
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (subtotalForCoupon * coupon.discountAmount) / 100;
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else {
    discountAmount = coupon.discountAmount;
  }
  discountAmount = Math.min(discountAmount, subtotalForCoupon);

  return { appliedCoupon: coupon as any, discountAmount };
}

// Call this AFTER the booking document is created in the DB
export async function markCouponUsed(
  coupon: ICoupon & { _id: mongoose.Types.ObjectId },
  customerId?: string | null
) {
  if (coupon.isPersonalized) {
    await Coupon.findByIdAndUpdate(coupon._id, {
      $set: {
        isUsed: true,
        usedAt: new Date(),
        usedBy: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
        usageCount: 1,
      },
    });
  } else {
    await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usageCount: 1 } });
  }
}
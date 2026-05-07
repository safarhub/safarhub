// app/api/coupons/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/config/database";
import Coupon from "@/models/Coupon";

// Helper: extract user email from token without hard-failing (coupon validation
// should still work for guest flows, it will just reject personalized coupons)
function getUserFromToken(req: NextRequest): { id?: string; email?: string } | null {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { id: decoded.id || decoded._id, email: decoded.email };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { code, subtotal } = await req.json();

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Coupon code is required" },
        { status: 400 }
      );
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Invalid or inactive coupon code" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (coupon.startDate > now) {
      return NextResponse.json(
        { success: false, message: "Coupon is not yet valid" },
        { status: 400 }
      );
    }

    if (coupon.expiryDate < now) {
      return NextResponse.json(
        { success: false, message: "Coupon has expired" },
        { status: 400 }
      );
    }

    // ── Personalized coupon ownership check ────────────────────────────────
    if (coupon.isPersonalized) {
      // Already used
      if (coupon.isUsed) {
        return NextResponse.json(
          { success: false, message: "This coupon has already been used" },
          { status: 400 }
        );
      }

      const currentUser = getUserFromToken(req);

      if (!currentUser?.email) {
        return NextResponse.json(
          {
            success: false,
            message: "Please log in to use this exclusive coupon",
          },
          { status: 401 }
        );
      }

      if (
        coupon.assignedToEmail &&
        coupon.assignedToEmail.toLowerCase() !== currentUser.email.toLowerCase()
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "This coupon is assigned to a different account",
          },
          { status: 403 }
        );
      }
    } else {
      // General coupon: check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return NextResponse.json(
          { success: false, message: "Coupon usage limit reached" },
          { status: 400 }
        );
      }
    }

    if (subtotal < coupon.minPurchase) {
      return NextResponse.json(
        {
          success: false,
          message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon`,
        },
        { status: 400 }
      );
    }

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (subtotal * coupon.discountAmount) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountAmount;
    }

    return NextResponse.json({
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        minPurchase: coupon.minPurchase,
        appliedDiscount: discountAmount,
        isPersonalized: coupon.isPersonalized,
      },
    });
  } catch (error: any) {
    console.error("Coupon validation error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
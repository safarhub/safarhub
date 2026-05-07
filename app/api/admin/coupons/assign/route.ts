// app/api/admin/coupons/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Coupon from "@/models/Coupon";
import User from "@/models/User";
import { auth } from "@/lib/middlewares/auth";
import { mailSender } from "@/lib/utils/mailSender";
import assignedCouponTemplate from "@/lib/mail/templates/assignedCouponTemplate";

// POST /api/admin/coupons/assign
// Body: { email, couponId, adminNote? }  — assign an existing coupon to a user email
export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const reqUser = (req as any).user;

    if (reqUser.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { email, couponId, adminNote } = body;

    if (!email || !couponId) {
      return NextResponse.json(
        { success: false, message: "Email and couponId are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the coupon
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return NextResponse.json({ success: false, message: "Coupon not found" }, { status: 404 });
    }

    if (!coupon.isActive) {
      return NextResponse.json(
        { success: false, message: "Cannot assign an inactive coupon" },
        { status: 400 }
      );
    }

    if (coupon.isPersonalized && coupon.assignedToEmail) {
      return NextResponse.json(
        {
          success: false,
          message: `This coupon is already assigned to ${coupon.assignedToEmail}`,
        },
        { status: 400 }
      );
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return NextResponse.json(
        { success: false, message: "Cannot assign an expired coupon" },
        { status: 400 }
      );
    }

    // Try to find user for display name (not required — they may not have registered yet)
    const existingUser = await User.findOne({ email: normalizedEmail }).lean() as any;
    const recipientName = existingUser?.fullName || normalizedEmail.split("@")[0];

    // Mark coupon as personalized and assign
    coupon.isPersonalized = true;
    coupon.assignedToEmail = normalizedEmail;
    coupon.assignedToName = recipientName;
    coupon.assignedAt = new Date();
    coupon.assignedBy = reqUser.id;
    // Override usageLimit to 1 — personalized coupons are always single use
    coupon.usageLimit = 1;
    coupon.usageCount = 0;
    coupon.isUsed = false;
    await coupon.save();

    // Send email
    try {
      await mailSender(
        normalizedEmail,
        `🎁 Your exclusive SafarHub coupon: ${coupon.code}`,
        assignedCouponTemplate({
          recipientName,
          recipientEmail: normalizedEmail,
          couponCode: coupon.code,
          discountType: coupon.discountType,
          discountAmount: coupon.discountAmount,
          minPurchase: coupon.minPurchase,
          maxDiscount: coupon.maxDiscount,
          expiryDate: coupon.expiryDate,
          adminNote,
        })
      );
    } catch (mailErr) {
      console.error("Coupon assignment email failed:", mailErr);
      // Don't fail the whole request — coupon is assigned in DB, just email failed
      return NextResponse.json({
        success: true,
        coupon,
        warning: "Coupon assigned but email delivery failed. Please notify the user manually.",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Coupon ${coupon.code} successfully assigned to ${normalizedEmail} and email sent.`,
      coupon,
    });
  } catch (error: any) {
    console.error("Assign coupon error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to assign coupon" },
      { status: 500 }
    );
  }
});

// GET /api/admin/coupons/assign?email=xxx  — fetch all personalized coupons for an email
export const GET = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const reqUser = (req as any).user;

    if (reqUser.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    const query: any = { isPersonalized: true };
    if (email) query.assignedToEmail = email.toLowerCase().trim();

    const coupons = await Coupon.find(query).sort({ assignedAt: -1 }).lean();

    return NextResponse.json({ success: true, coupons });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch assigned coupons" },
      { status: 500 }
    );
  }
});
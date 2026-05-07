// app/api/profile/coupons/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/config/database";
import Coupon from "@/models/Coupon";

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

    const email = decoded.email;
    if (!email) {
      return NextResponse.json({ success: false, message: "No email in token" }, { status: 401 });
    }

    const coupons = await Coupon.find({
      isPersonalized: true,
      assignedToEmail: email.toLowerCase().trim(),
      isActive: true,
    })
      .sort({ assignedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, coupons });
  } catch (err) {
    console.error("Profile coupons error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import User from "@/models/User";
import { auth } from "@/lib/middlewares/auth";
import mongoose from "mongoose";

export const GET = auth(async (req: NextRequest) => {
  try {
    const actor = (req as any)?.user;
    if (actor?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const users = await User.find({ accountType: { $in: ["user", "vendor"] } })
      .select("fullName email contactNumber age accountType createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
});

export const DELETE = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const actor = (req as any).user;
    if (actor?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: "Valid userId is required" }, { status: 400 });
    }

    const target = await User.findById(userId).select("_id accountType");
    if (!target) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (String(target._id) === String(actor.id || actor._id)) {
      return NextResponse.json(
        { success: false, message: "You cannot remove your own admin account" },
        { status: 400 }
      );
    }

    if (target.accountType === "admin") {
      return NextResponse.json(
        { success: false, message: "Admin accounts cannot be removed from this panel" },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(userId);
    return NextResponse.json({ success: true, message: "User removed successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to remove user" },
      { status: 500 }
    );
  }
});

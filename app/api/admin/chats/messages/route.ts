import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import Message from "@/models/Message";
import UserRequirement from "@/models/Userrequirement";
import { auth } from "@/lib/middlewares/auth";

export const GET = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const actor = (req as any).user;
    if (actor?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requirementId = searchParams.get("requirementId");
    const vendorId = searchParams.get("vendorId");
    const customerId = searchParams.get("customerId");

    if (!requirementId || !vendorId || !customerId) {
      return NextResponse.json(
        { success: false, message: "requirementId, vendorId and customerId are required" },
        { status: 400 }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(requirementId) ||
      !mongoose.Types.ObjectId.isValid(vendorId) ||
      !mongoose.Types.ObjectId.isValid(customerId)
    ) {
      return NextResponse.json({ success: false, message: "Invalid ids provided" }, { status: 400 });
    }

    const messages = await Message.find({
      requirementId,
      $or: [
        { sender: vendorId, receiver: customerId },
        { sender: customerId, receiver: vendorId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName email accountType avatar")
      .populate("receiver", "fullName email accountType avatar");

    const requirement = await UserRequirement.findById(requirementId).select("_id title").lean();

    return NextResponse.json({
      success: true,
      requirement,
      messages,
    });
  } catch (error: any) {
    console.error("Admin chats messages error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load messages" },
      { status: 500 }
    );
  }
});

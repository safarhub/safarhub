import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Stay from "@/models/Stay";
import StayRoomBlock from "@/models/StayRoomBlock";

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
};

export const GET = auth(async (
  req: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    const resolvedParams = context?.params ? await context.params : null;
    const stayId = resolvedParams?.id;

    if (!stayId || !mongoose.Types.ObjectId.isValid(stayId)) {
      return NextResponse.json({ success: false, message: "Invalid stay id" }, { status: 400 });
    }

    const stay: any = await Stay.findById(stayId).select("vendorId rooms._id rooms.name").lean();
    if (!stay) {
      return NextResponse.json({ success: false, message: "Stay not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && stay.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to view stay blocks" },
        { status: 403 }
      );
    }

    const blocks = await StayRoomBlock.find({ stayId, isActive: true })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    console.error("Error fetching stay blocks:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch stay blocks" },
      { status: 500 }
    );
  }
});

export const POST = auth(async (
  req: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    const resolvedParams = context?.params ? await context.params : null;
    const stayId = resolvedParams?.id;

    if (!stayId || !mongoose.Types.ObjectId.isValid(stayId)) {
      return NextResponse.json({ success: false, message: "Invalid stay id" }, { status: 400 });
    }

    const stay = await Stay.findById(stayId).select("vendorId rooms._id rooms.name rooms.available");
    if (!stay) {
      return NextResponse.json({ success: false, message: "Stay not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && stay.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage stay blocks" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { roomId, roomName, startDate, endDate, blockedCount = 1, reason = "" } = body || {};

    if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
    }

    const normalizedBlockedCount = Number(blockedCount);
    if (!Number.isFinite(normalizedBlockedCount) || normalizedBlockedCount < 1) {
      return NextResponse.json(
        { success: false, message: "blockedCount must be at least 1" },
        { status: 400 }
      );
    }

    const targetRoom = stay.rooms.find((room: any) => {
      const idMatches = roomId && room._id?.toString() === String(roomId);
      const nameMatches = roomName && room.name === roomName;
      return idMatches || nameMatches;
    });

    if (!targetRoom) {
      return NextResponse.json(
        { success: false, message: "Target room not found in this stay" },
        { status: 404 }
      );
    }

    if (normalizedBlockedCount > Number(targetRoom.available || 0)) {
      return NextResponse.json(
        {
          success: false,
          message: `blockedCount cannot exceed room inventory (${targetRoom.available || 0})`,
        },
        { status: 400 }
      );
    }

    const block = await StayRoomBlock.create({
      stayId: stay._id,
      vendorId: stay.vendorId,
      roomId: targetRoom._id,
      roomName: targetRoom.name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      blockedCount: normalizedBlockedCount,
      reason: String(reason || ""),
      isActive: true,
    });

    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating stay block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create stay block" },
      { status: 500 }
    );
  }
});

export const DELETE = auth(async (
  req: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    const resolvedParams = context?.params ? await context.params : null;
    const stayId = resolvedParams?.id;

    if (!stayId || !mongoose.Types.ObjectId.isValid(stayId)) {
      return NextResponse.json({ success: false, message: "Invalid stay id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get("blockId");

    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return NextResponse.json({ success: false, message: "Invalid blockId" }, { status: 400 });
    }

    const stay: any = await Stay.findById(stayId).select("vendorId").lean();
    if (!stay) {
      return NextResponse.json({ success: false, message: "Stay not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && stay.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage stay blocks" },
        { status: 403 }
      );
    }

    const block = await StayRoomBlock.findOne({ _id: blockId, stayId }).select("_id").lean();
    if (!block) {
      return NextResponse.json({ success: false, message: "Block not found" }, { status: 404 });
    }

    await StayRoomBlock.deleteOne({ _id: blockId });

    return NextResponse.json({ success: true, message: "Block removed" });
  } catch (error: any) {
    console.error("Error deleting stay block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete stay block" },
      { status: 500 }
    );
  }
});

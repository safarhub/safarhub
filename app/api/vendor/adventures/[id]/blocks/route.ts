import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Adventure from "@/models/Adventure";
import ServiceOptionBlock from "@/models/ServiceOptionBlock";

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
    const adventureId = resolvedParams?.id;

    if (!adventureId || !mongoose.Types.ObjectId.isValid(adventureId)) {
      return NextResponse.json({ success: false, message: "Invalid adventure id" }, { status: 400 });
    }

    const adventure: any = await Adventure.findById(adventureId).select("vendorId").lean();
    if (!adventure) {
      return NextResponse.json({ success: false, message: "Adventure not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && adventure.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to view adventure blocks" },
        { status: 403 }
      );
    }

    const blocks = await ServiceOptionBlock.find({
      serviceType: "adventure",
      serviceId: adventureId,
      isActive: true,
    })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    console.error("Error fetching adventure blocks:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch adventure blocks" },
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
    const adventureId = resolvedParams?.id;

    if (!adventureId || !mongoose.Types.ObjectId.isValid(adventureId)) {
      return NextResponse.json({ success: false, message: "Invalid adventure id" }, { status: 400 });
    }

    const adventure: any = await Adventure.findById(adventureId).select(
      "vendorId options._id options.name options.available"
    );
    if (!adventure) {
      return NextResponse.json({ success: false, message: "Adventure not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && adventure.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage adventure blocks" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { optionId, optionName, startDate, endDate, blockedCount = 1, reason = "" } = body || {};

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

    const targetOption = adventure.options.find((option: any) => {
      const idMatches = optionId && option._id?.toString() === String(optionId);
      const nameMatches = optionName && option.name === optionName;
      return idMatches || nameMatches;
    });

    if (!targetOption) {
      return NextResponse.json(
        { success: false, message: "Target option not found in this adventure" },
        { status: 404 }
      );
    }

    const maxBlock = Number(targetOption.available || 0);
    if (normalizedBlockedCount > maxBlock) {
      return NextResponse.json(
        {
          success: false,
          message: `blockedCount cannot exceed option inventory (${maxBlock})`,
        },
        { status: 400 }
      );
    }

    const block = await ServiceOptionBlock.create({
      serviceType: "adventure",
      serviceId: adventure._id,
      vendorId: adventure.vendorId,
      optionId: targetOption._id,
      optionName: targetOption.name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      blockedCount: normalizedBlockedCount,
      reason: String(reason || ""),
      isActive: true,
    });

    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating adventure block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create adventure block" },
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
    const adventureId = resolvedParams?.id;

    if (!adventureId || !mongoose.Types.ObjectId.isValid(adventureId)) {
      return NextResponse.json({ success: false, message: "Invalid adventure id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get("blockId");

    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return NextResponse.json({ success: false, message: "Invalid blockId" }, { status: 400 });
    }

    const adventure: any = await Adventure.findById(adventureId).select("vendorId").lean();
    if (!adventure) {
      return NextResponse.json({ success: false, message: "Adventure not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && adventure.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage adventure blocks" },
        { status: 403 }
      );
    }

    const block = await ServiceOptionBlock.findOne({
      _id: blockId,
      serviceType: "adventure",
      serviceId: adventureId,
    })
      .select("_id")
      .lean();

    if (!block) {
      return NextResponse.json({ success: false, message: "Block not found" }, { status: 404 });
    }

    await ServiceOptionBlock.deleteOne({ _id: blockId });

    return NextResponse.json({ success: true, message: "Block removed" });
  } catch (error: any) {
    console.error("Error deleting adventure block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete adventure block" },
      { status: 500 }
    );
  }
});

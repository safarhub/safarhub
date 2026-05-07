import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Tour from "@/models/Tour";
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
    const tourId = resolvedParams?.id;

    if (!tourId || !mongoose.Types.ObjectId.isValid(tourId)) {
      return NextResponse.json({ success: false, message: "Invalid tour id" }, { status: 400 });
    }

    const tour: any = await Tour.findById(tourId).select("vendorId").lean();
    if (!tour) {
      return NextResponse.json({ success: false, message: "Tour not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && tour.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to view tour blocks" },
        { status: 403 }
      );
    }

    const blocks = await ServiceOptionBlock.find({
      serviceType: "tour",
      serviceId: tourId,
      isActive: true,
    })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    console.error("Error fetching tour blocks:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch tour blocks" },
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
    const tourId = resolvedParams?.id;

    if (!tourId || !mongoose.Types.ObjectId.isValid(tourId)) {
      return NextResponse.json({ success: false, message: "Invalid tour id" }, { status: 400 });
    }

    const tour: any = await Tour.findById(tourId).select("vendorId category options._id options.name options.capacity");
    if (!tour) {
      return NextResponse.json({ success: false, message: "Tour not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && tour.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage tour blocks" },
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

    const targetOption = tour.options.find((option: any) => {
      const idMatches = optionId && option._id?.toString() === String(optionId);
      const nameMatches = optionName && option.name === optionName;
      return idMatches || nameMatches;
    });

    if (!targetOption) {
      return NextResponse.json(
        { success: false, message: "Target option not found in this tour" },
        { status: 404 }
      );
    }

    const isPackageTour = String(tour.category) === "tour-packages";
    const maxBlock = isPackageTour ? 1 : Number(targetOption.capacity || 0);
    if (normalizedBlockedCount > maxBlock) {
      return NextResponse.json(
        {
          success: false,
          message: `blockedCount cannot exceed option capacity (${maxBlock})`,
        },
        { status: 400 }
      );
    }

    const block = await ServiceOptionBlock.create({
      serviceType: "tour",
      serviceId: tour._id,
      vendorId: tour.vendorId,
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
    console.error("Error creating tour block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create tour block" },
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
    const tourId = resolvedParams?.id;

    if (!tourId || !mongoose.Types.ObjectId.isValid(tourId)) {
      return NextResponse.json({ success: false, message: "Invalid tour id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get("blockId");

    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return NextResponse.json({ success: false, message: "Invalid blockId" }, { status: 400 });
    }

    const tour: any = await Tour.findById(tourId).select("vendorId").lean();
    if (!tour) {
      return NextResponse.json({ success: false, message: "Tour not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && tour.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage tour blocks" },
        { status: 403 }
      );
    }

    const block = await ServiceOptionBlock.findOne({
      _id: blockId,
      serviceType: "tour",
      serviceId: tourId,
    })
      .select("_id")
      .lean();

    if (!block) {
      return NextResponse.json({ success: false, message: "Block not found" }, { status: 404 });
    }

    await ServiceOptionBlock.deleteOne({ _id: blockId });

    return NextResponse.json({ success: true, message: "Block removed" });
  } catch (error: any) {
    console.error("Error deleting tour block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete tour block" },
      { status: 500 }
    );
  }
});

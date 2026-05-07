import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import VehicleRental from "@/models/VehicleRental";
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
    const vehicleRentalId = resolvedParams?.id;

    if (!vehicleRentalId || !mongoose.Types.ObjectId.isValid(vehicleRentalId)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle rental id" }, { status: 400 });
    }

    const rental: any = await VehicleRental.findById(vehicleRentalId).select("vendorId").lean();
    if (!rental) {
      return NextResponse.json({ success: false, message: "Vehicle rental not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && rental.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to view vehicle blocks" },
        { status: 403 }
      );
    }

    const blocks = await ServiceOptionBlock.find({
      serviceType: "vehicle",
      serviceId: vehicleRentalId,
      isActive: true,
    })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    console.error("Error fetching vehicle blocks:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch vehicle blocks" },
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
    const vehicleRentalId = resolvedParams?.id;

    if (!vehicleRentalId || !mongoose.Types.ObjectId.isValid(vehicleRentalId)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle rental id" }, { status: 400 });
    }

    const rental: any = await VehicleRental.findById(vehicleRentalId).select(
      "vendorId options._id options.model options.available"
    );
    if (!rental) {
      return NextResponse.json({ success: false, message: "Vehicle rental not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && rental.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage vehicle blocks" },
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

    const targetOption = rental.options.find((option: any) => {
      const idMatches = optionId && option._id?.toString() === String(optionId);
      const nameMatches = optionName && option.model === optionName;
      return idMatches || nameMatches;
    });

    if (!targetOption) {
      return NextResponse.json(
        { success: false, message: "Target vehicle option not found" },
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
      serviceType: "vehicle",
      serviceId: rental._id,
      vendorId: rental.vendorId,
      optionId: targetOption._id,
      optionName: targetOption.model,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      blockedCount: normalizedBlockedCount,
      reason: String(reason || ""),
      isActive: true,
    });

    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating vehicle block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create vehicle block" },
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
    const vehicleRentalId = resolvedParams?.id;

    if (!vehicleRentalId || !mongoose.Types.ObjectId.isValid(vehicleRentalId)) {
      return NextResponse.json({ success: false, message: "Invalid vehicle rental id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get("blockId");

    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return NextResponse.json({ success: false, message: "Invalid blockId" }, { status: 400 });
    }

    const rental: any = await VehicleRental.findById(vehicleRentalId).select("vendorId").lean();
    if (!rental) {
      return NextResponse.json({ success: false, message: "Vehicle rental not found" }, { status: 404 });
    }

    if (user.accountType !== "admin" && rental.vendorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to manage vehicle blocks" },
        { status: 403 }
      );
    }

    const block = await ServiceOptionBlock.findOne({
      _id: blockId,
      serviceType: "vehicle",
      serviceId: vehicleRentalId,
    })
      .select("_id")
      .lean();

    if (!block) {
      return NextResponse.json({ success: false, message: "Block not found" }, { status: 404 });
    }

    await ServiceOptionBlock.deleteOne({ _id: blockId });

    return NextResponse.json({ success: true, message: "Block removed" });
  } catch (error: any) {
    console.error("Error deleting vehicle block:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete vehicle block" },
      { status: 500 }
    );
  }
});

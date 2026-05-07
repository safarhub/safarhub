import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import UserRequirement from "@/models/Userrequirement";
import { auth } from "@/lib/middlewares/auth";

export async function GET() {
  try {
    await dbConnect();

    const requirements = await UserRequirement.find()
      .sort({ createdAt: -1 })
      .populate("user", "fullName avatar");

    return NextResponse.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error("GET /requirements ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

export const POST = auth(async (req: Request) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      title,
      categories,
      description,
      expectedPriceMin,
      expectedPriceMax,
      checkIn,
      checkOut,
      numberOfGuests,
    } = body;

    if (!title || !categories?.length) {
      return NextResponse.json(
        { success: false, message: "Title and at least one category are required" },
        { status: 400 }
      );
    }

    const min = expectedPriceMin !== undefined && expectedPriceMin !== ""
      ? Number(expectedPriceMin)
      : null;
    const max = expectedPriceMax !== undefined && expectedPriceMax !== ""
      ? Number(expectedPriceMax)
      : null;

    if (
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0))
    ) {
      return NextResponse.json(
        { success: false, message: "Expected price must be a non-negative number" },
        { status: 400 }
      );
    }

    if (min !== null && max !== null && min > max) {
      return NextResponse.json(
        { success: false, message: "Expected minimum price cannot be greater than maximum price" },
        { status: 400 }
      );
    }

    const checkInDate = checkIn ? new Date(checkIn) : null;
    const checkOutDate = checkOut ? new Date(checkOut) : null;

    if ((checkInDate && Number.isNaN(checkInDate.getTime())) || (checkOutDate && Number.isNaN(checkOutDate.getTime()))) {
      return NextResponse.json(
        { success: false, message: "Invalid check-in or check-out date" },
        { status: 400 }
      );
    }

    if ((checkInDate && !checkOutDate) || (!checkInDate && checkOutDate)) {
      return NextResponse.json(
        { success: false, message: "Please provide both check-in and check-out dates" },
        { status: 400 }
      );
    }

    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return NextResponse.json(
        { success: false, message: "Check-out date must be after check-in date" },
        { status: 400 }
      );
    }

    const guests = numberOfGuests !== undefined && numberOfGuests !== ""
      ? Number(numberOfGuests)
      : null;

    if (guests !== null && (!Number.isInteger(guests) || guests <= 0)) {
      return NextResponse.json(
        { success: false, message: "Number of guests must be a positive whole number" },
        { status: 400 }
      );
    }

    const requirement = await UserRequirement.create({
      user: user.id,
      title,
      categories,
      description: description || "",
      expectedPriceMin: min,
      expectedPriceMax: max,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      numberOfGuests: guests,
    });

    return NextResponse.json({
      success: true,
      requirement,
    });
  } catch (error: any) {
    console.error("POST /requirements ERROR:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
});

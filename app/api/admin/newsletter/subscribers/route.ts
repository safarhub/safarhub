import { NextRequest, NextResponse } from "next/server";
import Newsletter from "@/models/Newsletter";
import dbConnect from "@/lib/config/database";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Verify admin access if needed
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      subscribers,
    });
  } catch (error: any) {
    console.error("Failed to fetch subscribers", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

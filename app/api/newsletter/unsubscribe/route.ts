import { NextRequest, NextResponse } from "next/server";
import Newsletter from "@/models/Newsletter";
import dbConnect from "@/lib/config/database";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.json(
        { success: false, message: "Invalid unsubscribe link" },
        { status: 400 }
      );
    }

    const subscriber = await Newsletter.findOne({
      email: email.toLowerCase(),
    });

    if (!subscriber) {
      return NextResponse.json(
        { success: false, message: "Email not found" },
        { status: 404 }
      );
    }

    // Verify unsubscribe token if provided
    if (subscriber.unsubscribeToken && subscriber.unsubscribeToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid unsubscribe token" },
        { status: 400 }
      );
    }

    // Unsubscribe
    subscriber.subscribed = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    // Redirect to unsubscribe confirmation page
    return NextResponse.redirect(
      new URL("/newsletter-unsubscribed?success=true", req.url)
    );
  } catch (error: any) {
    console.error("Newsletter unsubscribe failed", error);
    return NextResponse.json(
      { success: false, message: "Unsubscribe failed" },
      { status: 500 }
    );
  }
}

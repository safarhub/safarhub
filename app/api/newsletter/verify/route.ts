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
        { success: false, message: "Invalid verification link" },
        { status: 400 }
      );
    }

    const subscriberEmail = email.toLowerCase().trim();
    const now = new Date();

    // Find subscriber with exact token match
    const subscriber = await Newsletter.findOne({
      email: subscriberEmail,
      verificationToken: token,
    });

    if (!subscriber) {
      console.error(`Newsletter verify: No subscriber found for ${subscriberEmail} with token`, token);
      return NextResponse.json(
        { success: false, message: "Invalid verification link" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (!subscriber.verificationTokenExpiry || new Date(subscriber.verificationTokenExpiry) < now) {
      console.error(
        `Newsletter verify: Token expired for ${subscriberEmail}. Expiry: ${subscriber.verificationTokenExpiry}, Now: ${now}`
      );
      return NextResponse.json(
        { success: false, message: "Verification link has expired. Please subscribe again." },
        { status: 400 }
      );
    }

    // Mark as verified
    subscriber.isVerified = true;
    subscriber.verificationToken = undefined;
    subscriber.verificationTokenExpiry = undefined;
    await subscriber.save();

    console.log(`Newsletter verified: ${subscriberEmail}`);

    // Redirect to success page
    return NextResponse.redirect(
      new URL("/newsletter-verified?success=true", req.url)
    );
  } catch (error: any) {
    console.error("Newsletter verification failed", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}

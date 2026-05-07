import { NextRequest, NextResponse } from "next/server";
import { mailSender } from "@/lib/utils/mailSender";
import Newsletter from "@/models/Newsletter";
import dbConnect from "@/lib/config/database";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const email = body?.email?.trim().toLowerCase();
    const consent = Boolean(body?.consent);

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (!consent) {
      return NextResponse.json({ success: false, message: "Consent is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: "Please enter a valid email" }, { status: 400 });
    }

    // Check if email already exists and is verified
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber && existingSubscriber.isVerified && existingSubscriber.subscribed) {
      return NextResponse.json(
        { success: false, message: "Email already subscribed" },
        { status: 400 }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create or update subscriber
    const subscriber = await Newsletter.findOneAndUpdate(
      { email },
      {
        email,
        consent,
        verificationToken,
        verificationTokenExpiry,
        subscribed: true,
        isVerified: false,
        subscribedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`Newsletter subscription: ${email}, Token expiry: ${verificationTokenExpiry}`);

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/newsletter/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const verificationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to SafarHub Newsletter!</h2>
        <p>Thank you for subscribing to our newsletter. Please confirm your subscription by clicking the button below:</p>
        <p style="margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p>Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          If you didn't subscribe to this newsletter, you can safely ignore this email.
        </p>
      </div>
    `;

    await mailSender(email, "Verify Your SafarHub Newsletter Subscription", verificationHtml);

    // Send admin notification
    const adminEmail = process.env.EMAIL_TO || process.env.EMAIL_USER;
    if (adminEmail) {
      const adminHtml = `
        <h3>New Newsletter Subscription</h3>
        <p>Email: <strong>${email}</strong></p>
        <p>Status: Pending verification</p>
        <p>Received at: ${new Date().toLocaleString()}</p>
      `;
      await mailSender(adminEmail, "[Admin] New Newsletter Subscription", adminHtml);
    }

    return NextResponse.json({
      success: true,
      message: "Please check your email to verify your subscription",
    });
  } catch (error: any) {
    console.error("Newsletter subscription failed", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to submit subscription" },
      { status: 500 }
    );
  }
}



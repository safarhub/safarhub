import { NextRequest, NextResponse } from "next/server";
import Newsletter from "@/models/Newsletter";
import dbConnect from "@/lib/config/database";
import { mailSender } from "@/lib/utils/mailSender";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const { title, html } = body;

    if (!title || !html) {
      return NextResponse.json(
        { success: false, message: "Title and HTML are required" },
        { status: 400 }
      );
    }

    // Get all verified and subscribed subscribers
    const subscribers = await Newsletter.find({
      isVerified: true,
      subscribed: true,
    });

    if (subscribers.length === 0) {
      return NextResponse.json(
        { success: false, message: "No verified subscribers" },
        { status: 400 }
      );
    }

    // Send emails in batches
    let sentCount = 0;
    for (const subscriber of subscribers) {
      try {
        // Generate unsubscribe token
        const unsubscribeToken = crypto.randomBytes(32).toString("hex");
        subscriber.unsubscribeToken = unsubscribeToken;
        await subscriber.save();

        const unsubscribeUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/newsletter/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(subscriber.email)}`;

        const emailContent = `
          ${html}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">
              Unsubscribe from newsletter
            </a>
          </p>
        `;

        await mailSender(subscriber.email, title, emailContent);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to ${subscriber.email}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${sentCount} subscribers`,
      sentCount,
    });
  } catch (error: any) {
    console.error("Failed to send campaign", error);
    return NextResponse.json(
      { success: false, message: "Failed to send campaign" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Message from "@/models/Message";
import { auth } from "@/lib/middlewares/auth";
import { REQUIREMENT_CHAT_PRESET_VALUES } from "@/lib/utils/requirementChatPresets";

const PHONE_REGEX = /(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){10,}/;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const EXTERNAL_CONTACT_REGEX = /(whatsapp|telegram|call me|contact me|dm me|instagram|facebook|snapchat)/i;

function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return ["drive.google.com", "docs.google.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

// GET messages for a requirement
export const GET = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requirementId = searchParams.get("requirementId");
    const otherUserId = searchParams.get("userId");

    if (!requirementId || !otherUserId) {
      return NextResponse.json(
        { success: false, message: "requirementId and userId are required" },
        { status: 400 }
      );
    }

    // Get messages between the two users for this requirement
    const messages = await Message.find({
      requirementId,
      $or: [
        { sender: user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: user.id },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName avatar")
      .populate("receiver", "fullName avatar");

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("GET /messages ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
});

// POST a new message
export const POST = auth(async (req: NextRequest) => {
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
      requirementId,
      receiverId,
      message,
      kind = "preset",
      priceAmount,
      linkUrl,
    } = body;

    if (!requirementId || !receiverId) {
      return NextResponse.json(
        { success: false, message: "requirementId and receiverId are required" },
        { status: 400 }
      );
    }

    if (
      !["preset", "price_offer", "price_counter", "price_accept", "drive_link", "system"].includes(
        kind
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid message kind" },
        { status: 400 }
      );
    }

    const content = String(message || "").trim();

    if (kind === "preset") {
      if (!content || !REQUIREMENT_CHAT_PRESET_VALUES.has(content)) {
        return NextResponse.json(
          { success: false, message: "Only predefined messages are allowed" },
          { status: 400 }
        );
      }
    }

    if (kind === "price_offer" || kind === "price_counter") {
      const amount = Number(priceAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, message: "Valid priceAmount is required" },
          { status: 400 }
        );
      }

      const existingConfirmation = await Message.findOne({
        requirementId,
        kind: "price_accept",
        $or: [
          { sender: user.id, receiver: receiverId },
          { sender: receiverId, receiver: user.id },
        ],
      }).select("_id");

      if (existingConfirmation) {
        return NextResponse.json(
          {
            success: false,
            message: "Price is already confirmed. New offer/counter is locked for this chat.",
          },
          { status: 409 }
        );
      }
    }

    if (kind === "drive_link") {
      if (!linkUrl || !isGoogleDriveUrl(linkUrl)) {
        return NextResponse.json(
          { success: false, message: "Only Google Drive links are allowed" },
          { status: 400 }
        );
      }
    }

    if (
      PHONE_REGEX.test(content) ||
      EMAIL_REGEX.test(content) ||
      EXTERNAL_CONTACT_REGEX.test(content)
    ) {
      return NextResponse.json(
        { success: false, message: "Sharing personal contact details is not allowed" },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { success: false, message: "Message is required" },
        { status: 400 }
      );
    }

    const newMessage = await Message.create({
      requirementId,
      sender: user.id,
      receiver: receiverId,
      message: content,
      kind,
      priceAmount: priceAmount ?? null,
      linkUrl: linkUrl ?? null,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName avatar")
      .populate("receiver", "fullName avatar");

    return NextResponse.json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error("POST /messages ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
});

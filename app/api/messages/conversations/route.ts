import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Message from "@/models/Message";
import { auth } from "@/lib/middlewares/auth";

// GET all conversations for a requirement (for the requirement owner)
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

    if (!requirementId) {
      return NextResponse.json(
        { success: false, message: "requirementId is required" },
        { status: 400 }
      );
    }

    // Get all messages for this requirement where user is involved
    const messages = await Message.find({
      requirementId,
      $or: [
        { sender: user.id },
        { receiver: user.id },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName avatar")
      .populate("receiver", "fullName avatar");

    // Extract unique conversation partners
    const partnersMap = new Map();
    messages.forEach((msg: any) => {
      const partner = msg.sender._id.toString() !== user.id ? msg.sender : msg.receiver;
      if (partner._id.toString() !== user.id) {
        partnersMap.set(partner._id.toString(), {
          _id: partner._id,
          fullName: partner.fullName,
          avatar: partner.avatar,
        });
      }
    });

    const partners = Array.from(partnersMap.values());

    return NextResponse.json({
      success: true,
      partners,
      messages,
    });
  } catch (error) {
    console.error("GET /messages/conversations ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
});

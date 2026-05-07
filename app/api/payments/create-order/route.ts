import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import razorpay from "@/lib/config/razorpay";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";
import Payment from "@/models/Payment";

export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const user = (req as any).user;
    const { orderId } = await req.json();

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: "Invalid orderId" },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    if (order.user.toString() !== user.id && user.accountType !== "admin") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const amountPaise = Math.round(Number(order.totalAmount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid payable amount" },
        { status: 400 }
      );
    }

    const localOrderId = String(order._id);

    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: localOrderId,
      notes: {
        localOrderId,
        userId: user.id,
      },
    });

    await Payment.findOneAndUpdate(
      { razorpayOrderId: rzOrder.id },
      {
        $set: {
          orderId: order._id,
          userId: order.user,
          provider: "razorpay",
          status: "created",
          amount: Number(order.totalAmount),
          currency: "INR",
          razorpayOrderId: rzOrder.id,
          raw: rzOrder,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      razorpayOrderId: rzOrder.id,
      amount: amountPaise,
      currency: "INR",
      localOrderId,
    });
  } catch (error: any) {
    console.error("Create Razorpay order error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
});
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Payment from "@/models/Payment";
import Order from "@/models/Order";
import Booking from "@/models/Booking";
import { verifyRazorpayWebhookSignature } from "@/lib/utils/razorpaySignature";

type BookingLookup = {
  serviceType: "stay" | "tour" | "adventure" | "vehicle";
  field: "stayId" | "tourId" | "adventureId" | "vehicleRentalId";
};

const ORDER_ITEM_TO_BOOKING: Record<string, BookingLookup> = {
  Stay: { serviceType: "stay", field: "stayId" },
  Tour: { serviceType: "tour", field: "tourId" },
  Adventure: { serviceType: "adventure", field: "adventureId" },
  VehicleRental: { serviceType: "vehicle", field: "vehicleRentalId" },
};

async function syncCatalogBookingsAfterWebhook(params: {
  order: any;
  userId: string;
}) {
  const { order, userId } = params;

  if (!order || !userId || order.orderContext === "requirement_deal") {
    return;
  }

  const orderIdString = order._id?.toString?.();
  if (!orderIdString) {
    return;
  }

  const directSyncResult = await Booking.updateMany(
    {
      customerId: userId,
      "metadata.catalogPayment.orderId": orderIdString,
      paymentStatus: { $in: ["unpaid", "pending"] },
    },
    {
      $set: {
        paymentStatus: "paid",
        status: "confirmed",
      },
    }
  );

  if ((directSyncResult.modifiedCount || 0) > 0) {
    return;
  }

  const serviceItems = (order.items || []).filter((item: any) => Boolean(ORDER_ITEM_TO_BOOKING[item.itemType]));
  if (!serviceItems.length) {
    return;
  }

  const isSingleServiceOrder = serviceItems.length === 1;
  const matchedBookingIds: string[] = [];

  for (const item of serviceItems) {
    const mapping = ORDER_ITEM_TO_BOOKING[item.itemType];
    const serviceRefId = item.itemId?.toString?.();
    if (!mapping || !serviceRefId) {
      continue;
    }

    const matchQuery: any = {
      customerId: userId,
      serviceType: mapping.serviceType,
      [mapping.field]: serviceRefId,
      paymentStatus: { $in: ["unpaid", "pending"] },
      status: "pending",
      "metadata.requirementPayment": { $exists: false },
      _id: { $nin: matchedBookingIds },
    };

    if (isSingleServiceOrder) {
      matchQuery.totalAmount = Number(order.totalAmount || 0);
    }

    const booking = await Booking.findOne(matchQuery)
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    const bookingDoc = Array.isArray(booking) ? booking[0] : booking;
    const bookingId = bookingDoc?._id;

    if (!bookingId) {
      continue;
    }

    const bookingIdString = String(bookingId);
    matchedBookingIds.push(bookingIdString);

    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          paymentStatus: "paid",
          status: "confirmed",
          "metadata.catalogPayment.orderId": orderIdString,
        },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const signature = req.headers.get("x-razorpay-signature");
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json(
        { success: false, message: "Missing webhook signature" },
        { status: 400 }
      );
    }

    const ok = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      secret: process.env.RAZORPAY_WEBHOOK_SECRET as string,
    });

    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      const rzOrderId = paymentEntity?.order_id;
      const rzPaymentId = paymentEntity?.id;

      const payment = await Payment.findOne({ razorpayOrderId: rzOrderId });
      if (payment) {
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: "captured",
              razorpayPaymentId: rzPaymentId,
              raw: event,
            },
          }
        );

        await Order.updateOne(
          { _id: payment.orderId },
          { $set: { status: "Placed" } }
        );

        const paidOrder = await Order.findById(payment.orderId).lean();
        if (paidOrder && payment.userId) {
          await syncCatalogBookingsAfterWebhook({
            order: paidOrder,
            userId: payment.userId.toString(),
          });
        }
      }
    }

    if (event.event === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const rzOrderId = paymentEntity?.order_id;

      await Payment.updateOne(
        { razorpayOrderId: rzOrderId },
        {
          $set: {
            status: "failed",
            failureReason: paymentEntity?.error_description || "Payment failed",
            raw: event,
          },
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Webhook handling failed" },
      { status: 500 }
    );
  }
}
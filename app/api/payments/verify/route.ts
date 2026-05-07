import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order, { type IOrderItem } from "@/models/Order";
import Payment from "@/models/Payment";
import Product from "@/models/Product";
import User from "@/models/User";
import UserRequirement from "@/models/Userrequirement";
import Message from "@/models/Message";
import Booking from "@/models/Booking";
import { mailSender } from "@/lib/utils/mailSender";
import { verifyRazorpayPaymentSignature } from "@/lib/utils/razorpaySignature";

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

async function syncCatalogBookingsAfterPayment(params: {
  order: any;
  userId: string;
}) {
  const { order, userId } = params;

  if (!order || !userId) return;
  if (order.orderContext === "requirement_deal") return;

  const orderIdString = order._id?.toString?.();
  if (!orderIdString) return;

  // Preferred path: exact mapping using metadata.catalogPayment.orderId.
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

  // Fallback: match most recent pending/unpaid service bookings by service reference.
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

function requirementPaymentEmailTemplate(params: {
  heading: string;
  recipientName: string;
  requirementTitle: string;
  amount: number;
  paidAt: Date;
  checkIn?: Date | null;
  checkOut?: Date | null;
  numberOfGuests?: number | null;
}) {
  const days =
    params.checkIn && params.checkOut && params.checkOut > params.checkIn
      ? Math.ceil((params.checkOut.getTime() - params.checkIn.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">
      <h2 style="margin:0 0 12px 0;color:#0f766e">${params.heading}</h2>
      <p>Hello ${params.recipientName},</p>
      <p>Your requirement deal booking has been confirmed successfully on SafarHub.</p>
      <p><strong>Requirement:</strong> ${params.requirementTitle}</p>
      <p><strong>Dates:</strong> ${params.checkIn ? params.checkIn.toLocaleDateString() : "-"} to ${params.checkOut ? params.checkOut.toLocaleDateString() : "-"}${days ? ` (${days} days)` : ""}</p>
      <p><strong>Guests:</strong> ${params.numberOfGuests ?? "-"}</p>
      <p><strong>Amount:</strong> INR ${params.amount.toLocaleString()}</p>
      <p><strong>Confirmed At:</strong> ${params.paidAt.toLocaleString()}</p>
      <p>Thank you.</p>
    </div>
  `;
}

const deductProductStockForOrder = async (items: IOrderItem[]) => {
  const productItems = items.filter((item) => item.itemType === "Product");

  for (const item of productItems) {
    const product = await Product.findById(item.itemId);
    if (!product) {
      throw new Error(`Product not found for item ${item.itemId}`);
    }

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      if (!item.variantId) {
        throw new Error("Variant product is missing variantId");
      }

      const variant = product.variants.id(item.variantId);
      if (!variant) {
        throw new Error("Selected variant not found during payment confirmation");
      }

      const currentVariantStock = Number(variant.stock ?? 0);
      if (currentVariantStock < item.quantity) {
        throw new Error("Insufficient variant stock at payment confirmation");
      }

      variant.stock = currentVariantStock - item.quantity;
      product.outOfStock = product.variants.every(
        (variantDoc: any) => Number(variantDoc.stock ?? 0) <= 0
      );
      await product.save();
      continue;
    }

    const currentStock = Number(product.stock ?? 0);
    if (currentStock < item.quantity) {
      throw new Error("Insufficient product stock at payment confirmation");
    }

    product.stock = currentStock - item.quantity;
    if (product.listingType === "rent" && (!Array.isArray(product.variants) || product.variants.length === 0)) {
      product.rentalQuantity = Math.max(0, Number(product.stock ?? 0));
    }
    product.outOfStock = product.stock <= 0;
    await product.save();
  }
};

export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const user = (req as any).user;

    const {
      localOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!localOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Missing payment verification fields" },
        { status: 400 }
      );
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      orderId: localOrderId,
      userId: user.id,
    });
    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment record not found for this order" },
        { status: 404 }
      );
    }

    const order = await Order.findOne({ _id: localOrderId, user: user.id });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    const orderIdString = String(order._id);

    if (String(payment.orderId) !== orderIdString) {
      return NextResponse.json(
        { success: false, message: "Payment does not belong to this order" },
        { status: 400 }
      );
    }

    if (payment.status === "captured") {
      if (order?.status !== "Placed") {
        await Order.updateOne(
          { _id: order._id, user: user.id },
          { $set: { status: "Placed" } }
        );
      }

      await syncCatalogBookingsAfterPayment({
        order,
        userId: user.id,
      });

      return NextResponse.json({ success: true, message: "Already verified" });
    }

    const ok = verifyRazorpayPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      secret: process.env.RAZORPAY_KEY_SECRET as string,
    });

    if (!ok) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "failed",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            failureReason: "Signature verification failed",
          },
        }
      );

      return NextResponse.json(
        { success: false, message: "Invalid payment signature" },
        { status: 400 }
      );
    }

    const expectedAmount = Number(order.totalAmount);
    if (!Number.isFinite(expectedAmount) || Number(payment.amount) !== expectedAmount || payment.currency !== "INR") {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "failed",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            failureReason: "Amount or currency mismatch",
          },
        }
      );

      return NextResponse.json(
        { success: false, message: "Payment amount mismatch" },
        { status: 400 }
      );
    }

    if (order.status === "Placed") {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "captured",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
          },
        }
      );
      return NextResponse.json({ success: true, message: "Already verified" });
    }

    try {
      await deductProductStockForOrder(order.items as IOrderItem[]);
    } catch (stockError: any) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "failed",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            failureReason: stockError?.message || "Stock deduction failed",
          },
        }
      );

      return NextResponse.json(
        { success: false, message: stockError?.message || "Stock validation failed" },
        { status: 409 }
      );
    }

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "captured",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
      }
    );

    await Order.updateOne(
      { _id: order._id, user: user.id },
      { $set: { status: "Placed" } }
    );

    await syncCatalogBookingsAfterPayment({
      order,
      userId: user.id,
    });

    await Booking.updateMany(
      {
        customerId: user.id,
        "metadata.requirementPayment.orderId": orderIdString,
      },
      {
        $set: {
          paymentStatus: "paid",
          status: "confirmed",
        },
      }
    );

    if (
      order.orderContext === "requirement_deal" &&
      order.requirementDeal?.requirementId &&
      order.requirementDeal?.vendorId
    ) {
      const paidAt = new Date();
      const amountPaid = Number(
        payment.amount ??
          order.totalAmount ??
          order.requirementDeal.totalPayable ??
          order.requirementDeal.confirmedPrice ??
          0
      );
      const requirementId = order.requirementDeal.requirementId;
      const vendorId = order.requirementDeal.vendorId;

      const [customer, vendor, requirement] = await Promise.all([
        User.findById(order.user).select("_id fullName email"),
        User.findById(vendorId).select("_id fullName email"),
        UserRequirement.findById(requirementId).select("_id title checkIn checkOut numberOfGuests"),
      ]);

      if (customer?._id && vendor?._id && requirement?._id) {
        await Message.create({
          requirementId: requirement._id,
          sender: customer._id,
          receiver: vendor._id,
          message: `Booking confirmed at INR ${amountPaid}.`,
          kind: "system",
          priceAmount: amountPaid,
        });
      }

      const emailTasks: Promise<unknown>[] = [];
      const requirementTitle = requirement?.title || "Requirement";

      if (customer?.email) {
        emailTasks.push(
          mailSender(
            customer.email,
            "SafarHub booking confirmed",
            requirementPaymentEmailTemplate({
              heading: "Booking Confirmed",
              recipientName: customer.fullName || "Customer",
              requirementTitle,
              amount: amountPaid,
              paidAt,
              checkIn: requirement?.checkIn || null,
              checkOut: requirement?.checkOut || null,
              numberOfGuests: requirement?.numberOfGuests ?? null,
            })
          )
        );
      }

      if (vendor?.email) {
        emailTasks.push(
          mailSender(
            vendor.email,
            "SafarHub booking confirmed for your requirement deal",
            requirementPaymentEmailTemplate({
              heading: "Booking Confirmed",
              recipientName: vendor.fullName || "Vendor",
              requirementTitle,
              amount: amountPaid,
              paidAt,
              checkIn: requirement?.checkIn || null,
              checkOut: requirement?.checkOut || null,
              numberOfGuests: requirement?.numberOfGuests ?? null,
            })
          )
        );
      }

      const adminEmails = new Set<string>();
      if (process.env.ADMIN_EMAIL) {
        adminEmails.add(process.env.ADMIN_EMAIL);
      }

      const admins = await User.find({ accountType: "admin" }).select("email").lean();
      admins.forEach((admin: any) => {
        if (admin?.email) {
          adminEmails.add(admin.email);
        }
      });

      adminEmails.forEach((adminEmail) => {
        emailTasks.push(
          mailSender(
            adminEmail,
            "SafarHub requirement deal booking confirmed",
            requirementPaymentEmailTemplate({
              heading: "Booking Confirmed",
              recipientName: "Admin",
              requirementTitle,
              amount: amountPaid,
              paidAt,
              checkIn: requirement?.checkIn || null,
              checkOut: requirement?.checkOut || null,
              numberOfGuests: requirement?.numberOfGuests ?? null,
            })
          )
        );
      });

      await Promise.allSettled(emailTasks);
    }

    return NextResponse.json({ success: true, message: "Payment verified" });
  } catch (error: any) {
    console.error("Verify Razorpay payment error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
});
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import UserRequirement from "@/models/Userrequirement";
import User from "@/models/User";
import UserAddress from "@/models/UserAddress";
import Order from "@/models/Order";
import Booking from "@/models/Booking";

const SERVICE_CATEGORY_TO_BOOKING_TYPE: Record<string, "stay" | "tour" | "adventure" | "vehicle"> = {
  stays: "stay",
  tour: "tour",
  tours: "tour",
  adventure: "adventure",
  "vehicle-rental": "vehicle",
};

const REQUIREMENT_COMMISSION_RATE = 2.5;

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function resolveRequirementBookingType(categories: string[] = []) {
  for (const category of categories) {
    if (SERVICE_CATEGORY_TO_BOOKING_TYPE[category]) {
      return SERVICE_CATEGORY_TO_BOOKING_TYPE[category];
    }
  }
  return null;
}

export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    const requesterUserId = String(user?.id || user?._id || "");
    if (!requesterUserId || !mongoose.Types.ObjectId.isValid(requesterUserId)) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    const { requirementId, vendorId, amount } = await req.json();

    if (!requirementId || !vendorId) {
      return NextResponse.json(
        { success: false, message: "requirementId and vendorId are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(requirementId) || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return NextResponse.json(
        { success: false, message: "Invalid requirementId or vendorId" },
        { status: 400 }
      );
    }

    const confirmedAmount = Number(amount);
    if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid amount is required" },
        { status: 400 }
      );
    }

    const baseAmount = roundToTwo(confirmedAmount);
    const commissionAmount = roundToTwo((baseAmount * REQUIREMENT_COMMISSION_RATE) / 100);
    const totalPayable = roundToTwo(baseAmount + commissionAmount);

    const requirement = await UserRequirement.findById(requirementId).select(
      "_id user title categories checkIn checkOut numberOfGuests"
    );
    if (!requirement) {
      return NextResponse.json(
        { success: false, message: "Requirement not found" },
        { status: 404 }
      );
    }

    if (String(requirement.user) !== requesterUserId) {
      return NextResponse.json(
        { success: false, message: "You can only pay for your own requirement" },
        { status: 403 }
      );
    }

    const vendor = await User.findOne({ _id: vendorId, accountType: "vendor" }).select("_id");
    if (!vendor) {
      return NextResponse.json(
        { success: false, message: "Vendor not found" },
        { status: 404 }
      );
    }

    const addressRecord = await UserAddress.findOne({
      $or: [
        { user: requesterUserId },
        { user: new mongoose.Types.ObjectId(requesterUserId) },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    let address: any = Array.isArray(addressRecord) ? addressRecord[0] : addressRecord;

    // Legacy fallback: some users may only have addresses in profile.additionalDetails.addresses.
    if (!address) {
      const userDoc = await User.findById(requesterUserId)
        .populate({ path: "additionalDetails", select: "addresses" })
        .select("fullName contactNumber additionalDetails")
        .lean();

      const profileAddresses = Array.isArray((userDoc as any)?.additionalDetails?.addresses)
        ? (userDoc as any).additionalDetails.addresses
        : [];

      const legacyAddress = profileAddresses.find((entry: any) => entry && typeof entry === "object");
      if (legacyAddress) {
        const mappedAddress = {
          name: legacyAddress.name || (userDoc as any)?.fullName,
          phone: legacyAddress.phone || (userDoc as any)?.contactNumber,
          pincode: legacyAddress.pincode || legacyAddress.postalCode || legacyAddress.zip,
          address: legacyAddress.address || legacyAddress.street || legacyAddress.addressLine,
          city: legacyAddress.city,
          state: legacyAddress.state,
          landmark: legacyAddress.landmark,
        };

        if (
          mappedAddress.name &&
          mappedAddress.phone &&
          mappedAddress.pincode &&
          mappedAddress.address &&
          mappedAddress.city &&
          mappedAddress.state
        ) {
          address = mappedAddress;

          // Backfill UserAddress collection so future payments don't rely on fallback.
          await UserAddress.create({
            user: requesterUserId,
            name: mappedAddress.name,
            phone: mappedAddress.phone,
            pincode: mappedAddress.pincode,
            address: mappedAddress.address,
            city: mappedAddress.city,
            state: mappedAddress.state,
            landmark: mappedAddress.landmark,
          });
        }
      }
    }

    // Last-resort fallback: reuse last order delivery address for this user.
    if (!address) {
      const lastOrder = await Order.findOne({ user: requesterUserId })
        .select("address")
        .sort({ createdAt: -1 })
        .lean();

      if ((lastOrder as any)?.address) {
        address = (lastOrder as any).address;
      }
    }

    if (!address) {
      return NextResponse.json(
        { success: false, message: "Please add an address before making payment" },
        { status: 400 }
      );
    }

    const order = await Order.create({
      user: requesterUserId,
      items: [
        {
          itemId: requirement._id,
          itemType: "Requirement",
          quantity: 1,
          status: "Pending",
          deliveryDate: null,
        },
      ],
      totalAmount: totalPayable,
      deliveryCharge: 0,
      address: {
        name: address.name,
        phone: address.phone,
        pincode: address.pincode,
        address: address.address,
        city: address.city,
        state: address.state,
        landmark: address.landmark,
      },
      status: "Pending",
      orderContext: "requirement_deal",
      requirementDeal: {
        requirementId: requirement._id,
        vendorId: vendor._id,
        confirmedPrice: baseAmount,
        commissionRate: REQUIREMENT_COMMISSION_RATE,
        commissionAmount,
        totalPayable,
      },
    });

    const bookingType = resolveRequirementBookingType((requirement as any).categories || []);
    if (bookingType) {
      const customerProfileRecord = await User.findById(requesterUserId).select("_id fullName email").lean();
      const customerProfile = Array.isArray(customerProfileRecord)
        ? customerProfileRecord[0]
        : customerProfileRecord;

      const now = new Date();
      const reqCheckIn = (requirement as any).checkIn ? new Date((requirement as any).checkIn) : null;
      const reqCheckOut = (requirement as any).checkOut ? new Date((requirement as any).checkOut) : null;

      const start = reqCheckIn ?? now;
      const end = reqCheckOut && reqCheckOut > start ? reqCheckOut : new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
      const adults = Math.max(1, Number((requirement as any).numberOfGuests || 1));

      const bookingPayload: any = {
        serviceType: bookingType,
        vendorId: vendor._id,
        customerId: requesterUserId,
        customer: {
          fullName: customerProfile?.fullName || user.fullName || address.name,
          email: customerProfile?.email || user.email,
          phone: address.phone,
          notes: `Requirement deal: ${(requirement as any).title}`,
        },
        nights,
        guests: {
          adults,
          children: 0,
          infants: 0,
        },
        rooms:
          bookingType === "stay"
            ? [
                {
                  roomName: (requirement as any).title,
                  quantity: 1,
                  pricePerNight: baseAmount,
                  taxes: 0,
                  nights,
                  total: baseAmount,
                  addons: [],
                },
              ]
            : [],
        items:
          bookingType !== "stay"
            ? [
                {
                  itemName: (requirement as any).title,
                  quantity: 1,
                  pricePerUnit: baseAmount,
                  taxes: 0,
                  metadata: {
                    requirementId: requirement._id,
                  },
                },
              ]
            : [],
        currency: "INR",
        subtotal: baseAmount,
        taxes: 0,
        fees: 0,
        totalAmount: baseAmount,
        status: "pending",
        paymentStatus: "pending",
        metadata: {
          source: "requirement_deal",
          requirementPayment: {
            orderId: String(order._id),
            requirementId: String(requirement._id),
            vendorId: String(vendor._id),
            bookingType,
            baseAmount,
            commissionRate: REQUIREMENT_COMMISSION_RATE,
            commissionAmount,
            totalPayable,
          },
          address: `${address.address}, ${address.city}, ${address.state}, ${address.pincode}`,
        },
      };

      if (bookingType === "stay") {
        bookingPayload.checkIn = start;
        bookingPayload.checkOut = end;
      } else if (bookingType === "tour" || bookingType === "adventure") {
        bookingPayload.startDate = start;
        bookingPayload.endDate = end;
      } else if (bookingType === "vehicle") {
        bookingPayload.pickupDate = start;
        bookingPayload.dropoffDate = end;
      }

      await Booking.create(bookingPayload);
    }

    return NextResponse.json({
      success: true,
      orderId: order._id,
      amount: totalPayable,
      baseAmount,
      commissionRate: REQUIREMENT_COMMISSION_RATE,
      commissionAmount,
      totalPayable,
      requirementId: requirement._id,
      vendorId: vendor._id,
    });
  } catch (error: any) {
    console.error("Create requirement payment order error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to create requirement payment order" },
      { status: 500 }
    );
  }
});

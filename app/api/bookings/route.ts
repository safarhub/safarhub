import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/config/database";
import Stay from "@/models/Stay";
import Tour from "@/models/Tour";
import Adventure from "@/models/Adventure";
import VehicleRental from "@/models/VehicleRental";
import Booking from "@/models/Booking";
import Settlement from "@/models/Settlement";
import User from "@/models/User";
import Coupon from "@/models/Coupon";
import LoyaltyScore from "@/models/LoyaltyScore";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import UserRequirement from "@/models/Userrequirement";
import { auth } from "@/lib/middlewares/auth";
import { mailSender } from "@/lib/utils/mailSender";
import bookingUserTemplate from "@/lib/mail/templates/bookingUserTemplate";
import bookingVendorTemplate from "@/lib/mail/templates/bookingVendorTemplate";
import bookingAdminTemplate from "@/lib/mail/templates/bookingAdminTemplate";
import StayBookingLock from "@/models/StayBookingLock";
import ServiceOptionBlock from "@/models/ServiceOptionBlock";
import { computeStayRoomAvailability } from "@/lib/utils/stayAvailability";

function calculateNights(checkIn: Date, checkOut: Date) {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function calculateDays(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      serviceType: rawServiceType,
      stayId,
      tourId,
      adventureId,
      vehicleRentalId,
      checkIn,
      checkOut,
      startDate,
      endDate,
      pickupDate,
      dropoffDate,
      rooms,
      items,
      guests,
      customer,
      currency = "INR",
      notes,
      source = "web",
      couponCode,
    } = body;

    if (!customer?.fullName || !customer?.email) {
      return NextResponse.json({ success: false, message: "Guest name and email are required" }, { status: 400 });
    }

    const serviceType =
      rawServiceType ||
      (stayId ? "stay" : tourId ? "tour" : adventureId ? "adventure" : vehicleRentalId ? "vehicle" : null);

    const token = req.cookies.get("token")?.value;
    let authenticatedUser: any = null;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const authUserId = decoded?.id || decoded?._id;
        if (authUserId && mongoose.Types.ObjectId.isValid(authUserId)) {
          authenticatedUser = await User.findById(authUserId).select("_id email fullName").lean();
        }
      } catch {
        authenticatedUser = null;
      }
    }

    const resolvedCustomerId =
      (body.customerId && mongoose.Types.ObjectId.isValid(body.customerId)
        ? new mongoose.Types.ObjectId(body.customerId)
        : null) || (authenticatedUser?._id ? new mongoose.Types.ObjectId(authenticatedUser._id) : null);

    const providedOrderId = typeof body.orderId === "string" ? body.orderId : null;
    let linkedCatalogOrderId: string | null = null;
    let linkedCatalogOrder: any = null;

    if (!providedOrderId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment is required before booking creation. Provide a paid orderId from checkout.",
        },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(providedOrderId)) {
      return NextResponse.json({ success: false, message: "Invalid order id" }, { status: 400 });
    }

    if (!resolvedCustomerId) {
      return NextResponse.json(
        { success: false, message: "Login is required to link a booking to payment" },
        { status: 401 }
      );
    }

    linkedCatalogOrder = await Order.findOne({
      _id: providedOrderId,
      user: resolvedCustomerId,
    })
      .select("_id orderContext status items")
      .lean();

    if (!linkedCatalogOrder) {
      return NextResponse.json(
        { success: false, message: "Order not found for this user" },
        { status: 404 }
      );
    }

    if ((linkedCatalogOrder as any).orderContext === "requirement_deal") {
      return NextResponse.json(
        { success: false, message: "Requirement deal order cannot be linked here" },
        { status: 400 }
      );
    }

    if ((linkedCatalogOrder as any).status !== "Placed") {
      const capturedPayment = await Payment.findOne({
        orderId: providedOrderId,
        userId: resolvedCustomerId,
        status: "captured",
      })
        .select("_id")
        .lean();

      if (!capturedPayment) {
        return NextResponse.json(
          {
            success: false,
            message: "Payment not verified for this order. Complete payment before booking.",
          },
          { status: 402 }
        );
      }

      await Order.updateOne(
        { _id: providedOrderId, user: resolvedCustomerId },
        { $set: { status: "Placed" } }
      );

      linkedCatalogOrder = {
        ...(linkedCatalogOrder as any),
        status: "Placed",
      };
    }

    linkedCatalogOrderId = (linkedCatalogOrder as any)._id.toString();

    if (!serviceType) {
      return NextResponse.json({ success: false, message: "A valid service type or reference id is required" }, { status: 400 });
    }

    let bookingPayload: any = {
      serviceType,
      customerId: resolvedCustomerId,
      customer: {
        fullName: customer.fullName || authenticatedUser?.fullName || "Guest",
        email: customer.email || authenticatedUser?.email,
        phone: customer.phone,
        notes: customer.notes,
      },
      currency,
      fees: Number(body.fees ?? 0),
      status: "confirmed",
      paymentStatus: "paid",
      metadata: {
        source,
        notes,
        bookedByUserId: resolvedCustomerId,
        bookedByEmail: authenticatedUser?.email ?? null,
        catalogPayment: { orderId: linkedCatalogOrderId },
      },
    };

    const orderItemTypeByService: Record<string, string> = {
      stay: "Stay",
      tour: "Tour",
      adventure: "Adventure",
      vehicle: "VehicleRental",
    };

    const requestedServiceRef =
      serviceType === "stay"
        ? stayId
        : serviceType === "tour"
          ? tourId
          : serviceType === "adventure"
            ? adventureId
            : vehicleRentalId;

    const expectedOrderItemType = orderItemTypeByService[serviceType];
    const hasMatchingPaidItem = Array.isArray((linkedCatalogOrder as any)?.items)
      ? (linkedCatalogOrder as any).items.some((item: any) => {
          const itemRef = item?.itemId?.toString?.() || item?.itemId;
          return item?.itemType === expectedOrderItemType && itemRef?.toString() === requestedServiceRef?.toString();
        })
      : false;

    if (!hasMatchingPaidItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The paid order does not match this booking item. Please pay for this service from checkout first.",
        },
        { status: 400 }
      );
    }

    const parsedGuests = {
      adults: Number(guests?.adults ?? 1),
      children: Number(guests?.children ?? 0),
      infants: Number(guests?.infants ?? 0),
    };

    const customerObjectId = resolvedCustomerId;

    const getLoyaltyDiscount = async (invoiceAmount: number) => {
      if (!customerObjectId || invoiceAmount < 4000) {
        return { amount: 0, percent: 0 };
      }

      const loyaltyDoc = await LoyaltyScore.findOne({
        userId: customerObjectId,
        accountType: "user",
      }).lean();

      const percent = Math.max(0, Number((loyaltyDoc as any)?.currentDiscount ?? 0));
      if (percent <= 0) {
        return { amount: 0, percent: 0 };
      }

      return {
        amount: Math.min(invoiceAmount, (invoiceAmount * percent) / 100),
        percent,
      };
    };

    let subtotal = 0;
    let taxes = 0;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    const makeDateRangeText = (start: Date, end: Date) =>
      `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;

    const sendBookingEmails = async (booking: any, context: { start: Date; end: Date }) => {
      try {
        const vendor = await User.findById(booking.vendorId);
        const vendorName = vendor?.fullName || "Vendor";
        const vendorEmail = vendor?.email;

        const checkInOutText = makeDateRangeText(context.start, context.end);

        const emailTasks: Promise<unknown>[] = [];

        // User email
        emailTasks.push(
          mailSender(
            booking.customer.email,
            "Your SafarHub booking request is received",
            bookingUserTemplate({
              fullName: booking.customer.fullName,
              email: booking.customer.email,
              serviceType: booking.serviceType,
              referenceCode: booking._id.toString(),
              checkInOutText,
              totalAmount: booking.totalAmount,
              currency: booking.currency,
            })
          )
        );

        // Vendor email
        if (vendorEmail) {
          emailTasks.push(
            mailSender(
              vendorEmail,
              "New SafarHub booking received",
              bookingVendorTemplate({
                vendorName,
                vendorEmail,
                serviceType: booking.serviceType,
                referenceCode: booking._id.toString(),
                customerName: booking.customer.fullName,
                customerEmail: booking.customer.email,
                customerPhone: booking.customer.phone,
                checkInOutText,
                totalAmount: booking.totalAmount,
                currency: booking.currency,
              })
            )
          );
        }

        // Admin email
        if (ADMIN_EMAIL && vendorEmail) {
          emailTasks.push(
            mailSender(
              ADMIN_EMAIL,
              "SafarHub booking created",
              bookingAdminTemplate({
                serviceType: booking.serviceType,
                referenceCode: booking._id.toString(),
                customerName: booking.customer.fullName,
                customerEmail: booking.customer.email,
                vendorName,
                vendorEmail,
                totalAmount: booking.totalAmount,
                currency: booking.currency,
              })
            )
          );
        }

        await Promise.allSettled(emailTasks);
      } catch (emailError) {
        console.error("Booking email error:", emailError);
      }
    };

    if (serviceType === "stay") {
      if (!stayId || !mongoose.Types.ObjectId.isValid(stayId)) {
        return NextResponse.json({ success: false, message: "Invalid stay id" }, { status: 400 });
      }

      if (!Array.isArray(rooms) || rooms.length === 0) {
        return NextResponse.json({ success: false, message: "At least one room booking is required" }, { status: 400 });
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        return NextResponse.json({ success: false, message: "Invalid check-in/out dates" }, { status: 400 });
      }

      const stay = await Stay.findById(stayId);
      if (!stay || !stay.isActive) {
        return NextResponse.json({ success: false, message: "Stay not found" }, { status: 404 });
      }

      try {
        await StayBookingLock.create({
          stayId: stay._id,
          expiresAt: new Date(Date.now() + 45 * 1000),
        });
      } catch (lockError: any) {
        if (lockError?.code === 11000) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Another booking is being processed for this stay. Please retry in a few seconds.",
            },
            { status: 409 }
          );
        }
        throw lockError;
      }

      try {
        const nights = calculateNights(checkInDate, checkOutDate);
        const requestedGuestCount =
          Math.max(0, Number(parsedGuests.adults || 0)) +
          Math.max(0, Number(parsedGuests.children || 0)) +
          Math.max(0, Number(parsedGuests.infants || 0));
        let selectedCapacity = 0;

        const isBnbUnit = stay.category === "bnbs" && Boolean(stay.bnb);
        const bnbRoomName =
          isBnbUnit && stay.bnb
            ? stay.bnb.unitType || stay.name
            : null;

        const stayRoomInventory = isBnbUnit && bnbRoomName
          ? [
              {
                _id: undefined,
                name: bnbRoomName,
                available: 1,
              },
            ]
          : stay.rooms.map((room: any) => ({
              _id: room._id,
              name: room.name,
              available: Number(room.available || 0),
            }));

        const stayAvailability = await computeStayRoomAvailability({
          stayId: stay._id.toString(),
          rooms: stayRoomInventory,
          startDate: checkInDate,
          endDate: checkOutDate,
        });

        const normalizedRooms: any[] = [];
        for (const requested of rooms) {
          const stayRoom = isBnbUnit && stay.bnb
            ? {
                _id: undefined,
                name: bnbRoomName || stay.bnb.unitType || stay.name,
                price: stay.bnb.price,
                taxes: 0,
                capacity: stay.bnb.capacity || 0,
              }
            : stay.rooms.id(requested.roomId) ||
              stay.rooms.find((room: any) => room.name === requested.roomName);

          if (!stayRoom) {
            return NextResponse.json(
              { success: false, message: `Room ${requested.roomName || requested.roomId} not found` },
              { status: 400 }
            );
          }

          const quantity = Number(requested.quantity ?? 1);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return NextResponse.json({ success: false, message: "Invalid room quantity" }, { status: 400 });
          }

          if (isBnbUnit && quantity > 1) {
            return NextResponse.json(
              {
                success: false,
                message: `Only 1 room(s) available for ${stayRoom.name} on selected dates`,
              },
              { status: 409 }
            );
          }

          const roomKey = isBnbUnit
            ? bnbRoomName || stayRoom.name
            : stayRoom._id
              ? stayRoom._id.toString()
              : stayRoom.name;
          const maxAvailableForRange = Number(stayAvailability.availableOptionQuantities[roomKey] || 0);

          if (quantity > maxAvailableForRange) {
            return NextResponse.json(
              {
                success: false,
                message: `Only ${maxAvailableForRange} room(s) available for ${stayRoom.name} on selected dates`,
              },
              { status: 409 }
            );
          }

          const pricePerNight = Number(
            requested.pricePerNight ?? stayRoom.price ?? stay.bnb?.price ?? 0
          );
          const roomTaxes = Number(requested.taxes ?? stayRoom.taxes ?? 0);
          const total = (pricePerNight + roomTaxes) * quantity * nights;
          selectedCapacity += Number(stayRoom.capacity || 0) * quantity;

          subtotal += pricePerNight * quantity * nights;
          taxes += roomTaxes * quantity * nights;

          normalizedRooms.push({
            roomId: stayRoom._id,
            roomName: stayRoom.name,
            quantity,
            pricePerNight,
            taxes: roomTaxes,
            nights,
            total,
            addons: Array.isArray(requested.addons) ? requested.addons : [],
          });
        }

        if (requestedGuestCount > selectedCapacity) {
          return NextResponse.json(
            {
              success: false,
              message: `Only capacity for ${selectedCapacity} guest(s) is available with selected rooms`,
            },
            { status: 409 }
          );
        }

      // Apply Coupon
      let discountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        appliedCoupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });

        if (appliedCoupon) {
          const now = new Date();
          const subtotalForCoupon = subtotal + taxes; // Determine if taxes are included in minPurchase
          if (
            appliedCoupon.startDate <= now &&
            appliedCoupon.expiryDate >= now &&
            subtotalForCoupon >= appliedCoupon.minPurchase &&
            (!appliedCoupon.usageLimit || appliedCoupon.usageCount < appliedCoupon.usageLimit)
          ) {
            if (appliedCoupon.discountType === "percentage") {
              discountAmount = (subtotalForCoupon * appliedCoupon.discountAmount) / 100;
              if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
                discountAmount = appliedCoupon.maxDiscount;
              }
            } else {
              discountAmount = appliedCoupon.discountAmount;
            }
            discountAmount = Math.min(discountAmount, subtotalForCoupon);
          }
        }
      }

        const baseAmount = subtotal + taxes + bookingPayload.fees;
        const { amount: loyaltyDiscountAmount, percent: loyaltyDiscountPercent } =
          await getLoyaltyDiscount(baseAmount);
        const combinedDiscountAmount = discountAmount + loyaltyDiscountAmount;
        const finalDiscountAmount = Math.min(baseAmount, combinedDiscountAmount);
        const discountSource =
          discountAmount > 0 && loyaltyDiscountAmount > 0
            ? "coupon+loyalty"
            : discountAmount > 0
              ? "coupon"
              : loyaltyDiscountAmount > 0
                ? "loyalty"
                : null;

        bookingPayload = {
          ...bookingPayload,
          stayId: stay._id,
          vendorId: stay.vendorId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          guests: parsedGuests,
          rooms: normalizedRooms,
          items: [],
          subtotal,
          taxes,
          totalAmount: baseAmount - finalDiscountAmount,
          couponCode: appliedCoupon && discountAmount > 0 ? appliedCoupon.code : null,
          discountAmount: finalDiscountAmount,
          metadata: {
            ...bookingPayload.metadata,
            discountSource,
            couponDiscountAmount: discountAmount,
            loyaltyDiscountAmount,
            loyaltyDiscountPercent,
          },
        };

        const booking = await Booking.create(bookingPayload);

        if (appliedCoupon && discountAmount > 0) {
          await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usageCount: 1 } });
        }

        const settlementDueDate = new Date(checkOutDate);
        settlementDueDate.setDate(settlementDueDate.getDate() + 7);

        await Settlement.create({
          bookingId: booking._id,
          stayId: stay._id,
          vendorId: stay.vendorId,
          amountDue: booking.totalAmount,
          amountPaid: 0,
          currency,
          scheduledDate: settlementDueDate,
          status: "pending",
          notes: "Auto-generated from booking",
        });

        await sendBookingEmails(booking, { start: checkInDate, end: checkOutDate });

        return NextResponse.json({ success: true, booking });
      } finally {
        await StayBookingLock.deleteOne({ stayId: stay._id });
      }
    }

    if (serviceType === "tour") {
      if (!tourId || !mongoose.Types.ObjectId.isValid(tourId)) {
        return NextResponse.json({ success: false, message: "Invalid tour id" }, { status: 400 });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, message: "Select at least one tour option" }, { status: 400 });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return NextResponse.json({ success: false, message: "Invalid start/end dates" }, { status: 400 });
      }

      const tour = await Tour.findById(tourId);
      if (!tour || !(tour as any).isActive) {
        return NextResponse.json({ success: false, message: "Tour not found" }, { status: 404 });
      }

      const tourCategory = String((tour as any).category || "");
      const isPackageTour = tourCategory === "tour-packages";
      const totalGuestCount =
        Math.max(0, Number(parsedGuests.adults || 0)) +
        Math.max(0, Number(parsedGuests.children || 0)) +
        Math.max(0, Number(parsedGuests.infants || 0));

      if (totalGuestCount <= 0) {
        return NextResponse.json(
          { success: false, message: "At least one guest is required for tour booking" },
          { status: 400 }
        );
      }

      const days = calculateDays(start, end);

      const overlappingBookings = await Booking.find(
        {
          status: { $ne: "cancelled" },
          tourId: tour._id,
          startDate: { $lt: end },
          endDate: { $gt: start },
        },
        "guests.adults guests.children guests.infants items.itemId items.itemName items.quantity"
      ).lean();

      const overlappingBlocks = await ServiceOptionBlock.find(
        {
          serviceType: "tour",
          serviceId: tour._id,
          isActive: true,
          startDate: { $lt: end },
          endDate: { $gt: start },
        },
        "optionId optionName blockedCount"
      ).lean();

      const occupiedOptionKeys = new Set<string>();
      const occupiedSeatsByOption = new Map<string, number>();
      const blockedSeatsByOption = new Map<string, number>();
      overlappingBookings.forEach((booking) => {
        const bookedGuestsCount =
          Math.max(0, Number((booking as any)?.guests?.adults || 0)) +
          Math.max(0, Number((booking as any)?.guests?.children || 0)) +
          Math.max(0, Number((booking as any)?.guests?.infants || 0));

        booking.items?.forEach((item: any) => {
          const key = item.itemId ? item.itemId.toString() : item.itemName;
          if (!key) return;
          occupiedOptionKeys.add(key);

          const seatsForThisItem = Math.max(
            1,
            bookedGuestsCount,
            Number(item?.quantity || 0)
          );
          occupiedSeatsByOption.set(key, (occupiedSeatsByOption.get(key) || 0) + seatsForThisItem);
        });
      });

      overlappingBlocks.forEach((block: any) => {
        const key = block?.optionId?.toString?.() || block?.optionName;
        if (!key) return;
        const blockedQty = Math.max(1, Number(block?.blockedCount || 0));
        blockedSeatsByOption.set(key, (blockedSeatsByOption.get(key) || 0) + blockedQty);
      });

      const normalizedItems = items.map((requested: any) => {
        const option =
          tour.options.id(requested.optionId) ||
          tour.options.find((opt: any) => opt.name === requested.optionName);
        if (!option) {
          throw new Error(`Option ${requested.optionName || requested.optionId} not found`);
        }

        const quantity = Number(requested.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Invalid option quantity");
        }

        if (isPackageTour && quantity !== 1) {
          throw new Error("Package tours must be booked as a single full package option");
        }

        if (totalGuestCount > Number(option.capacity || 0)) {
          throw new Error(
            `Selected guests (${totalGuestCount}) exceed capacity (${option.capacity}) for ${option.name}`
          );
        }

        const optionKey = option._id ? option._id.toString() : option.name;
        const seatsRequested = isPackageTour
          ? totalGuestCount
          : Math.max(totalGuestCount, quantity);

        if (isPackageTour) {
          const blockedQty = optionKey ? blockedSeatsByOption.get(optionKey) || 0 : 0;
          if (optionKey && (occupiedOptionKeys.has(optionKey) || blockedQty > 0)) {
            throw new Error(`${option.name} is already booked for the selected dates`);
          }
        } else {
          const occupiedSeats = optionKey ? occupiedSeatsByOption.get(optionKey) || 0 : 0;
          const blockedSeats = optionKey ? blockedSeatsByOption.get(optionKey) || 0 : 0;
          const remainingSeats = Math.max(0, Number(option.capacity || 0) - occupiedSeats - blockedSeats);
          if (seatsRequested > remainingSeats) {
            throw new Error(
              `Only ${remainingSeats} seat(s) are left for ${option.name} on selected dates`
            );
          }
        }

        const pricePerUnit = Number(requested.price ?? option.price);
        const optionTaxes = Number(requested.taxes ?? option.taxes ?? 0);
        subtotal += pricePerUnit * quantity * days;
        taxes += optionTaxes * quantity * days;

        return {
          itemId: option._id,
          itemName: option.name,
          quantity,
          pricePerUnit,
          taxes: optionTaxes,
          metadata: {
            duration: option.duration,
            capacity: option.capacity,
            seatsRequested,
            tourCategory,
          },
        };
      });

      bookingPayload = {
        ...bookingPayload,
        tourId: tour._id,
        vendorId: tour.vendorId,
        startDate: start,
        endDate: end,
        nights: days,
        guests: parsedGuests,
        rooms: [],
        items: normalizedItems,
        subtotal,
        taxes,
        totalAmount: subtotal + taxes + bookingPayload.fees,
      };

      // Apply Coupon
      let discountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        appliedCoupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });

        if (appliedCoupon) {
          const now = new Date();
          const subtotalForCoupon = subtotal + taxes;
          if (
            appliedCoupon.startDate <= now &&
            appliedCoupon.expiryDate >= now &&
            subtotalForCoupon >= appliedCoupon.minPurchase &&
            (!appliedCoupon.usageLimit || appliedCoupon.usageCount < appliedCoupon.usageLimit)
          ) {
            if (appliedCoupon.discountType === "percentage") {
              discountAmount = (subtotalForCoupon * appliedCoupon.discountAmount) / 100;
              if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
                discountAmount = appliedCoupon.maxDiscount;
              }
            } else {
              discountAmount = appliedCoupon.discountAmount;
            }
            discountAmount = Math.min(discountAmount, subtotalForCoupon);
          }
        }
      }

      const baseAmount = subtotal + taxes + bookingPayload.fees;
      const { amount: loyaltyDiscountAmount, percent: loyaltyDiscountPercent } =
        await getLoyaltyDiscount(baseAmount);
      const combinedDiscountAmount = discountAmount + loyaltyDiscountAmount;
      const finalDiscountAmount = Math.min(baseAmount, combinedDiscountAmount);
      const discountSource =
        discountAmount > 0 && loyaltyDiscountAmount > 0
          ? "coupon+loyalty"
          : discountAmount > 0
            ? "coupon"
            : loyaltyDiscountAmount > 0
              ? "loyalty"
              : null;

      bookingPayload.totalAmount = baseAmount - finalDiscountAmount;
      bookingPayload.couponCode = appliedCoupon && discountAmount > 0 ? appliedCoupon.code : null;
      bookingPayload.discountAmount = finalDiscountAmount;
      bookingPayload.metadata = {
        ...bookingPayload.metadata,
        tourCategory,
        discountSource,
        couponDiscountAmount: discountAmount,
        loyaltyDiscountAmount,
        loyaltyDiscountPercent,
      };

      const booking = await Booking.create(bookingPayload);

      if (appliedCoupon && discountAmount > 0) {
        await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usageCount: 1 } });
      }

      await sendBookingEmails(booking, { start, end });

      return NextResponse.json({ success: true, booking });
    }

    if (serviceType === "adventure") {
      if (!adventureId || !mongoose.Types.ObjectId.isValid(adventureId)) {
        return NextResponse.json({ success: false, message: "Invalid adventure id" }, { status: 400 });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, message: "Select at least one adventure option" }, { status: 400 });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return NextResponse.json({ success: false, message: "Invalid start/end dates" }, { status: 400 });
      }

      const adventure = await Adventure.findById(adventureId);
      if (!adventure || !(adventure as any).isActive) {
        return NextResponse.json({ success: false, message: "Adventure not found" }, { status: 404 });
      }

      const totalGuestCount =
        Math.max(0, Number(parsedGuests.adults || 0)) +
        Math.max(0, Number(parsedGuests.children || 0)) +
        Math.max(0, Number(parsedGuests.infants || 0));

      const days = calculateDays(start, end);

      const overlappingBookings = await Booking.find(
        {
          status: { $ne: "cancelled" },
          adventureId: adventure._id,
          startDate: { $lt: end },
          endDate: { $gt: start },
        },
        "items.itemId items.itemName items.quantity"
      ).lean();

      const overlappingBlocks = await ServiceOptionBlock.find(
        {
          serviceType: "adventure",
          serviceId: adventure._id,
          isActive: true,
          startDate: { $lt: end },
          endDate: { $gt: start },
        },
        "optionId optionName blockedCount"
      ).lean();

      const occupiedQtyByOption = new Map<string, number>();
      const blockedQtyByOption = new Map<string, number>();
      overlappingBookings.forEach((booking) => {
        booking.items?.forEach((item: any) => {
          const key = item.itemId ? item.itemId.toString() : item.itemName;
          if (!key) return;
          const occupiedQty = Math.max(1, Number(item?.quantity || 0));
          occupiedQtyByOption.set(key, (occupiedQtyByOption.get(key) || 0) + occupiedQty);
        });
      });

      overlappingBlocks.forEach((block: any) => {
        const key = block?.optionId?.toString?.() || block?.optionName;
        if (!key) return;
        const blockedQty = Math.max(1, Number(block?.blockedCount || 0));
        blockedQtyByOption.set(key, (blockedQtyByOption.get(key) || 0) + blockedQty);
      });

      const normalizedItems = items.map((requested: any) => {
        const option =
          adventure.options.id(requested.optionId) ||
          adventure.options.find((opt: any) => opt.name === requested.optionName);
        if (!option) {
          throw new Error(`Option ${requested.optionName || requested.optionId} not found`);
        }

        const quantity = Number(requested.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Invalid option quantity");
        }

        if (totalGuestCount > Number(option.capacity || 0)) {
          throw new Error(
            `Selected guests (${totalGuestCount}) exceed capacity (${option.capacity}) for ${option.name}`
          );
        }

        const optionKey = option._id ? option._id.toString() : option.name;
        const occupiedQty = optionKey ? occupiedQtyByOption.get(optionKey) || 0 : 0;
        const blockedQty = optionKey ? blockedQtyByOption.get(optionKey) || 0 : 0;
        const remainingQty = Math.max(0, Number(option.available || 0) - occupiedQty - blockedQty);
        if (quantity > remainingQty) {
          throw new Error(`Only ${remainingQty} slot(s) are left for ${option.name} on selected dates`);
        }

        const pricePerUnit = Number(requested.price ?? option.price);
        const optionTaxes = Number(requested.taxes ?? option.taxes ?? 0);
        subtotal += pricePerUnit * quantity * days;
        taxes += optionTaxes * quantity * days;

        return {
          itemId: option._id,
          itemName: option.name,
          quantity,
          pricePerUnit,
          taxes: optionTaxes,
          metadata: {
            duration: option.duration,
            difficulty: option.difficulty,
            capacity: option.capacity,
            remainingAtBooking: remainingQty,
          },
        };
      });

      bookingPayload = {
        ...bookingPayload,
        adventureId: adventure._id,
        vendorId: adventure.vendorId,
        startDate: start,
        endDate: end,
        nights: days,
        guests: parsedGuests,
        rooms: [],
        items: normalizedItems,
        subtotal,
        taxes,
        totalAmount: subtotal + taxes + bookingPayload.fees,
      };

      // Apply Coupon
      let discountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        appliedCoupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });

        if (appliedCoupon) {
          const now = new Date();
          const subtotalForCoupon = subtotal + taxes;
          if (
            appliedCoupon.startDate <= now &&
            appliedCoupon.expiryDate >= now &&
            subtotalForCoupon >= appliedCoupon.minPurchase &&
            (!appliedCoupon.usageLimit || appliedCoupon.usageCount < appliedCoupon.usageLimit)
          ) {
            if (appliedCoupon.discountType === "percentage") {
              discountAmount = (subtotalForCoupon * appliedCoupon.discountAmount) / 100;
              if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
                discountAmount = appliedCoupon.maxDiscount;
              }
            } else {
              discountAmount = appliedCoupon.discountAmount;
            }
            discountAmount = Math.min(discountAmount, subtotalForCoupon);
          }
        }
      }

      const baseAmount = subtotal + taxes + bookingPayload.fees;
      const { amount: loyaltyDiscountAmount, percent: loyaltyDiscountPercent } =
        await getLoyaltyDiscount(baseAmount);
      const combinedDiscountAmount = discountAmount + loyaltyDiscountAmount;
      const finalDiscountAmount = Math.min(baseAmount, combinedDiscountAmount);
      const discountSource =
        discountAmount > 0 && loyaltyDiscountAmount > 0
          ? "coupon+loyalty"
          : discountAmount > 0
            ? "coupon"
            : loyaltyDiscountAmount > 0
              ? "loyalty"
              : null;

      bookingPayload.totalAmount = baseAmount - finalDiscountAmount;
      bookingPayload.couponCode = appliedCoupon && discountAmount > 0 ? appliedCoupon.code : null;
      bookingPayload.discountAmount = finalDiscountAmount;
      bookingPayload.metadata = {
        ...bookingPayload.metadata,
        discountSource,
        couponDiscountAmount: discountAmount,
        loyaltyDiscountAmount,
        loyaltyDiscountPercent,
      };

      const booking = await Booking.create(bookingPayload);

      if (appliedCoupon && discountAmount > 0) {
        await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usageCount: 1 } });
      }

      await sendBookingEmails(booking, { start, end });

      return NextResponse.json({ success: true, booking });
    }

    if (serviceType === "vehicle") {
      if (!vehicleRentalId || !mongoose.Types.ObjectId.isValid(vehicleRentalId)) {
        return NextResponse.json({ success: false, message: "Invalid vehicle rental id" }, { status: 400 });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, message: "Select at least one vehicle" }, { status: 400 });
      }

      const pickup = new Date(pickupDate);
      const dropoff = new Date(dropoffDate);
      if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime()) || dropoff <= pickup) {
        return NextResponse.json({ success: false, message: "Invalid pickup/dropoff dates" }, { status: 400 });
      }

      const rental = await VehicleRental.findById(vehicleRentalId);
      if (!rental || !(rental as any).isActive) {
        return NextResponse.json({ success: false, message: "Vehicle rental not found" }, { status: 404 });
      }

      const days = calculateDays(pickup, dropoff);

      const overlappingBookings = await Booking.find(
        {
          status: { $ne: "cancelled" },
          vehicleRentalId: rental._id,
          pickupDate: { $lt: dropoff },
          dropoffDate: { $gt: pickup },
        },
        "items.itemId items.itemName items.quantity"
      ).lean();

      const overlappingBlocks = await ServiceOptionBlock.find(
        {
          serviceType: "vehicle",
          serviceId: rental._id,
          isActive: true,
          startDate: { $lt: dropoff },
          endDate: { $gt: pickup },
        },
        "optionId optionName blockedCount"
      ).lean();

      const occupiedQtyByVehicle = new Map<string, number>();
      const blockedQtyByVehicle = new Map<string, number>();
      overlappingBookings.forEach((booking) => {
        booking.items?.forEach((item: any) => {
          const key = item.itemId ? item.itemId.toString() : item.itemName;
          if (!key) return;
          const occupiedQty = Math.max(1, Number(item?.quantity || 0));
          occupiedQtyByVehicle.set(key, (occupiedQtyByVehicle.get(key) || 0) + occupiedQty);
        });
      });

      overlappingBlocks.forEach((block: any) => {
        const key = block?.optionId?.toString?.() || block?.optionName;
        if (!key) return;
        const blockedQty = Math.max(1, Number(block?.blockedCount || 0));
        blockedQtyByVehicle.set(key, (blockedQtyByVehicle.get(key) || 0) + blockedQty);
      });

      const normalizedItems = items.map((requested: any) => {
        const option =
          rental.options.id(requested.optionId) ||
          rental.options.find(
            (opt: any) =>
              (opt._id?.toString() ?? opt.model) === requested.optionId ||
              opt.model === requested.optionName
          );
        if (!option) {
          throw new Error(`Vehicle ${requested.optionName || requested.optionId} not found`);
        }

        const quantity = Number(requested.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Invalid vehicle quantity");
        }

        const optionKey = option._id ? option._id.toString() : option.model;
        const occupiedQty = optionKey ? occupiedQtyByVehicle.get(optionKey) || 0 : 0;
        const blockedQty = optionKey ? blockedQtyByVehicle.get(optionKey) || 0 : 0;
        const remainingQty = Math.max(0, Number(option.available || 0) - occupiedQty - blockedQty);
        if (quantity > remainingQty) {
          throw new Error(`Only ${remainingQty} vehicle(s) are left for ${option.model} on selected dates`);
        }

        const pricePerUnit = Number(requested.price ?? requested.pricePerDay ?? option.pricePerDay);
        const optionTaxes = Number(requested.taxes ?? option.taxes ?? 0);
        subtotal += pricePerUnit * quantity * days;
        taxes += optionTaxes * quantity * days;

        return {
          itemId: option._id,
          itemName: option.model,
          quantity,
          pricePerUnit,
          taxes: optionTaxes,
          metadata: {
            type: option.type,
            remainingAtBooking: remainingQty,
          },
        };
      });

      bookingPayload = {
        ...bookingPayload,
        vehicleRentalId: rental._id,
        vendorId: rental.vendorId,
        pickupDate: pickup,
        dropoffDate: dropoff,
        nights: days,
        guests: parsedGuests,
        rooms: [],
        items: normalizedItems,
        subtotal,
        taxes,
        totalAmount: subtotal + taxes + bookingPayload.fees,
      };

      // Apply Coupon
      let discountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        appliedCoupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });

        if (appliedCoupon) {
          const now = new Date();
          const subtotalForCoupon = subtotal + taxes;
          if (
            appliedCoupon.startDate <= now &&
            appliedCoupon.expiryDate >= now &&
            subtotalForCoupon >= appliedCoupon.minPurchase &&
            (!appliedCoupon.usageLimit || appliedCoupon.usageCount < appliedCoupon.usageLimit)
          ) {
            if (appliedCoupon.discountType === "percentage") {
              discountAmount = (subtotalForCoupon * appliedCoupon.discountAmount) / 100;
              if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
                discountAmount = appliedCoupon.maxDiscount;
              }
            } else {
              discountAmount = appliedCoupon.discountAmount;
            }
            discountAmount = Math.min(discountAmount, subtotalForCoupon);
          }
        }
      }

      const baseAmount = subtotal + taxes + bookingPayload.fees;
      const { amount: loyaltyDiscountAmount, percent: loyaltyDiscountPercent } =
        await getLoyaltyDiscount(baseAmount);
      const combinedDiscountAmount = discountAmount + loyaltyDiscountAmount;
      const finalDiscountAmount = Math.min(baseAmount, combinedDiscountAmount);
      const discountSource =
        discountAmount > 0 && loyaltyDiscountAmount > 0
          ? "coupon+loyalty"
          : discountAmount > 0
            ? "coupon"
            : loyaltyDiscountAmount > 0
              ? "loyalty"
              : null;

      bookingPayload.totalAmount = baseAmount - finalDiscountAmount;
      bookingPayload.couponCode = appliedCoupon && discountAmount > 0 ? appliedCoupon.code : null;
      bookingPayload.discountAmount = finalDiscountAmount;
      bookingPayload.metadata = {
        ...bookingPayload.metadata,
        discountSource,
        couponDiscountAmount: discountAmount,
        loyaltyDiscountAmount,
        loyaltyDiscountPercent,
      };

      const booking = await Booking.create(bookingPayload);

      if (appliedCoupon && discountAmount > 0) {
        await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usageCount: 1 } });
      }

      await sendBookingEmails(booking, { start: pickup, end: dropoff });

      return NextResponse.json({ success: true, booking });
    }

    return NextResponse.json({ success: false, message: "Unsupported service type" }, { status: 400 });
  } catch (error: any) {
    console.error("Booking creation error", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create booking" },
      { status: 500 }
    );
  }
}

export const GET = auth(async (req: NextRequest, context: any) => {
  try {
    await dbConnect();
    const user = (req as any).user;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const vendorIdParam = searchParams.get("vendorId");

    const query: any = {};

    if (status) query.status = status;

    const bookingTypeByCategory: Record<string, "stay" | "tour" | "adventure" | "vehicle"> = {
      stays: "stay",
      tour: "tour",
      tours: "tour",
      adventure: "adventure",
      "vehicle-rental": "vehicle",
    };

    const resolveRequirementBookingType = (categories: string[] = []) => {
      for (const category of categories) {
        if (bookingTypeByCategory[category]) return bookingTypeByCategory[category];
      }
      return null;
    };

    if (user.accountType === "admin") {
      if (vendorIdParam) {
        if (!mongoose.Types.ObjectId.isValid(vendorIdParam)) {
          return NextResponse.json(
            { success: false, message: "Invalid vendor id" },
            { status: 400 }
          );
        }
        query.vendorId = vendorIdParam;
      }
    } else if (user.accountType === "vendor") {
      query.vendorId = user.id;
    } else {
      const requirementDealOrders = await Order.find({
        user: user.id,
        orderContext: "requirement_deal",
      })
        .select("_id user status totalAmount address requirementDeal")
        .lean();

      if (requirementDealOrders.length > 0) {
        const requirementIds = Array.from(
          new Set(
            requirementDealOrders
              .map((order: any) => order.requirementDeal?.requirementId?.toString())
              .filter(Boolean)
          )
        );

        const requirements = requirementIds.length
          ? await UserRequirement.find({ _id: { $in: requirementIds } })
              .select("_id title categories checkIn checkOut numberOfGuests")
              .lean()
          : [];

        const requirementById = new Map(
          requirements.map((reqDoc: any) => [reqDoc._id.toString(), reqDoc])
        );

        for (const order of requirementDealOrders as any[]) {
          const requirementId = order.requirementDeal?.requirementId?.toString();
          const vendorId = order.requirementDeal?.vendorId;
          if (!requirementId || !vendorId) continue;

          const requirement = requirementById.get(requirementId) as any;
          if (!requirement) continue;

          const bookingType = resolveRequirementBookingType(Array.isArray(requirement.categories) ? requirement.categories : []);
          if (!bookingType) continue;

          const existingMirror = await Booking.findOne({
            customerId: user.id,
            "metadata.requirementPayment.orderId": order._id.toString(),
          }).select("_id");

          if (existingMirror) continue;

          const amount = Number(order.requirementDeal?.confirmedPrice || order.totalAmount || 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;

          const now = new Date();
          const reqCheckIn = requirement.checkIn ? new Date(requirement.checkIn) : null;
          const reqCheckOut = requirement.checkOut ? new Date(requirement.checkOut) : null;
          const start = reqCheckIn ?? now;
          const end = reqCheckOut && reqCheckOut > start ? reqCheckOut : new Date(start.getTime() + 24 * 60 * 60 * 1000);
          const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
          const adults = Math.max(1, Number(requirement.numberOfGuests || 1));

          const mirrorPayload: any = {
            serviceType: bookingType,
            vendorId,
            customerId: user.id,
            customer: {
              fullName: user.fullName || order.address?.name || "Customer",
              email: user.email,
              phone: order.address?.phone,
              notes: `Requirement deal: ${requirement.title}`,
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
                      roomName: requirement.title,
                      quantity: 1,
                      pricePerNight: amount,
                      taxes: 0,
                      nights,
                      total: amount,
                      addons: [],
                    },
                  ]
                : [],
            items:
              bookingType !== "stay"
                ? [
                    {
                      itemName: requirement.title,
                      quantity: 1,
                      pricePerUnit: amount,
                      taxes: 0,
                      metadata: { requirementId: requirement._id },
                    },
                  ]
                : [],
            currency: "INR",
            subtotal: amount,
            taxes: 0,
            fees: 0,
            totalAmount: amount,
            status: order.status === "Placed" ? "confirmed" : "pending",
            paymentStatus: order.status === "Placed" ? "paid" : "pending",
            metadata: {
              source: "requirement_deal",
              requirementPayment: {
                orderId: order._id.toString(),
                requirementId,
                vendorId: vendorId.toString(),
                bookingType,
              },
            },
          };

          if (bookingType === "stay") {
            mirrorPayload.checkIn = start;
            mirrorPayload.checkOut = end;
          } else if (bookingType === "tour" || bookingType === "adventure") {
            mirrorPayload.startDate = start;
            mirrorPayload.endDate = end;
          } else {
            mirrorPayload.pickupDate = start;
            mirrorPayload.dropoffDate = end;
          }

          await Booking.create(mirrorPayload);
        }
      }

      query.$or = [
        { customerId: user.id },
        { "customer.email": user.email },
        { "metadata.bookedByUserId": user.id },
      ];
    }

    const bookings = await Booking.find(query)
      .populate("stayId", "name category location vendorId")
      .populate("tourId", "name category location vendorId")
      .populate("adventureId", "name category location vendorId")
      .populate("vehicleRentalId", "name category location vendorId")
      .populate("vendorId", "fullName email contactNumber")
      .populate({ path: "cancelledBy", select: "fullName email accountType", strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, bookings });
  } catch (error: any) {
    console.error("Booking fetch error", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch bookings" },
      { status: 500 }
    );
  }
});

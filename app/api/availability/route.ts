import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import Booking from "@/models/Booking";
import Stay from "@/models/Stay";
import Tour from "@/models/Tour";
import Adventure from "@/models/Adventure";
import VehicleRental from "@/models/VehicleRental";
import ServiceOptionBlock from "@/models/ServiceOptionBlock";
import { computeStayRoomAvailability } from "@/lib/utils/stayAvailability";

type ServiceType = "stay" | "tour" | "adventure" | "vehicle";

const SERVICE_CONFIG: Record<
  ServiceType,
  { field: "stayId" | "tourId" | "adventureId" | "vehicleRentalId"; startField: string; endField: string }
> = {
  stay: { field: "stayId", startField: "checkIn", endField: "checkOut" },
  tour: { field: "tourId", startField: "startDate", endField: "endDate" },
  adventure: { field: "adventureId", startField: "startDate", endField: "endDate" },
  vehicle: { field: "vehicleRentalId", startField: "pickupDate", endField: "dropoffDate" },
};

const isValidDate = (value: string | null): value is string => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const serviceType = searchParams.get("serviceType") as ServiceType | null;
    const id = searchParams.get("id");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!serviceType || !SERVICE_CONFIG[serviceType]) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing serviceType" },
        { status: 400 }
      );
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
    }

    const hasRange = isValidDate(startParam) && isValidDate(endParam);
    if (hasRange && new Date(startParam!) >= new Date(endParam!)) {
      return NextResponse.json(
        { success: false, message: "End date must be after start date" },
        { status: 400 }
      );
    }

    const { field, startField, endField } = SERVICE_CONFIG[serviceType];

    const optionKeys: string[] = [];
    const optionInventoryByKey: Record<string, number> = {};
    const optionCapacityByKey: Record<string, number> = {};
    let tourCategory: "group-tours" | "tour-packages" | "" = "";
    const stayRoomInventory: Array<{ _id?: string | { toString(): string }; name: string; available: number }> = [];

    switch (serviceType) {
      case "stay": {
        const stay = await Stay.findById(id)
          .select("category name bnb.unitType rooms._id rooms.name rooms.available")
          .lean();
        if (!stay || Array.isArray(stay)) {
          return NextResponse.json({ success: false, message: "Stay not found" }, { status: 404 });
        }
        const bnbRoomName =
          stay.category === "bnbs" && stay.bnb
            ? stay.bnb.unitType || stay.name
            : null;

        if (bnbRoomName) {
          optionKeys.push(bnbRoomName);
          stayRoomInventory.push({
            _id: undefined,
            name: bnbRoomName,
            available: 1,
          });
        } else if (stay.rooms && Array.isArray(stay.rooms)) {
          stay.rooms.forEach((room: any) => {
            const key = room?._id?.toString() || room?.name;
            if (key) optionKeys.push(key);
            stayRoomInventory.push({
              _id: room?._id,
              name: room?.name,
              available: Number(room?.available || 0),
            });
          });
        }
        break;
      }
      case "tour": {
        const tour = await Tour.findById(id).select("category options._id options.name options.capacity").lean();
        if (!tour || Array.isArray(tour)) {
          return NextResponse.json({ success: false, message: "Tour not found" }, { status: 404 });
        }
        tourCategory = (tour.category as "group-tours" | "tour-packages") || "";
        if (tour.options && Array.isArray(tour.options)) {
          tour.options.forEach((option: any) => {
            const key = option?._id?.toString() || option?.name;
            if (key) {
              optionKeys.push(key);
              optionCapacityByKey[key] = Math.max(0, Number(option?.capacity || 0));
            }
          });
        }
        break;
      }
      case "adventure": {
        const adventure = await Adventure.findById(id).select("options._id options.name options.available").lean();
        if (!adventure || Array.isArray(adventure)) {
          return NextResponse.json({ success: false, message: "Adventure not found" }, { status: 404 });
        }
        if (adventure.options && Array.isArray(adventure.options)) {
          adventure.options.forEach((option: any) => {
            const key = option?._id?.toString() || option?.name;
            if (key) {
              optionKeys.push(key);
              optionInventoryByKey[key] = Math.max(0, Number(option?.available || 0));
            }
          });
        }
        break;
      }
      case "vehicle": {
        const rental = await VehicleRental.findById(id).select("options._id options.model options.available").lean();
        if (!rental || Array.isArray(rental)) {
          return NextResponse.json({ success: false, message: "Vehicle rental not found" }, { status: 404 });
        }
        if (rental.options && Array.isArray(rental.options)) {
          rental.options.forEach((option: any) => {
            const key = option?._id?.toString() || option?.model;
            if (key) {
              optionKeys.push(key);
              optionInventoryByKey[key] = Math.max(0, Number(option?.available || 0));
            }
          });
        }
        break;
      }
      default:
        break;
    }

    const filter: Record<string, any> = {
      status: { $ne: "cancelled" },
      [field]: new mongoose.Types.ObjectId(id),
    };

    const bookings = await Booking.find(
      filter,
      `${startField} ${endField} guests.adults guests.children guests.infants rooms.roomId rooms.roomName items.itemId items.itemName items.quantity`
    )
      .sort({ [startField]: 1 })
      .lean();

    const bookedRanges = bookings
      .filter((booking) => booking[startField] && booking[endField])
      .map((booking) => ({
        start: (booking[startField] as Date).toISOString(),
        end: (booking[endField] as Date).toISOString(),
      }));

    let isAvailable = true;
    const availableOptionKeys: string[] = [];
    let availableOptionQuantities: Record<string, number> = {};

    if (hasRange) {
      const requestedStart = new Date(startParam!);
      const requestedEnd = new Date(endParam!);

      if (serviceType === "stay") {
        const stayAvailability = await computeStayRoomAvailability({
          stayId: id,
          rooms: stayRoomInventory,
          startDate: requestedStart,
          endDate: requestedEnd,
        });
        availableOptionKeys.push(...stayAvailability.availableOptionKeys);
        availableOptionQuantities = stayAvailability.availableOptionQuantities;
        isAvailable = availableOptionKeys.length > 0;

        return NextResponse.json({
          success: true,
          serviceType,
          id,
          isAvailable,
          bookedRanges,
          availableOptionKeys,
          availableOptionQuantities,
        });
      }

      const overlappingBookings = bookings.filter((booking) => {
        const rangeStart = booking[startField] ? new Date(booking[startField]) : null;
        const rangeEnd = booking[endField] ? new Date(booking[endField]) : null;
        if (!rangeStart || !rangeEnd) return false;
        return rangeStart < requestedEnd && rangeEnd > requestedStart;
      });

      const serviceObjectId = new mongoose.Types.ObjectId(id);
      const overlappingBlocks = await ServiceOptionBlock.find(
        {
          serviceType,
          serviceId: serviceObjectId,
          isActive: true,
          startDate: { $lt: requestedEnd },
          endDate: { $gt: requestedStart },
        },
        "optionId optionName blockedCount"
      ).lean();

      const blockedQtyByOption = new Map<string, number>();
      overlappingBlocks.forEach((block: any) => {
        const key = block?.optionId?.toString?.() || block?.optionName;
        if (!key) return;
        const blockedQty = Math.max(1, Number(block?.blockedCount || 0));
        blockedQtyByOption.set(key, (blockedQtyByOption.get(key) || 0) + blockedQty);
      });

      if (serviceType === "tour") {
        const occupiedOptionKeys = new Set<string>();
        const occupiedSeatsByOption = new Map<string, number>();

        overlappingBookings.forEach((booking: any) => {
          const bookedGuestCount =
            Math.max(0, Number(booking?.guests?.adults || 0)) +
            Math.max(0, Number(booking?.guests?.children || 0)) +
            Math.max(0, Number(booking?.guests?.infants || 0));

          booking.items?.forEach((item: any) => {
            const key = item.itemId ? item.itemId.toString() : item.itemName;
            if (!key) return;
            occupiedOptionKeys.add(key);

            const occupiedSeats = Math.max(1, bookedGuestCount, Number(item?.quantity || 0));
            occupiedSeatsByOption.set(key, (occupiedSeatsByOption.get(key) || 0) + occupiedSeats);
          });
        });

        optionKeys.forEach((key) => {
          const capacity = Math.max(0, Number(optionCapacityByKey[key] || 0));
          const blocked = blockedQtyByOption.get(key) || 0;
          if (tourCategory === "tour-packages") {
            const available = occupiedOptionKeys.has(key) || blocked > 0 ? 0 : 1;
            if (available > 0) {
              availableOptionKeys.push(key);
            }
            availableOptionQuantities[key] = available;
            return;
          }

          const occupied = occupiedSeatsByOption.get(key) || 0;
          const remaining = Math.max(0, capacity - occupied - blocked);
          if (remaining > 0) {
            availableOptionKeys.push(key);
          }
          availableOptionQuantities[key] = remaining;
        });

        if (optionKeys.length > 0) {
          isAvailable = availableOptionKeys.length > 0;
        } else {
          isAvailable = false;
        }

        return NextResponse.json({
          success: true,
          serviceType,
          id,
          isAvailable,
          bookedRanges,
          availableOptionKeys,
          availableOptionQuantities,
        });
      }

      if (serviceType === "adventure" || serviceType === "vehicle") {
        const occupiedQtyByOption = new Map<string, number>();

        overlappingBookings.forEach((booking: any) => {
          booking.items?.forEach((item: any) => {
            const key = item.itemId ? item.itemId.toString() : item.itemName;
            if (!key) return;
            const occupiedQty = Math.max(1, Number(item?.quantity || 0));
            occupiedQtyByOption.set(key, (occupiedQtyByOption.get(key) || 0) + occupiedQty);
          });
        });

        optionKeys.forEach((key) => {
          const baseInventory = Math.max(0, Number(optionInventoryByKey[key] || 0));
          const occupied = occupiedQtyByOption.get(key) || 0;
          const blocked = blockedQtyByOption.get(key) || 0;
          const remaining = Math.max(0, baseInventory - occupied - blocked);

          if (remaining > 0) {
            availableOptionKeys.push(key);
          }
          availableOptionQuantities[key] = remaining;
        });

        if (optionKeys.length > 0) {
          isAvailable = availableOptionKeys.length > 0;
        } else {
          isAvailable = occupiedQtyByOption.size === 0;
        }

        return NextResponse.json({
          success: true,
          serviceType,
          id,
          isAvailable,
          bookedRanges,
          availableOptionKeys,
          availableOptionQuantities,
        });
      }

      const occupiedOptionKeys = new Set<string>();
      overlappingBookings.forEach((booking) => {
        if (serviceType === "stay") {
          booking.rooms?.forEach((room: any) => {
            const key = room.roomId ? room.roomId.toString() : room.roomName;
            if (key) occupiedOptionKeys.add(key);
          });
        } else {
          booking.items?.forEach((item: any) => {
            const key = item.itemId ? item.itemId.toString() : item.itemName;
            if (key) occupiedOptionKeys.add(key);
          });
        }
      });

      optionKeys.forEach((key) => {
        if (!occupiedOptionKeys.has(key)) {
          availableOptionKeys.push(key);
          availableOptionQuantities[key] = 1;
        }
      });

      if (optionKeys.length > 0) {
        isAvailable = availableOptionKeys.length > 0;
      } else {
        // No configured options; default to available if nothing booked yet.
        isAvailable = occupiedOptionKeys.size === 0;
      }
    } else {
      optionKeys.forEach((key) => {
        availableOptionKeys.push(key);
        availableOptionQuantities[key] = Math.max(1, Number(optionInventoryByKey[key] || 1));
      });
    }

    return NextResponse.json({
      success: true,
      serviceType,
      id,
      isAvailable,
      bookedRanges,
      availableOptionKeys,
      availableOptionQuantities,
    });
  } catch (error: any) {
    console.error("Availability lookup failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load availability" },
      { status: 500 }
    );
  }
}



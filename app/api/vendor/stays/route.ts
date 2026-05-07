import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Stay from "@/models/Stay";
import { auth } from "@/lib/middlewares/auth";
import mongoose from "mongoose";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { calculateCommission } from "@/lib/utils/commission";

const getSellerPrice = (incomingValue: any, existingValue?: any) => {
  const explicitSellerPrice = Number(incomingValue);
  if (Number.isFinite(explicitSellerPrice) && explicitSellerPrice > 0) {
    return explicitSellerPrice;
  }

  const previousSellerPrice = Number(existingValue);
  if (Number.isFinite(previousSellerPrice) && previousSellerPrice > 0) {
    return previousSellerPrice;
  }

  return 0;
};

const normalizeStayPayload = (body: any, existingStay?: any) => {
  const {
    name,
    category,
    location,
    heroHighlights = [],
    curatedHighlights = [],
    images,
    gallery = [],
    videos = {},
    popularFacilities = [],
    amenities = {},
    tags = [],
    rooms,
    meals = [],
    bnb,
    about,
    checkInOutRules,
    vendorMessage = "",
    defaultCancellationPolicy = "",
    defaultHouseRules = [],
  } = body;

  if (!name || !category || !location || !Array.isArray(images) || images.length < 5) {
    return { error: "Missing required fields or insufficient images" };
  }

  if (!["rooms", "hotels", "homestays", "bnbs"].includes(category)) {
    return { error: "Invalid category" };
  }

  // Category-specific validation
  if (category === "hotels" || category === "homestays") {
    // Hotels and Homestays require full room details
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return { error: "Please add at least one room" };
    }

    for (let index = 0; index < rooms.length; index++) {
      const room = rooms[index];
      const existingRoomById =
        room?._id != null
          ? existingStay?.rooms?.find((existingRoom: any) =>
              String(existingRoom?._id) === String(room._id)
            )
          : undefined;
      const existingRoom = existingRoomById ?? existingStay?.rooms?.[index];
      const sellerRoomPrice = getSellerPrice(room?.sellerPrice ?? room?.price, existingRoom?.sellerPrice);
      const availabilityValue = room?.available ?? room?.inventory ?? 1;
      if (
        !room?.name ||
        !room?.bedType ||
        typeof room?.beds !== "number" ||
        typeof room?.capacity !== "number" ||
        !Number.isFinite(sellerRoomPrice) ||
        sellerRoomPrice <= 0 ||
        !Number.isFinite(Number(availabilityValue)) ||
        !Array.isArray(room?.images) ||
        room.images.length < 3
      ) {
        return {
          error:
            "Every room must include name, bed type, beds, capacity, price, availability and at least 3 images",
        };
      }
    }
  } else if (category === "rooms") {
    // Rooms category - simplified room data (no name, bedType, or images required)
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return { error: "Room information is required" };
    }

    const room = rooms[0];
    const existingRoom = existingStay?.rooms?.[0];
    const sellerRoomPrice = getSellerPrice(room?.sellerPrice ?? room?.price, existingRoom?.sellerPrice);
    if (
      typeof room?.beds !== "number" ||
      typeof room?.capacity !== "number" ||
      !Number.isFinite(sellerRoomPrice) ||
      room.beds < 1 ||
      room.capacity < 1 ||
      sellerRoomPrice <= 0
    ) {
      return {
        error: "Room must include beds (≥1), capacity (≥1), and price (>0)",
      };
    }
  } else if (category === "bnbs") {
    // BnBs category - requires bnb data, not rooms
    if (!bnb || typeof bnb !== "object") {
      return { error: "BnB details are required" };
    }

    const existingBnbSellerPrice = existingStay?.bnb?.sellerPrice;
    const sellerBnbPrice = getSellerPrice(bnb?.sellerPrice ?? bnb?.price, existingBnbSellerPrice);

    if (
      !bnb.unitType ||
      typeof bnb.bedrooms !== "number" ||
      typeof bnb.bathrooms !== "number" ||
      typeof bnb.beds !== "number" ||
      typeof bnb.capacity !== "number" ||
      !Number.isFinite(sellerBnbPrice) ||
      bnb.bedrooms < 1 ||
      bnb.bathrooms < 1 ||
      bnb.beds < 1 ||
      bnb.capacity < 1 ||
      sellerBnbPrice <= 0
    ) {
      return {
        error: "BnB must include unit type, bedrooms (≥1), bathrooms (≥1), beds (≥1), capacity (≥1), and price (>0)",
      };
    }
  }

  // Normalize rooms based on category
  let normalizedRooms: any[] = [];
  
  if (category === "hotels" || category === "homestays") {
    normalizedRooms = rooms.map((room: any, index: number) => {
      const existingRoomById =
        room?._id != null
          ? existingStay?.rooms?.find((existingRoom: any) =>
              String(existingRoom?._id) === String(room._id)
            )
          : undefined;
      const existingRoom = existingRoomById ?? existingStay?.rooms?.[index];
      const sellerPrice = getSellerPrice(room?.sellerPrice ?? room?.price, existingRoom?.sellerPrice);

      return {
        ...(room?._id ? { _id: room._id } : {}),
        name: room.name,
        description: room.description ?? "",
        bedType: room.bedType,
        beds: Number(room.beds),
        capacity: Number(room.capacity),
        sellerPrice,
        price: Number(room.price),
        taxes: room.taxes != null ? Number(room.taxes) : 0,
        currency: typeof room.currency === "string" && room.currency.trim().length ? room.currency : "INR",
        size: room.size ?? "",
        features: Array.isArray(room.features) ? room.features : [],
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
        available: Number(room.available ?? room.inventory ?? 1),
        isRefundable: room.isRefundable !== undefined ? Boolean(room.isRefundable) : true,
        refundableUntilHours:
          room.refundableUntilHours !== undefined ? Number(room.refundableUntilHours) : 48,
        images: room.images,
      };
    });
  } else if (category === "rooms") {
    // For rooms category, create a minimal room entry
    const room = rooms[0];
    const existingRoom = existingStay?.rooms?.[0];
    const sellerPrice = getSellerPrice(room?.sellerPrice ?? room?.price, existingRoom?.sellerPrice);
    normalizedRooms = [
      {
        ...(room?._id ? { _id: room._id } : {}),
        name: room?.name || "Room",
        description: room?.description ?? "",
        bedType: room?.bedType || "Queen Bed",
        beds: Number(room.beds),
        capacity: Number(room.capacity),
        sellerPrice,
        price: Number(room.price),
        taxes: room.taxes != null ? Number(room.taxes) : 0,
        currency: typeof room.currency === "string" && room.currency.trim().length ? room.currency : "INR",
        size: room.size ?? "",
        features: Array.isArray(room.features) ? room.features : [],
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
        available: Number(room.available ?? room.inventory ?? 1),
        isRefundable: room.isRefundable !== undefined ? Boolean(room.isRefundable) : true,
        refundableUntilHours:
          room.refundableUntilHours !== undefined ? Number(room.refundableUntilHours) : 48,
        images: Array.isArray(room.images) ? room.images : [],
      },
    ];
  }
  // For bnbs, normalizedRooms remains empty array

  const normalizedVideos = {
    inside: Array.isArray(videos?.inside) ? videos.inside : [],
    outside: Array.isArray(videos?.outside) ? videos.outside : [],
  };

  const normalizedAmenities: Record<string, string[]> = {};
  if (amenities && typeof amenities === "object") {
    Object.entries(amenities).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length) {
        normalizedAmenities[key] = value;
      }
    });
  }

  const normalizedTags = Array.isArray(tags)
    ? tags
        .filter((tag: any) => typeof tag === "string" && tag.trim().length)
        .map((tag: string) => tag.trim())
    : [];

  const normalizedCuratedHighlights = Array.isArray(curatedHighlights)
    ? curatedHighlights
        .filter((item: any) => item && typeof item.title === "string" && item.title.trim().length)
        .map((item: any) => ({
          title: item.title.trim(),
          description:
            typeof item.description === "string" && item.description.trim().length
              ? item.description.trim()
              : undefined,
          icon:
            typeof item.icon === "string" && item.icon.trim().length
              ? item.icon.trim()
              : undefined,
        }))
    : [];

  // Normalize meals (for homestays)
  const normalizedMeals = Array.isArray(meals) ? meals.filter((m: any) => typeof m === "string" && m.trim().length) : [];

  // Normalize bnb (for bnbs)
  let normalizedBnb = null;
  if (category === "bnbs" && bnb && typeof bnb === "object") {
    const sellerPrice = getSellerPrice(bnb?.sellerPrice ?? bnb?.price, existingStay?.bnb?.sellerPrice);
    normalizedBnb = {
      unitType: typeof bnb.unitType === "string" ? bnb.unitType.trim() : "",
      bedrooms: Number(bnb.bedrooms) || 0,
      bathrooms: Number(bnb.bathrooms) || 0,
      kitchenAvailable: Boolean(bnb.kitchenAvailable),
      beds: Number(bnb.beds) || 0,
      capacity: Number(bnb.capacity) || 0,
      features: Array.isArray(bnb.features) ? bnb.features.filter((f: any) => typeof f === "string") : [],
      sellerPrice,
      price: Number(bnb.price) || 0,
    };
  }

  return {
    payload: {
      name,
      category,
      location,
      heroHighlights,
      images,
      gallery,
      curatedHighlights: normalizedCuratedHighlights,
      tags: normalizedTags,
      videos: normalizedVideos,
      popularFacilities,
      amenities: normalizedAmenities,
      rooms: normalizedRooms,
      meals: normalizedMeals,
      bnb: normalizedBnb,
      about,
      checkInOutRules,
      vendorMessage,
      defaultCancellationPolicy,
      defaultHouseRules,
    },
  };
};

const applyStayCommission = (payload: any) => {
  const category = payload?.category;

  const rooms = Array.isArray(payload?.rooms)
    ? payload.rooms.map((room: any) => {
        const sellerPrice = Number(room?.sellerPrice ?? room?.price) || 0;
        const commission = calculateCommission("buy", category, sellerPrice);
        return {
          ...room,
          sellerPrice,
          price: commission.listingPrice,
          commissionRate: commission.ratePercent,
          commissionAmount: commission.amount,
        };
      })
    : [];

  const bnb = payload?.bnb
    ? (() => {
        const sellerPrice = Number(payload.bnb.sellerPrice ?? payload.bnb.price) || 0;
        const commission = calculateCommission("buy", category, sellerPrice);
        return {
          ...payload.bnb,
          sellerPrice,
          price: commission.listingPrice,
          commissionRate: commission.ratePercent,
          commissionAmount: commission.amount,
        };
      })()
    : payload?.bnb;

  return {
    ...payload,
    rooms,
    bnb,
  };
};
// GET - Fetch stays (vendor-specific or all for admin)
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    const id = searchParams.get("id");
    const category = searchParams.get("category");
    const all = searchParams.get("all") === "true"; // For admin/public to see all

    // Decode token to determine admin or vendor
    let accountType: string | null = null;
    try {
      const token = req.cookies.get("token")?.value;
      if (token && process.env.JWT_SECRET) {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        accountType = decoded?.accountType || null;
      }
    } catch {}

    // If this is a vendor self-request (vendorId present and not all=true), block when vendor is locked
    if (vendorId && !all) {
      try {
        const token = req.cookies.get("token")?.value;
        if (token && process.env.JWT_SECRET) {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded?.accountType === "vendor" && (decoded?.id === vendorId || decoded?._id === vendorId)) {
            const vendorUser = await User.findById(vendorId).select("isVendorLocked");
            if (vendorUser?.isVendorLocked) {
              return NextResponse.json(
                { success: false, message: "Vendor account is locked" },
                { status: 403 }
              );
            }
          }
        }
      } catch {
        // ignore token errors; treat as public request
      }
    }

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, message: "Valid stay ID is required" },
          { status: 400 }
        );
      }

      const stay = await Stay.findById(id)
        .populate("vendorId", "fullName email contactNumber")
        .lean();

      if (!stay) {
        return NextResponse.json(
          { success: false, message: "Stay not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, stay });
    }

    let query: any = {};

    // If vendorId provided, always filter by that vendor (admin/public or vendor self)
    if (vendorId) {
      if (mongoose.Types.ObjectId.isValid(vendorId)) {
        query.vendorId = new mongoose.Types.ObjectId(vendorId);
      } else {
        query.vendorId = vendorId;
      }
    }

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // If not admin viewing all, only show active stays
    if (!all) {
      query.isActive = true;
    }

    // Public all=true without a specific vendor: exclude locked or unapproved vendors (admins can see all)
    if (all && accountType !== "admin" && !vendorId) {
      const allowedVendors = await User.find({ accountType: "vendor", isVendorApproved: true, isVendorLocked: false }).select("_id");
      const allowedIds = allowedVendors.map((v) => v._id);
      query.vendorId = { $in: allowedIds };
    }

    const stays = await Stay.find(query)
      .populate("vendorId", "fullName email contactNumber")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, stays });
  } catch (error: any) {
    console.error("Error fetching stays:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch stays" },
      { status: 500 }
    );
  }
}

// POST - Create a new stay
export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const body = await req.json();
    const user = (req as any).user;

    // Verify vendor
    if (user.accountType !== "vendor") {
      return NextResponse.json(
        { success: false, message: "Only vendors can create stays" },
        { status: 403 }
      );
    }

    const vendorId = user.id;

    const { payload, error } = normalizeStayPayload(body);
    if (error) {
      return NextResponse.json({ success: false, message: error }, { status: 400 });
    }

    const payloadWithCommission = applyStayCommission(payload);

    const stay = await Stay.create({
      vendorId,
      ...payloadWithCommission,
      isActive: true,
    });

    const populatedStay = await Stay.findById(stay._id).populate(
      "vendorId",
      "fullName email contactNumber"
    );

    return NextResponse.json(
      { success: true, stay: populatedStay },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating stay:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create stay" },
      { status: 500 }
    );
  }
});

// PUT - Update an existing stay
export const PUT = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const body = await req.json();
    const user = (req as any).user;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Valid stay ID is required" },
        { status: 400 }
      );
    }

    const stay = await Stay.findById(id);
    if (!stay) {
      return NextResponse.json(
        { success: false, message: "Stay not found" },
        { status: 404 }
      );
    }

    if (user.accountType !== "admin" && stay.vendorId.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to update this stay" },
        { status: 403 }
      );
    }

    const { payload, error } = normalizeStayPayload(body, stay);
    if (error) {
      return NextResponse.json({ success: false, message: error }, { status: 400 });
    }

    const payloadWithCommission = applyStayCommission(payload);

    Object.assign(stay, payloadWithCommission);
    await stay.save();

    const updatedStay = await Stay.findById(id).populate(
      "vendorId",
      "fullName email contactNumber"
    );

    return NextResponse.json({ success: true, stay: updatedStay });
  } catch (error: any) {
    console.error("Error updating stay:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update stay" },
      { status: 500 }
    );
  }
});

// DELETE - Remove a stay by ID
export const DELETE = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const user = (req as any).user;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Valid stay ID is required" },
        { status: 400 }
      );
    }

    const stay = await Stay.findById(id);
    if (!stay) {
      return NextResponse.json(
        { success: false, message: "Stay not found" },
        { status: 404 }
      );
    }

    if (user.accountType !== "admin" && stay.vendorId.toString() !== user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to delete this stay" },
        { status: 403 }
      );
    }

    await Stay.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Stay deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting stay:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete stay" },
      { status: 500 }
    );
  }
});


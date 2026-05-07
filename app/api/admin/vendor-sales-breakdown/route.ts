import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";
import Booking from "@/models/Booking";
import { getCommissionRatePercent } from "@/lib/utils/commission";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ServiceBookingDoc = {
  _id: any;
  status?: string;
  paymentStatus?: string;
  totalAmount?: number;
  createdAt?: Date;
  nights?: number;
  rooms?: any[];
  items?: any[];
  vendorId?: {
    _id?: any;
    fullName?: string;
    email?: string;
    contactNumber?: string;
  } | null;
  stayId?: any;
  tourId?: any;
  adventureId?: any;
  vehicleRentalId?: any;
};

const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toPositive = (value: unknown, fallback = 1) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const asId = (value: unknown) => {
  if (!value) return "";
  try {
    return String(value);
  } catch {
    return "";
  }
};

const resolveSellerUnitPrice = (params: {
  sellerPrice?: unknown;
  listingPrice?: unknown;
  commissionAmount?: unknown;
  commissionRate?: unknown;
  fallback?: unknown;
}) => {
  const seller = toNumber(params.sellerPrice, NaN);
  if (seller > 0) return seller;

  const listing = toNumber(params.listingPrice, NaN);
  const commission = toNumber(params.commissionAmount, NaN);
  if (listing > 0) {
    if (commission > 0) {
      return Math.max(listing - commission, 0);
    }

    const commissionRate = toNumber(params.commissionRate, NaN);
    if (commissionRate > 0) {
      return Math.max(listing - (listing * commissionRate) / 100, 0);
    }
  }

  const fallback = toNumber(params.fallback, NaN);
  if (fallback > 0) return fallback;

  return 0;
};

const getServiceType = (booking: ServiceBookingDoc) => {
  if (booking?.stayId) return "stay";
  if (booking?.tourId) return "tour";
  if (booking?.adventureId) return "adventure";
  if (booking?.vehicleRentalId) return "vehicle";
  return "";
};

const findOption = (options: any[], item: any) => {
  if (!Array.isArray(options)) return null;

  const itemId = asId(item?.itemId);
  if (itemId) {
    const byId = options.find((opt: any) => asId(opt?._id) === itemId);
    if (byId) return byId;
  }

  const itemName = String(item?.itemName || "").trim();
  if (!itemName) return null;

  return options.find((opt: any) => {
    const optionName = String(opt?.name || opt?.model || "").trim();
    return optionName && optionName === itemName;
  }) || null;
};

const getAverageRatio = (options: any[], selector: (opt: any) => { seller?: unknown; listing?: unknown }) => {
  const ratios = (Array.isArray(options) ? options : [])
    .map((opt) => selector(opt))
    .map(({ seller, listing }) => {
      const sellerNum = toNumber(seller, NaN);
      const listingNum = toNumber(listing, NaN);
      if (sellerNum > 0 && listingNum > 0) return sellerNum / listingNum;
      return NaN;
    })
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0 && ratio <= 1);

  if (!ratios.length) return NaN;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
};

const computeServiceSellerAmount = (booking: ServiceBookingDoc) => {
  const serviceType = getServiceType(booking);
  const defaultDuration = toPositive(booking?.nights, 1);

  if (serviceType === "stay") {
    const stay: any = booking?.stayId || null;
    const stayRooms = Array.isArray(stay?.rooms) ? stay.rooms : [];
    const bookingRooms = Array.isArray(booking?.rooms) ? booking.rooms : [];

    const total = bookingRooms.reduce((sum: number, room: any) => {
      const roomId = asId(room?.roomId);
      const roomName = String(room?.roomName || "").trim();

      const stayRoom =
        stayRooms.find((r: any) => asId(r?._id) === roomId) ||
        stayRooms.find((r: any) => String(r?.name || "").trim() === roomName) ||
        null;

      let sellerNightPrice = resolveSellerUnitPrice({
        sellerPrice: stayRoom?.sellerPrice ?? stay?.bnb?.sellerPrice,
        listingPrice: stayRoom?.price ?? stay?.bnb?.price,
        commissionAmount: stayRoom?.commissionAmount ?? stay?.bnb?.commissionAmount,
        commissionRate: stayRoom?.commissionRate ?? stay?.bnb?.commissionRate,
        fallback: room?.pricePerNight,
      });

      if (!stayRoom && (!(sellerNightPrice > 0) || sellerNightPrice >= toNumber(room?.pricePerNight, 0))) {
        const roomRatio = getAverageRatio(stayRooms, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
        const bnbSeller = toNumber(stay?.bnb?.sellerPrice, NaN);
        const bnbListing = toNumber(stay?.bnb?.price, NaN);
        const bnbRatio = bnbSeller > 0 && bnbListing > 0 ? bnbSeller / bnbListing : NaN;
        const ratio = Number.isFinite(roomRatio) ? roomRatio : bnbRatio;
        const itemListing = toNumber(room?.pricePerNight, 0);
        if (Number.isFinite(ratio) && ratio > 0 && ratio <= 1 && itemListing > 0) {
          sellerNightPrice = itemListing * ratio;
        }
      }

      return sum + sellerNightPrice * toPositive(room?.quantity, 1) * toPositive(room?.nights, defaultDuration);
    }, 0);

    return total > 0 ? total : toNumber(booking?.totalAmount, 0);
  }

  const items = Array.isArray(booking?.items) ? booking.items : [];
  const duration = toPositive(booking?.nights, 1);

  if (serviceType === "tour") {
    const tour: any = booking?.tourId || null;
    const options = Array.isArray(tour?.options) ? tour.options : [];
    const rootSeller = toNumber(tour?.sellerBasePrice, NaN);
    const rootListing = toNumber(tour?.price, NaN);
    const rootRatio = rootSeller > 0 && rootListing > 0 ? rootSeller / rootListing : NaN;
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
    const fallbackRatio = Number.isFinite(optionRatio) ? optionRatio : rootRatio;

    return items.reduce((sum: number, item: any) => {
      const option = findOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPrice,
        listingPrice: option?.price,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumber(item?.pricePerUnit, 0);
        if (Number.isFinite(fallbackRatio) && fallbackRatio > 0 && fallbackRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * fallbackRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  if (serviceType === "adventure") {
    const adventure: any = booking?.adventureId || null;
    const options = Array.isArray(adventure?.options) ? adventure.options : [];
    const rootSeller = toNumber(adventure?.sellerBasePrice, NaN);
    const rootListing = toNumber(adventure?.price, NaN);
    const rootRatio = rootSeller > 0 && rootListing > 0 ? rootSeller / rootListing : NaN;
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
    const fallbackRatio = Number.isFinite(optionRatio) ? optionRatio : rootRatio;

    return items.reduce((sum: number, item: any) => {
      const option = findOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPrice,
        listingPrice: option?.price,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumber(item?.pricePerUnit, 0);
        if (Number.isFinite(fallbackRatio) && fallbackRatio > 0 && fallbackRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * fallbackRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  if (serviceType === "vehicle") {
    const vehicle: any = booking?.vehicleRentalId || null;
    const options = Array.isArray(vehicle?.options) ? vehicle.options : [];
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPricePerDay, listing: opt?.pricePerDay }));

    return items.reduce((sum: number, item: any) => {
      const option = findOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPricePerDay,
        listingPrice: option?.pricePerDay,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumber(item?.pricePerUnit, 0);
        if (Number.isFinite(optionRatio) && optionRatio > 0 && optionRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * optionRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  return toNumber(booking?.totalAmount, 0);
};

const normalizeVendorPayableAmount = (booking: ServiceBookingDoc, grossAmount: number, computedAmount: number) => {
  const safeGross = Math.max(0, toNumber(grossAmount, 0));
  if (safeGross <= 0) return 0;

  const safeComputed = Math.max(0, toNumber(computedAmount, 0));
  if (safeComputed > 0 && safeComputed < safeGross) {
    return safeComputed;
  }

  const serviceType = getServiceType(booking);
  if (serviceType === "stay") {
    const stay: any = booking?.stayId || null;
    const stayCategory = String(stay?.category || "stays");
    const inferredRate = getCommissionRatePercent("buy", stayCategory, safeGross);
    if (inferredRate > 0 && inferredRate < 100) {
      return safeGross * (100 / (100 + inferredRate));
    }
  }

  return Math.min(safeGross, safeComputed);
};

export const GET = auth(async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    if (user?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();

    const productRows = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Pending" },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.itemType": "Product" } },
      {
        $lookup: {
          from: "products",
          localField: "items.itemId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "product.sellerId": { $type: "objectId" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "product.sellerId",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $unwind: {
          path: "$vendor",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          itemStatus: { $ifNull: ["$items.status", "$status"] },
          isRentalItem: { $eq: ["$product.listingType", "rent"] },
          quantity: {
            $cond: [{ $gt: ["$items.quantity", 0] }, "$items.quantity", 1],
          },
          rentalDays: {
            $cond: [{ $gt: [{ $ifNull: ["$items.rentalDays", 0] }, 0] }, "$items.rentalDays", 1],
          },
          listingUnitPrice: {
            $cond: [
              { $eq: ["$product.listingType", "rent"] },
              {
                $ifNull: [
                  "$product.rentPriceDay",
                  {
                    $ifNull: [
                      "$items.variant.price",
                      { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
                    ],
                  },
                ],
              },
              {
                $ifNull: [
                  "$items.variant.price",
                  { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
                ],
              },
            ],
          },
          sellerUnitPrice: {
            $cond: [
              { $eq: ["$product.listingType", "rent"] },
              {
                $ifNull: [
                  "$product.sellerRentPriceDay",
                  {
                    $ifNull: [
                      "$product.rentPriceDay",
                      {
                        $ifNull: [
                          "$items.variant.price",
                          { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                $ifNull: [
                  "$product.sellerBasePrice",
                  {
                    $ifNull: [
                      "$items.variant.price",
                      { $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          grossAmount: {
            $multiply: [
              "$listingUnitPrice",
              "$quantity",
              { $cond: ["$isRentalItem", "$rentalDays", 1] },
            ],
          },
          netAmount: {
            $multiply: [
              "$sellerUnitPrice",
              "$quantity",
              { $cond: ["$isRentalItem", "$rentalDays", 1] },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          orderId: { $toString: "$_id" },
          vendorId: { $toString: "$vendor._id" },
          vendorName: "$vendor.fullName",
          vendorEmail: "$vendor.email",
          vendorPhone: "$vendor.contactNumber",
          quantity: "$quantity",
          soldAmount: "$grossAmount",
          vendorPayableAmount: "$netAmount",
          commissionMadeAmount: {
            $cond: [
              { $gt: [{ $subtract: ["$grossAmount", "$netAmount"] }, 0] },
              { $subtract: ["$grossAmount", "$netAmount"] },
              0,
            ],
          },
          status: "$itemStatus",
          orderCreatedAt: "$createdAt",
          source: { $literal: "product" },
          serviceType: { $literal: "product" },
        },
      },
    ]);

    const requirementOrders = await Order.find({
      orderContext: "requirement_deal",
      "requirementDeal.vendorId": { $exists: true, $ne: null },
    })
      .populate("requirementDeal.vendorId", "fullName email contactNumber")
      .select("_id status totalAmount createdAt requirementDeal")
      .lean();

    const requirementRows = requirementOrders.map((order: any) => {
      const vendorAmount = Number(order?.requirementDeal?.confirmedPrice ?? order?.totalAmount ?? 0);
      const totalPayable = Number(order?.requirementDeal?.totalPayable ?? order?.totalAmount ?? vendorAmount);
      const explicitCommissionAmount = Number(order?.requirementDeal?.commissionAmount ?? 0);
      const commissionAmount =
        Number.isFinite(explicitCommissionAmount) && explicitCommissionAmount > 0
          ? explicitCommissionAmount
          : Math.max(totalPayable - vendorAmount, 0);
      const vendor = order?.requirementDeal?.vendorId;
      return {
        orderId: asId(order?._id),
        vendorId: asId(vendor?._id),
        vendorName: vendor?.fullName || "Vendor",
        vendorEmail: vendor?.email || null,
        vendorPhone: vendor?.contactNumber || null,
        quantity: 1,
        soldAmount: totalPayable,
        vendorPayableAmount: vendorAmount,
        commissionMadeAmount: commissionAmount,
        status: String(order?.status || "pending"),
        orderCreatedAt: order?.createdAt,
        source: "requirement",
        serviceType: "requirement",
      };
    });

    const placedServiceOrderIds = (
      await Order.find({
        status: "Placed",
        orderContext: { $ne: "requirement_deal" },
        items: {
          $elemMatch: {
            itemType: { $in: ["Stay", "Tour", "Adventure", "VehicleRental"] },
          },
        },
      })
        .select("_id")
        .lean()
    ).map((order: any) => asId(order?._id));

    const servicePaymentMatch =
      placedServiceOrderIds.length > 0
        ? {
            $or: [
              { paymentStatus: "paid" },
              { "metadata.catalogPayment.orderId": { $in: placedServiceOrderIds } },
            ],
          }
        : { paymentStatus: "paid" };

    const serviceBookings = (await Booking.find({
      vendorId: { $exists: true, $ne: null },
      status: { $in: ["pending", "confirmed", "completed", "cancelled"] },
      ...servicePaymentMatch,
      "metadata.source": { $ne: "requirement_deal" },
    })
      .populate("vendorId", "fullName email contactNumber")
      .populate("stayId", "name bnb rooms")
      .populate("tourId", "name options")
      .populate("adventureId", "name options")
      .populate("vehicleRentalId", "name options")
      .select("vendorId stayId tourId adventureId vehicleRentalId rooms items nights totalAmount status createdAt")
      .lean()) as ServiceBookingDoc[];

    const serviceRows = serviceBookings.map((booking) => {
      const grossAmount = toNumber(booking?.totalAmount, 0);
      const computedVendorPayableAmount = computeServiceSellerAmount(booking);
      const vendorPayableAmount = normalizeVendorPayableAmount(
        booking,
        grossAmount,
        computedVendorPayableAmount
      );
      const commissionMadeAmount = Math.max(grossAmount - vendorPayableAmount, 0);
      const vendor: any = booking?.vendorId || null;
      const serviceType = getServiceType(booking);

      return {
        orderId: asId(booking?._id),
        vendorId: asId(vendor?._id),
        vendorName: vendor?.fullName || "Vendor",
        vendorEmail: vendor?.email || null,
        vendorPhone: vendor?.contactNumber || null,
        quantity: 1,
        soldAmount: grossAmount,
        vendorPayableAmount,
        commissionMadeAmount,
        status: String(booking?.status || "pending"),
        orderCreatedAt: booking?.createdAt,
        source: "service",
        serviceType,
      };
    });

    const rows = [...productRows, ...requirementRows, ...serviceRows].sort((a: any, b: any) => {
      const aTime = a?.orderCreatedAt ? new Date(a.orderCreatedAt).getTime() : 0;
      const bTime = b?.orderCreatedAt ? new Date(b.orderCreatedAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Vendor sales breakdown fetch failed:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load vendor sales breakdown" },
      { status: 500 }
    );
  }
});

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Booking from "@/models/Booking";
import Order from "@/models/Order";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { Types, PipelineStage } from "mongoose";
import { getCommissionRatePercent } from "@/lib/utils/commission";

const getTokenVendorId = (req: NextRequest): string | null => {
  try {
    const token = req.cookies.get("token")?.value;
    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { accountType?: string; id?: string; _id?: string };
      if (decoded?.accountType === "vendor") {
        return decoded?.id || decoded?._id || null;
      }
    }
  } catch {}
  return null;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const addDays = (d: Date, delta: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
};
const addMonths = (d: Date, delta: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
};
const addYears = (d: Date, delta: number) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + delta);
  return x;
};

const toNumeric = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toPositive = (value: unknown, fallback = 1) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const toObjectIdString = (value: unknown) => {
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
  const seller = toNumeric(params.sellerPrice, NaN);
  if (seller > 0) return seller;

  const listing = toNumeric(params.listingPrice, NaN);
  const commission = toNumeric(params.commissionAmount, NaN);
  if (listing > 0) {
    if (commission > 0) {
      return Math.max(listing - commission, 0);
    }

    const commissionRate = toNumeric(params.commissionRate, NaN);
    if (commissionRate > 0) {
      return Math.max(listing - (listing * commissionRate) / 100, 0);
    }
  }

  const fallback = toNumeric(params.fallback, NaN);
  if (fallback > 0) return fallback;

  return 0;
};

const findServiceOption = (options: any[], item: any) => {
  if (!Array.isArray(options)) return null;

  const itemId = toObjectIdString(item?.itemId);
  if (itemId) {
    const byId = options.find((opt: any) => toObjectIdString(opt?._id) === itemId);
    if (byId) return byId;
  }

  const itemName = String(item?.itemName || "").trim();
  if (!itemName) return null;

  return options.find((opt: any) => {
    const optName = String(opt?.name || opt?.model || "").trim();
    return optName && optName === itemName;
  }) || null;
};

const getAverageRatio = (options: any[], selector: (opt: any) => { seller?: unknown; listing?: unknown }) => {
  const ratios = (Array.isArray(options) ? options : [])
    .map((opt) => selector(opt))
    .map(({ seller, listing }) => {
      const sellerNum = toNumeric(seller, NaN);
      const listingNum = toNumeric(listing, NaN);
      if (sellerNum > 0 && listingNum > 0) return sellerNum / listingNum;
      return NaN;
    })
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0 && ratio <= 1);

  if (!ratios.length) return NaN;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
};

const computeServiceSellerAmount = (booking: any) => {
  const serviceType = String(booking?.serviceType || "").toLowerCase();
  const defaultDuration = toPositive(booking?.nights, 1);

  if (serviceType === "stay") {
    const stay = booking?.stayId && typeof booking.stayId === "object" ? booking.stayId : null;
    const stayRooms = Array.isArray(stay?.rooms) ? stay.rooms : [];
    const bookingRooms = Array.isArray(booking?.rooms) ? booking.rooms : [];

    let stayTotal = 0;
    bookingRooms.forEach((room: any) => {
      const roomId = toObjectIdString(room?.roomId);
      const roomName = String(room?.roomName || "").trim();

      const stayRoom =
        stayRooms.find((r: any) => toObjectIdString(r?._id) === roomId) ||
        stayRooms.find((r: any) => String(r?.name || "").trim() === roomName) ||
        null;

      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: stayRoom?.sellerPrice ?? stay?.bnb?.sellerPrice,
        listingPrice: stayRoom?.price ?? stay?.bnb?.price,
        commissionAmount: stayRoom?.commissionAmount ?? stay?.bnb?.commissionAmount,
        commissionRate: stayRoom?.commissionRate ?? stay?.bnb?.commissionRate,
        fallback: room?.pricePerNight,
      });

      if (!stayRoom && (!(sellerUnitPrice > 0) || sellerUnitPrice >= toNumeric(room?.pricePerNight, 0))) {
        const roomRatio = getAverageRatio(stayRooms, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
        const bnbSeller = toNumeric(stay?.bnb?.sellerPrice, NaN);
        const bnbListing = toNumeric(stay?.bnb?.price, NaN);
        const bnbRatio = bnbSeller > 0 && bnbListing > 0 ? bnbSeller / bnbListing : NaN;
        const ratio = Number.isFinite(roomRatio) ? roomRatio : bnbRatio;
        const itemListing = toNumeric(room?.pricePerNight, 0);
        if (Number.isFinite(ratio) && ratio > 0 && ratio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * ratio;
        }
      }

      stayTotal += sellerUnitPrice * toPositive(room?.quantity, 1) * toPositive(room?.nights, defaultDuration);
    });

    return stayTotal > 0 ? stayTotal : toNumeric(booking?.totalAmount, 0);
  }

  const bookingItems = Array.isArray(booking?.items) ? booking.items : [];
  const duration = toPositive(booking?.nights, 1);

  if (serviceType === "tour") {
    const tour = booking?.tourId && typeof booking.tourId === "object" ? booking.tourId : null;
    const options = Array.isArray(tour?.options) ? tour.options : [];
    const rootSeller = toNumeric(tour?.sellerBasePrice, NaN);
    const rootListing = toNumeric(tour?.price, NaN);
    const rootRatio = rootSeller > 0 && rootListing > 0 ? rootSeller / rootListing : NaN;
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
    const fallbackRatio = Number.isFinite(optionRatio) ? optionRatio : rootRatio;

    return bookingItems.reduce((sum: number, item: any) => {
      const option = findServiceOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPrice,
        listingPrice: option?.price,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumeric(item?.pricePerUnit, 0);
        if (Number.isFinite(fallbackRatio) && fallbackRatio > 0 && fallbackRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * fallbackRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  if (serviceType === "adventure") {
    const adventure = booking?.adventureId && typeof booking.adventureId === "object" ? booking.adventureId : null;
    const options = Array.isArray(adventure?.options) ? adventure.options : [];
    const rootSeller = toNumeric(adventure?.sellerBasePrice, NaN);
    const rootListing = toNumeric(adventure?.price, NaN);
    const rootRatio = rootSeller > 0 && rootListing > 0 ? rootSeller / rootListing : NaN;
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPrice, listing: opt?.price }));
    const fallbackRatio = Number.isFinite(optionRatio) ? optionRatio : rootRatio;

    return bookingItems.reduce((sum: number, item: any) => {
      const option = findServiceOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPrice,
        listingPrice: option?.price,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumeric(item?.pricePerUnit, 0);
        if (Number.isFinite(fallbackRatio) && fallbackRatio > 0 && fallbackRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * fallbackRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  if (serviceType === "vehicle") {
    const vehicle =
      booking?.vehicleRentalId && typeof booking.vehicleRentalId === "object"
        ? booking.vehicleRentalId
        : null;
    const options = Array.isArray(vehicle?.options) ? vehicle.options : [];
    const optionRatio = getAverageRatio(options, (opt) => ({ seller: opt?.sellerPricePerDay, listing: opt?.pricePerDay }));

    return bookingItems.reduce((sum: number, item: any) => {
      const option = findServiceOption(options, item);
      let sellerUnitPrice = resolveSellerUnitPrice({
        sellerPrice: option?.sellerPricePerDay,
        listingPrice: option?.pricePerDay,
        commissionAmount: option?.commissionAmount,
        commissionRate: option?.commissionRate,
        fallback: item?.pricePerUnit,
      });

      if (!option) {
        const itemListing = toNumeric(item?.pricePerUnit, 0);
        if (Number.isFinite(optionRatio) && optionRatio > 0 && optionRatio <= 1 && itemListing > 0) {
          sellerUnitPrice = itemListing * optionRatio;
        }
      }
      return sum + sellerUnitPrice * toPositive(item?.quantity, 1) * duration;
    }, 0);
  }

  return toNumeric(booking?.totalAmount, 0);
};

const normalizeServiceVendorPayable = (booking: any, grossAmount: number, computedAmount: number) => {
  const safeGross = Math.max(0, toNumeric(grossAmount, 0));
  if (safeGross <= 0) return 0;

  const safeComputed = Math.max(0, toNumeric(computedAmount, 0));
  if (safeComputed > 0 && safeComputed < safeGross) {
    return safeComputed;
  }

  const serviceType = String(booking?.serviceType || "").toLowerCase();
  if (serviceType === "stay") {
    const stay = booking?.stayId && typeof booking.stayId === "object" ? booking.stayId : null;
    const stayCategory = String(stay?.category || "stays");
    const inferredRate = getCommissionRatePercent("buy", stayCategory, safeGross);
    if (inferredRate > 0 && inferredRate < 100) {
      return safeGross * (100 / (100 + inferredRate));
    }
  }

  return Math.min(safeGross, safeComputed);
};

const getServiceDisplayName = (booking: any) => {
  const stay = booking?.stayId && typeof booking.stayId === "object" ? booking.stayId : null;
  const tour = booking?.tourId && typeof booking.tourId === "object" ? booking.tourId : null;
  const adventure = booking?.adventureId && typeof booking.adventureId === "object" ? booking.adventureId : null;
  const vehicle =
    booking?.vehicleRentalId && typeof booking.vehicleRentalId === "object"
      ? booking.vehicleRentalId
      : null;

  return String(stay?.name || tour?.name || adventure?.name || vehicle?.name || "Service booking");
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const vendorId = getTokenVendorId(req);
    if (!vendorId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let vendorObjectId: Types.ObjectId;
    try {
      vendorObjectId = new Types.ObjectId(vendorId);
    } catch {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const vendorDoc = await User.findById(vendorObjectId).select("vendorServices isSeller");
    if (!vendorDoc) {
      return NextResponse.json({ success: false, message: "Vendor not found" }, { status: 404 });
    }

    const includeServices = Array.isArray(vendorDoc.vendorServices) ? vendorDoc.vendorServices.length > 0 : false;
    const includeProducts = Boolean(vendorDoc.isSeller);

    const vendorMatch = { vendorId: vendorObjectId };
    const activeBookingMatch = { status: { $ne: "cancelled" } };
    const earningsStatusMatch = { status: { $in: ["confirmed", "completed"] } };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = startOfDay(addDays(now, -1));
    const yesterdayEnd = endOfDay(addDays(now, -1));

    let todayServicePurchasesCount = 0;
    let totalServicePurchasesCount = 0;
    let todayServiceAmount = 0;
    let yesterdayServiceAmount = 0;
    let totalServiceAmount = 0;
    let serviceWeekAgg: Array<{ _id: string; count: number }> = [];
    let serviceMonthAgg: Array<{ _id: string; count: number }> = [];
    let serviceYearAgg: Array<{ _id: string; count: number }> = [];
    type RecentPurchase = {
      _id: string;
      status: string;
      price: number;
      name: string;
      createdAt: Date;
      type: "Service" | "Product";
      listingType?: "buy" | "rent";
      unitPrice?: number;
      quantity?: number;
      rentalDays?: number;
      rentalStartDate?: Date | string | null;
      rentalEndDate?: Date | string | null;
    };
    let recentServicePurchases: RecentPurchase[] = [];

    if (includeServices) {
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
      ).map((order: any) => toObjectIdString(order?._id));

      const servicePaymentMatch =
        placedServiceOrderIds.length > 0
          ? {
              $or: [
                { paymentStatus: "paid" },
                { "metadata.catalogPayment.orderId": { $in: placedServiceOrderIds } },
              ],
            }
          : { paymentStatus: "paid" };

      const [todayCount, totalCount] = await Promise.all([
        Booking.countDocuments({ ...vendorMatch, ...activeBookingMatch, ...servicePaymentMatch, createdAt: { $gte: todayStart, $lte: todayEnd } }),
        Booking.countDocuments({ ...vendorMatch, ...activeBookingMatch, ...servicePaymentMatch }),
      ]);
      todayServicePurchasesCount = todayCount;
      totalServicePurchasesCount = totalCount;

      const serviceEarningBookings = await Booking.find({
        ...vendorMatch,
        ...earningsStatusMatch,
        ...servicePaymentMatch,
      })
        .populate("stayId", "name category bnb rooms")
        .populate("tourId", "name options")
        .populate("adventureId", "name options")
        .populate("vehicleRentalId", "name options")
        .select("serviceType stayId tourId adventureId vehicleRentalId rooms items nights totalAmount updatedAt createdAt")
        .lean();

      serviceEarningBookings.forEach((booking: any) => {
        const grossAmount = toNumeric(booking?.totalAmount, 0);
        const computedAmount = computeServiceSellerAmount(booking);
        const amount = normalizeServiceVendorPayable(booking, grossAmount, computedAmount);
        totalServiceAmount += amount;

        const updatedAt = booking?.updatedAt ? new Date(booking.updatedAt) : booking?.createdAt ? new Date(booking.createdAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) return;

        if (updatedAt >= todayStart && updatedAt <= todayEnd) {
          todayServiceAmount += amount;
        }

        if (updatedAt >= yesterdayStart && updatedAt <= yesterdayEnd) {
          yesterdayServiceAmount += amount;
        }
      });

      // Sales data: weekly, monthly, yearly booking counts
      const weekStart = startOfDay(addDays(now, -6));
      const monthStart = startOfDay(addMonths(now, -11));
      const yearStart = startOfDay(addYears(now, -2));

      [serviceWeekAgg, serviceMonthAgg, serviceYearAgg] = await Promise.all([
        Booking.aggregate([
          { $match: { ...vendorMatch, ...activeBookingMatch, ...servicePaymentMatch, createdAt: { $gte: weekStart, $lte: todayEnd } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          { $match: { ...vendorMatch, ...activeBookingMatch, ...servicePaymentMatch, createdAt: { $gte: monthStart, $lte: todayEnd } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          { $match: { ...vendorMatch, ...activeBookingMatch, ...servicePaymentMatch, createdAt: { $gte: yearStart, $lte: todayEnd } } },
          { $group: { _id: { $dateToString: { format: "%Y", date: "$createdAt" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]) as Array<Array<{ _id: string; count: number }>>;

      const recentServiceRows = await Booking.find({ ...vendorMatch, ...servicePaymentMatch })
        .populate("stayId", "name category bnb rooms")
        .populate("tourId", "name options")
        .populate("adventureId", "name options")
        .populate("vehicleRentalId", "name options")
        .select("serviceType stayId tourId adventureId vehicleRentalId rooms items nights status totalAmount createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      recentServicePurchases = recentServiceRows.map((row: any) => ({
        _id: toObjectIdString(row?._id),
        status: String(row?.status || "pending"),
        price: normalizeServiceVendorPayable(
          row,
          toNumeric(row?.totalAmount, 0),
          computeServiceSellerAmount(row)
        ),
        name: getServiceDisplayName(row),
        createdAt: row?.createdAt,
        type: "Service" as const,
      }));
    }

    const productBaseStages: PipelineStage[] = [
      { $match: { status: { $ne: "Pending" } } },
      { $unwind: "$items" },
      { $match: { "items.itemType": "Product", "items.status": { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "products",
          localField: "items.itemId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.sellerId": vendorObjectId } },
      {
        $addFields: {
          isRentalItem: {
            $eq: ["$product.listingType", "rent"],
          },
          rentalDays: {
            $ifNull: ["$items.rentalDays", 1],
          },
          unitPrice: {
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
          soldAmount: {
            $multiply: [
              "$unitPrice",
              {
                $cond: [
                  { $gt: ["$items.quantity", 0] },
                  "$items.quantity",
                  1,
                ],
              },
                {
                  $cond: ["$isRentalItem", "$rentalDays", 1],
                },
            ],
          },
        },
      },
    ];

    const buildProductStatsPipeline = (range?: { start: Date; end: Date }): PipelineStage[] => {
      const pipeline: PipelineStage[] = [];
      if (range) {
        pipeline.push({ $match: { createdAt: { $gte: range.start, $lte: range.end } } });
      }
      pipeline.push(...productBaseStages);
      pipeline.push({
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$soldAmount" },
        },
      });
      return pipeline;
    };

    const buildProductSeriesPipeline = (format: string, range: { start: Date; end: Date }): PipelineStage[] => {
      const pipeline: PipelineStage[] = [
        { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
        ...productBaseStages,
        {
          $group: {
            _id: { $dateToString: { format, date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];
      return pipeline;
    };

    let todayProductPurchasesCount = 0;
    let totalProductPurchasesCount = 0;
    let todayProductAmount = 0;
    let yesterdayProductAmount = 0;
    let totalProductAmount = 0;
    let productWeekAgg: Array<{ _id: string; count: number }> = [];
    let productMonthAgg: Array<{ _id: string; count: number }> = [];
    let productYearAgg: Array<{ _id: string; count: number }> = [];
    let recentProductPurchases: RecentPurchase[] = [];

    if (includeProducts) {
      const [todayRes, totalRes, yesterdayRes] = await Promise.all([
        Order.aggregate(buildProductStatsPipeline({ start: todayStart, end: todayEnd })),
        Order.aggregate(buildProductStatsPipeline()),
        Order.aggregate(buildProductStatsPipeline({ start: yesterdayStart, end: yesterdayEnd })),
      ]);

      todayProductPurchasesCount = Array.isArray(todayRes) && todayRes.length ? todayRes[0].count : 0;
      todayProductAmount = Array.isArray(todayRes) && todayRes.length ? todayRes[0].amount : 0;

      totalProductPurchasesCount = Array.isArray(totalRes) && totalRes.length ? totalRes[0].count : 0;
      totalProductAmount = Array.isArray(totalRes) && totalRes.length ? totalRes[0].amount : 0;

      yesterdayProductAmount = Array.isArray(yesterdayRes) && yesterdayRes.length ? yesterdayRes[0].amount : 0;

      const weekStart = startOfDay(addDays(now, -6));
      const monthStart = startOfDay(addMonths(now, -11));
      const yearStart = startOfDay(addYears(now, -2));

      [productWeekAgg, productMonthAgg, productYearAgg] = await Promise.all([
        Order.aggregate(buildProductSeriesPipeline("%Y-%m-%d", { start: weekStart, end: todayEnd })),
        Order.aggregate(buildProductSeriesPipeline("%Y-%m", { start: monthStart, end: todayEnd })),
        Order.aggregate(buildProductSeriesPipeline("%Y", { start: yearStart, end: todayEnd })),
      ]) as Array<Array<{ _id: string; count: number }>>;

      const productRecentAgg = (await Order.aggregate([
        { $sort: { createdAt: -1 } },
        ...productBaseStages,
        {
          $addFields: {
            lineId: {
              $concat: [
                { $toString: "$_id" },
                "-",
                { $toString: "$items.itemId" },
                "-",
                {
                  $cond: [
                    { $ifNull: ["$items.variantId", false] },
                    { $toString: "$items.variantId" },
                    "default",
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: "$lineId",
            status: "$items.status",
            price: "$soldAmount",
            name: "$product.name",
            listingType: "$product.listingType",
            unitPrice: "$unitPrice",
            quantity: "$items.quantity",
            rentalDays: "$items.rentalDays",
            rentalStartDate: "$items.rentalStartDate",
            rentalEndDate: "$items.rentalEndDate",
            productRentalStartDate: "$product.rentalStartDate",
            productRentalEndDate: "$product.rentalEndDate",
            createdAt: "$createdAt",
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
      ])) as Array<{
        _id: string;
        status: string;
        price: number;
        name: string;
        listingType?: "buy" | "rent";
        unitPrice?: number;
        quantity?: number;
        rentalDays?: number | null;
        rentalStartDate?: Date | null;
        rentalEndDate?: Date | null;
        productRentalStartDate?: Date | null;
        productRentalEndDate?: Date | null;
        createdAt: Date;
      }>;

      recentProductPurchases = productRecentAgg.map((row) => {
        const listingType = row.listingType || "buy";
        const quantity = Number(row.quantity ?? 0) > 0 ? Number(row.quantity) : 1;
        const unitPrice = Number(row.unitPrice ?? 0);
        const rentalStartDate = row.rentalStartDate ?? row.productRentalStartDate ?? null;
        const rentalEndDate = row.rentalEndDate ?? row.productRentalEndDate ?? null;
        const explicitRentalDays = Number(row.rentalDays ?? 0);

        let computedRentalDays = 0;
        if (rentalStartDate && rentalEndDate) {
          const start = new Date(rentalStartDate);
          const end = new Date(rentalEndDate);
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
            computedRentalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        const rentalDays = listingType === "rent" ? (explicitRentalDays > 0 ? explicitRentalDays : computedRentalDays || 1) : undefined;
        const price = listingType === "rent" ? unitPrice * quantity * Number(rentalDays || 1) : Number(row.price ?? unitPrice * quantity);

        return {
          _id: row._id,
          status: row.status,
          price,
          name: row.name,
          createdAt: row.createdAt,
          type: "Product" as const,
          listingType,
          unitPrice,
          quantity,
          rentalDays,
          rentalStartDate,
          rentalEndDate,
        };
      });
    }

    type CountAgg = { _id: string; count: number };
    const mergeSeries = (serviceSeries: CountAgg[], productSeries: CountAgg[]) => {
      const map = new Map<string, number>();
      serviceSeries.forEach((entry) => map.set(entry._id, (map.get(entry._id) ?? 0) + entry.count));
      productSeries.forEach((entry) => map.set(entry._id, (map.get(entry._id) ?? 0) + entry.count));
      return Array.from(map.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([name, value]) => ({ name, value }));
    };

    const purchasesData = {
      week: mergeSeries(serviceWeekAgg, productWeekAgg),
      month: mergeSeries(serviceMonthAgg, productMonthAgg),
      year: mergeSeries(serviceYearAgg, productYearAgg),
    };

    const mergedRecent = [...recentServicePurchases, ...recentProductPurchases]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((entry) => ({
        _id: `${entry.type}-${entry._id}`,
        type: entry.type,
        name: entry.name,
        price: entry.price,
        status: entry.status,
        createdAt: entry.createdAt,
        listingType: entry.listingType,
        unitPrice: entry.unitPrice,
        quantity: entry.quantity,
        rentalDays: entry.rentalDays,
        rentalStartDate: entry.rentalStartDate,
        rentalEndDate: entry.rentalEndDate,
      }));

    const todayPurchases = todayServicePurchasesCount + todayProductPurchasesCount;
    const totalPurchases = totalServicePurchasesCount + totalProductPurchasesCount;
    const todayEarnings = todayServiceAmount + todayProductAmount;
    const totalEarnings = totalServiceAmount + totalProductAmount;
    const yesterdayEarnings = yesterdayServiceAmount + yesterdayProductAmount;

    const earningsTrend = {
      today: {
        service: todayServiceAmount,
        product: todayProductAmount,
        total: todayEarnings,
      },
      yesterday: {
        service: yesterdayServiceAmount,
        product: yesterdayProductAmount,
        total: yesterdayEarnings,
      },
    };

    return NextResponse.json({
      success: true,
      capabilities: {
        services: includeServices,
        products: includeProducts,
      },
      stats: {
        todayPurchases,
        totalPurchases,
        todayEarnings,
        yesterdayEarnings,
        totalEarnings,
        todayServicePurchases: todayServicePurchasesCount,
        todayProductPurchases: todayProductPurchasesCount,
        totalServicePurchases: totalServicePurchasesCount,
        totalProductPurchases: totalProductPurchasesCount,
        todayServiceAmount,
        todayProductAmount,
        totalServiceAmount,
        totalProductAmount,
      },
      purchasesData,
      earningsTrend,
      recentPurchases: mergedRecent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute vendor stats";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}


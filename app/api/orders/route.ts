// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Stay from "@/models/Stay";
import Tour from "@/models/Tour";
import Adventure from "@/models/Adventure";
import VehicleRental from "@/models/VehicleRental";
import UserRequirement from "@/models/Userrequirement";
import Coupon from "@/models/Coupon";
import User from "@/models/User";
import Booking from "@/models/Booking";

type OrderStatus = "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Placed";

type OrderItem = {
  itemId: mongoose.Types.ObjectId;
  itemType: "Product" | "Stay" | "Tour" | "Adventure" | "VehicleRental" | "Requirement";
  quantity: number;
  rentalStartDate?: Date | null;
  rentalEndDate?: Date | null;
  rentalDays?: number | null;
  variantId?: mongoose.Types.ObjectId | null;
  variant?: {
    color?: string;
    size?: string;
    price?: number;
    photos?: string[];
  } | null;
  status?: OrderStatus;
  deliveryDate?: Date | null;
  itemData?: any;
};

type OrderLean = {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: OrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  address: any;
  status: OrderStatus;
  orderContext?: "catalog" | "requirement_deal";
  requirementDeal?: {
    requirementId?: mongoose.Types.ObjectId;
    vendorId?: mongoose.Types.ObjectId;
    confirmedPrice?: number;
  } | null;
  createdAt: Date;
};

export const GET = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const userId = (req as any).user.id;

    const orders = (await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean()) as unknown as OrderLean[];

    const requirementIds = Array.from(
      new Set(
        orders
          .filter((order) => order.orderContext === "requirement_deal" && order.requirementDeal?.requirementId)
          .map((order) => String(order.requirementDeal?.requirementId))
      )
    );

    const vendorIds = Array.from(
      new Set(
        orders
          .filter((order) => order.orderContext === "requirement_deal" && order.requirementDeal?.vendorId)
          .map((order) => String(order.requirementDeal?.vendorId))
      )
    );

    const customerIds = Array.from(new Set(orders.map((order) => String(order.user))));

    const [requirements, vendors, customers] = await Promise.all([
      requirementIds.length
        ? UserRequirement.find({ _id: { $in: requirementIds } })
            .select("_id title checkIn checkOut numberOfGuests categories")
            .lean()
        : Promise.resolve([]),
      vendorIds.length
        ? User.find({ _id: { $in: vendorIds } }).select("_id fullName").lean()
        : Promise.resolve([]),
      customerIds.length
        ? User.find({ _id: { $in: customerIds } }).select("_id fullName").lean()
        : Promise.resolve([]),
    ]);

    const requirementById = new Map(
      requirements.map((req: any) => [String(req._id), req])
    );

    const bookingRequirementCategories = new Set(["stays", "tour", "tours", "adventure", "vehicle-rental"]);
    const serviceItemTypes = new Set(["Stay", "Tour", "Adventure", "VehicleRental"]);
    const mirroredOrderIds = new Set(
      (
        await Booking.find({
          customerId: userId,
          "metadata.requirementPayment.orderId": { $exists: true },
        })
          .select("metadata.requirementPayment.orderId")
          .lean()
      )
        .map((booking: any) => booking?.metadata?.requirementPayment?.orderId)
        .filter(Boolean)
    );

    const catalogServiceOrderIds = orders
      .filter((order) => order.orderContext !== "requirement_deal")
      .filter((order) =>
        Array.isArray(order.items) && order.items.some((item) => serviceItemTypes.has(item.itemType))
      )
      .map((order) => String(order._id));

    const mirroredCatalogOrderIds = new Set(
      catalogServiceOrderIds.length
        ? (
            await Booking.find({
              customerId: userId,
              "metadata.catalogPayment.orderId": { $in: catalogServiceOrderIds },
            })
              .select("metadata.catalogPayment.orderId")
              .lean()
          )
            .map((booking: any) => booking?.metadata?.catalogPayment?.orderId)
            .filter(Boolean)
        : []
    );

    const visibleOrders = orders.filter((order) => {
      const orderId = String(order._id);
      const hasServiceItem = Array.isArray(order.items)
        ? order.items.some((item) => serviceItemTypes.has(item.itemType))
        : false;
      const hasProductItem = Array.isArray(order.items)
        ? order.items.some((item) => item.itemType === "Product")
        : false;
      const isServiceOnlyCatalogOrder =
        order.orderContext !== "requirement_deal" && hasServiceItem && !hasProductItem;

      // Service-only catalog payments should appear in Booking History once synced.
      // Keep only unsynced ones here so users can identify payment/booking sync issues.
      if (isServiceOnlyCatalogOrder) {
        return !mirroredCatalogOrderIds.has(orderId);
      }

      if (order.orderContext !== "requirement_deal" || !order.requirementDeal?.requirementId) {
        return true;
      }

      const req = requirementById.get(String(order.requirementDeal.requirementId)) as any;
      const categories = Array.isArray(req?.categories) ? req.categories : [];
      const isServiceRequirement = categories.some((category: string) => bookingRequirementCategories.has(category));

      if (!isServiceRequirement) {
        return true;
      }

      return !mirroredOrderIds.has(String(order._id));
    });
    const vendorNameById = new Map(vendors.map((vendor: any) => [String(vendor._id), vendor.fullName || "Vendor"]));
    const customerNameById = new Map(
      customers.map((customer: any) => [String(customer._id), customer.fullName || "Customer"])
    );

    // Populate item details
    const populatedOrders = await Promise.all(
      visibleOrders.map(async (order) => {
        const populatedItems = await Promise.all(
          order.items.map(async (item: OrderItem) => {
            let Model: any = null;
            switch (item.itemType) {
              case "Product":
                Model = Product;
                break;
              case "Stay":
                Model = Stay;
                break;
              case "Tour":
                Model = Tour;
                break;
              case "Adventure":
                Model = Adventure;
                break;
              case "VehicleRental":
                Model = VehicleRental;
                break;
              case "Requirement":
                Model = UserRequirement;
                break;
            }

            if (Model) {
              const itemData = await Model.findById(item.itemId)
                .select("_id name title images price basePrice category listingType rentPriceDay rentalStartDate rentalEndDate")
                .lean();

              let normalizedItem: any = {
                ...item,
                itemData,
              };

              if (item.itemType === "Product") {
                const rentalStartDate =
                  (item as any).rentalStartDate || (itemData as any)?.rentalStartDate || null;
                const rentalEndDate =
                  (item as any).rentalEndDate || (itemData as any)?.rentalEndDate || null;
                const explicitRentalDays = Number((item as any).rentalDays ?? 0);

                let computedRentalDays = 0;
                if (rentalStartDate && rentalEndDate) {
                  const start = new Date(rentalStartDate);
                  const end = new Date(rentalEndDate);
                  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
                    computedRentalDays = Math.ceil(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
                    );
                  }
                }

                const isRentProduct =
                  (itemData as any)?.listingType === "rent" ||
                  Boolean(rentalStartDate) ||
                  Boolean(rentalEndDate) ||
                  explicitRentalDays > 0;
                const rentalDays = isRentProduct
                  ? explicitRentalDays > 0
                    ? explicitRentalDays
                    : computedRentalDays || 1
                  : null;
                const quantity = Number((item as any).quantity ?? 0);
                const safeQuantity = quantity > 0 ? quantity : 1;
                const unitPrice = isRentProduct
                  ? Number(
                      (item as any)?.variant?.price ??
                        (itemData as any)?.rentPriceDay ??
                        (itemData as any)?.price ??
                        (itemData as any)?.basePrice ??
                        0
                    )
                  : Number(
                      (item as any)?.variant?.price ??
                        (itemData as any)?.price ??
                        (itemData as any)?.basePrice ??
                        0
                    );
                const lineAmount =
                  unitPrice * safeQuantity * (isRentProduct ? Number(rentalDays || 1) : 1);

                normalizedItem = {
                  ...normalizedItem,
                  rentalStartDate,
                  rentalEndDate,
                  rentalDays,
                  listingType: isRentProduct ? "rent" : (itemData as any)?.listingType || "buy",
                  unitPrice,
                  lineAmount,
                };
              }

              return {
                ...normalizedItem,
              };
            }
            return item;
          })
        );

        return {
          ...(() => {
            const orderId = String(order._id);
            const hasServiceItem = Array.isArray(order.items)
              ? order.items.some((item) => serviceItemTypes.has(item.itemType))
              : false;
            const hasProductItem = Array.isArray(order.items)
              ? order.items.some((item) => item.itemType === "Product")
              : false;
            const isServiceOnlyCatalogOrder =
              order.orderContext !== "requirement_deal" && hasServiceItem && !hasProductItem;
            const bookingSynced = isServiceOnlyCatalogOrder
              ? mirroredCatalogOrderIds.has(orderId)
              : false;
            const bookingSyncIssue =
              isServiceOnlyCatalogOrder && order.status === "Placed" && !bookingSynced;

            return {
              orderKind: isServiceOnlyCatalogOrder ? "service_payment" : "order",
              bookingSynced,
              bookingSyncIssue,
            };
          })(),
          ...order,
          items: populatedItems,
          requirementDealDetails:
            order.orderContext === "requirement_deal"
              ? (() => {
                  const requirement = order.requirementDeal?.requirementId
                    ? requirementById.get(String(order.requirementDeal.requirementId))
                    : null;

                  const checkIn = requirement?.checkIn ? new Date(requirement.checkIn) : null;
                  const checkOut = requirement?.checkOut ? new Date(requirement.checkOut) : null;
                  const numberOfDays =
                    checkIn && checkOut && checkOut > checkIn
                      ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                  return {
                    requirementTitle: requirement?.title || "Requirement",
                  amount: Number(order.requirementDeal?.confirmedPrice || order.totalAmount || 0),
                  vendorName: order.requirementDeal?.vendorId
                    ? vendorNameById.get(String(order.requirementDeal.vendorId)) || "Vendor"
                    : "Vendor",
                  customerName: customerNameById.get(String(order.user)) || order.address?.name || "Customer",
                    checkIn: requirement?.checkIn || null,
                    checkOut: requirement?.checkOut || null,
                    numberOfGuests: requirement?.numberOfGuests ?? null,
                    numberOfDays,
                  };
                })()
              : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: populatedOrders,
    });
  } catch (error: any) {
    console.error("Orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
});

export const POST = auth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const userId = (req as any).user.id;
    const body = await req.json();

    const { items, address, deliveryCharge = 0, couponCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Items are required" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { success: false, message: "Address is required" },
        { status: 400 }
      );
    }

    // Validate and calculate total amount
    let totalAmount = 0;
    const requestedTotalAmount = Number(body.totalAmount ?? 0);
    const normalizedItems: OrderItem[] = [];

    for (const item of items) {
      const { itemId, itemType, quantity, variantId, rentalStartDate, rentalEndDate } = item;

      if (!itemId || !itemType || !quantity || quantity < 1) {
        return NextResponse.json(
          { success: false, message: "Invalid item data" },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return NextResponse.json(
          { success: false, message: `Invalid item ID: ${itemId}` },
          { status: 400 }
        );
      }

      const itemObjectId = new mongoose.Types.ObjectId(itemId);
      let variantObjectId: mongoose.Types.ObjectId | null = null;
      let variantSnapshot: OrderItem["variant"] = null;

      let Model: any = null;
      switch (itemType) {
        case "Product":
          Model = Product;
          break;
        case "Stay":
          Model = Stay;
          break;
        case "Tour":
          Model = Tour;
          break;
        case "Adventure":
          Model = Adventure;
          break;
        case "VehicleRental":
          Model = VehicleRental;
          break;
        default:
          return NextResponse.json(
            { success: false, message: "Invalid item type" },
            { status: 400 }
          );
      }

      const itemData = await Model.findById(itemObjectId);
      if (!itemData) {
        return NextResponse.json(
          { success: false, message: `Item not found: ${itemId}` },
          { status: 404 }
        );
      }

      if (itemType === "Product") {
        const hasVariants = Array.isArray(itemData.variants) && itemData.variants.length > 0;
        const isRentProduct = itemData.listingType === "rent";
        let rentalDays: number | null = null;
        let normalizedRentalStartDate: Date | null = null;
        let normalizedRentalEndDate: Date | null = null;

        if (isRentProduct) {
          if (!rentalStartDate || !rentalEndDate) {
            return NextResponse.json(
              { success: false, message: "Rental start and end dates are required for rent products" },
              { status: 400 }
            );
          }

          normalizedRentalStartDate = new Date(rentalStartDate);
          normalizedRentalEndDate = new Date(rentalEndDate);

          if (Number.isNaN(normalizedRentalStartDate.getTime()) || Number.isNaN(normalizedRentalEndDate.getTime())) {
            return NextResponse.json(
              { success: false, message: "Invalid rental dates" },
              { status: 400 }
            );
          }

          if (normalizedRentalEndDate <= normalizedRentalStartDate) {
            return NextResponse.json(
              { success: false, message: "Rental end date must be after start date" },
              { status: 400 }
            );
          }

          const allowedStart = itemData.rentalStartDate ? new Date(itemData.rentalStartDate) : null;
          if (allowedStart && normalizedRentalStartDate < allowedStart) {
            return NextResponse.json(
              { success: false, message: "Selected rental start is outside availability window" },
              { status: 400 }
            );
          }

          // Allow extending beyond vendor's preferred end window for flexible rentals.

          rentalDays = Math.ceil(
            (normalizedRentalEndDate.getTime() - normalizedRentalStartDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
        }

        if (hasVariants) {
          if (!variantId) {
            return NextResponse.json(
              { success: false, message: "variantId is required for variant products" },
              { status: 400 }
            );
          }

          if (!mongoose.Types.ObjectId.isValid(variantId)) {
            return NextResponse.json(
              { success: false, message: "Invalid variantId" },
              { status: 400 }
            );
          }

          variantObjectId = new mongoose.Types.ObjectId(variantId);
          const variant = itemData.variants.id(variantObjectId);
          if (!variant) {
            return NextResponse.json(
              { success: false, message: "Selected variant not found" },
              { status: 404 }
            );
          }

          const variantStock = typeof variant.stock === "number" ? variant.stock : 0;
          if (itemData.outOfStock || variantStock <= 0) {
            return NextResponse.json(
              { success: false, message: "One or more products are out of stock" },
              { status: 400 }
            );
          }

          if (quantity > variantStock) {
            return NextResponse.json(
              { success: false, message: "Requested quantity exceeds available stock" },
              { status: 400 }
            );
          }

          variantSnapshot = {
            color: variant.color,
            size: variant.size,
            price: variant.price ?? undefined,
            photos: variant.photos ?? [],
          };

          const price = isRentProduct
            ? Number(itemData.rentPriceDay ?? variant.price ?? itemData.price ?? itemData.basePrice ?? 0)
            : Number(variant.price ?? itemData.price ?? itemData.basePrice ?? 0);
          totalAmount += price * quantity * (isRentProduct ? Number(rentalDays || 1) : 1);

          normalizedItems.push({
            itemId: itemObjectId,
            itemType,
            quantity,
            rentalStartDate: normalizedRentalStartDate,
            rentalEndDate: normalizedRentalEndDate,
            rentalDays: rentalDays ?? undefined,
            variantId: variantObjectId,
            variant: variantSnapshot,
          });
          continue;
        } else {
          const stockValue = typeof itemData.stock === "number" ? itemData.stock : null;
          if (itemData.outOfStock || (stockValue !== null && stockValue <= 0)) {
            return NextResponse.json(
              { success: false, message: "One or more products are out of stock" },
              { status: 400 }
            );
          }

          if (stockValue !== null && quantity > stockValue) {
            return NextResponse.json(
              { success: false, message: "Requested quantity exceeds available stock" },
              { status: 400 }
            );
          }

          const price = isRentProduct
            ? Number(itemData.rentPriceDay ?? itemData.price ?? itemData.basePrice ?? 0)
            : Number(itemData.price ?? itemData.basePrice ?? 0);
          totalAmount += price * quantity * (isRentProduct ? Number(rentalDays || 1) : 1);

          normalizedItems.push({
            itemId: itemObjectId,
            itemType,
            quantity,
            rentalStartDate: normalizedRentalStartDate,
            rentalEndDate: normalizedRentalEndDate,
            rentalDays: rentalDays ?? undefined,
            variantId: variantObjectId,
            variant: variantSnapshot,
          });
          continue;
        }
      } else {
        const price = itemData.price || itemData.basePrice || 0;
        totalAmount += price * quantity;
      }

      normalizedItems.push({
        itemId: itemObjectId,
        itemType,
        quantity,
        variantId: variantObjectId,
        variant: variantSnapshot,
      });
    }

    const isServiceOnlyOrder =
      normalizedItems.length > 0 &&
      normalizedItems.every((item) => item.itemType !== "Product");

    if (isServiceOnlyOrder) {
      if (!Number.isFinite(requestedTotalAmount) || requestedTotalAmount <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid payable amount for service order" },
          { status: 400 }
        );
      }
      totalAmount = requestedTotalAmount;
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid payable amount" },
        { status: 400 }
      );
    }

    // Handle Coupon
    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      appliedCoupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });

      if (appliedCoupon) {
        const now = new Date();
        const isValid =
          appliedCoupon.startDate <= now &&
          appliedCoupon.expiryDate >= now &&
          totalAmount >= appliedCoupon.minPurchase &&
          (!appliedCoupon.usageLimit || appliedCoupon.usageCount < appliedCoupon.usageLimit);

        if (isValid) {
          if (appliedCoupon.discountType === "percentage") {
            discountAmount = (totalAmount * appliedCoupon.discountAmount) / 100;
            if (appliedCoupon.maxDiscount && discountAmount > appliedCoupon.maxDiscount) {
              discountAmount = appliedCoupon.maxDiscount;
            }
          } else {
            discountAmount = appliedCoupon.discountAmount;
          }

          // Ensure discount doesn't exceed total
          discountAmount = Math.min(discountAmount, totalAmount);
          totalAmount -= discountAmount;
        }
      }
    }

    // Create order
    const orderItemsForSave = normalizedItems.map((item) => ({
      ...item,
      status: "Pending" as OrderStatus,
      deliveryDate: null,
    }));

    const order = await Order.create({
      user: userId,
      items: orderItemsForSave,
      totalAmount,
      deliveryCharge,
      address,
      status: "Pending",
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      discountAmount,
    });

    // Update coupon usage count
    if (appliedCoupon && discountAmount > 0) {
      await Coupon.findByIdAndUpdate(appliedCoupon._id, {
        $inc: { usageCount: 1 },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error: any) {
    console.error("Order POST error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to place order" },
      { status: 500 }
    );
  }
});


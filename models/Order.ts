// models/Order.ts
import mongoose, { Schema, Document } from "mongoose";

export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Placed";

export interface IOrderItem {
  itemId: mongoose.Types.ObjectId;
  itemType: "Product" | "Stay" | "Tour" | "Adventure" | "VehicleRental" | "Requirement";
  quantity: number;
  rentalStartDate?: Date | null;
  rentalEndDate?: Date | null;
  rentalDays?: number;
  variantId?: mongoose.Types.ObjectId | null;
  variant?: {
    color?: string;
    size?: string;
    price?: number;
    photos?: string[];
  } | null;
  status?: OrderStatus;
  deliveryDate?: Date | null;
}

export interface ICancellationBreakdown {
  policyVersion: string;
  policyBand: string;
  policyLabel: string;
  bookingAmount: number;
  arrivalDate: string | null;
  cancelledAt: string;
  daysBeforeArrival: number | null;
  deductionPercent: number;
  deductionAmount: number;
  refundAmount: number;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  address: {
    name: string;
    phone: string;
    pincode: string;
    address: string;
    city: string;
    state: string;
    landmark?: string;
  };
  status: OrderStatus;
  couponCode?: string | null;
  discountAmount?: number;
  cancellationReason?: string | null;
  cancelledBy?: mongoose.Types.ObjectId | null;
  cancelledAt?: Date | null;
  cancelledByRole?: "user" | "vendor" | "admin" | null;
  cancellationBreakdown?: ICancellationBreakdown | null;
  orderContext?: "catalog" | "requirement_deal";
  requirementDeal?: {
    requirementId: mongoose.Types.ObjectId;
    vendorId: mongoose.Types.ObjectId;
    confirmedPrice: number;
    commissionRate?: number;
    commissionAmount?: number;
    totalPayable?: number;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemType: {
      type: String,
      enum: ["Product", "Stay", "Tour", "Adventure", "VehicleRental", "Requirement"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    rentalStartDate: { type: Date, default: null },
    rentalEndDate: { type: Date, default: null },
    rentalDays: { type: Number, default: null, min: 1 },
    variantId: { type: Schema.Types.ObjectId, default: null },
    variant: {
      color: String,
      size: String,
      price: Number,
      photos: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Placed"],
      default: "Pending",
    },
    deliveryDate: { type: Date, default: null },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    address: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      pincode: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      landmark: { type: String },
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Placed"],
      default: "Pending",
    },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    cancellationReason: { type: String, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelledByRole: { type: String, enum: ["user", "vendor", "admin"], default: null },
    cancellationBreakdown: { type: Schema.Types.Mixed, default: null },
    orderContext: {
      type: String,
      enum: ["catalog", "requirement_deal"],
      default: "catalog",
    },
    requirementDeal: {
      requirementId: { type: Schema.Types.ObjectId, ref: "UserRequirement", default: null },
      vendorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
      confirmedPrice: { type: Number, min: 0, default: null },
      commissionRate: { type: Number, min: 0, default: 0 },
      commissionAmount: { type: Number, min: 0, default: 0 },
      totalPayable: { type: Number, min: 0, default: null },
    },
  },
  { timestamps: true }
);

// Index for fast user lookup
OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

const existingOrderModel = mongoose.models.Order as mongoose.Model<IOrder> | undefined;
if (existingOrderModel) {
  const itemTypeEnum = (existingOrderModel.schema.path("items") as any)
    ?.schema?.path("itemType")?.options?.enum as string[] | undefined;

  // In dev/hot-reload, refresh stale cached model so newly added enum values are applied.
  if (!Array.isArray(itemTypeEnum) || !itemTypeEnum.includes("Requirement")) {
    delete mongoose.models.Order;
  }
}

const OrderModel = (mongoose.models.Order as mongoose.Model<IOrder>) ||
  mongoose.model<IOrder>("Order", OrderSchema);

export default OrderModel;


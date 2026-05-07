// models/Coupon.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  discountType: "percentage" | "fixed";
  discountAmount: number;
  minPurchase: number;
  maxDiscount?: number;
  startDate: Date;
  expiryDate: Date;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;

  // ── Personalized coupon fields ───────────────────────────────────────────
  isPersonalized: boolean;          // true = assigned to a specific email
  assignedToEmail?: string;         // email this coupon is locked to
  assignedToName?: string;          // display name (optional, for email)
  assignedAt?: Date;                // when admin assigned it
  assignedBy?: mongoose.Types.ObjectId; // admin userId
  isUsed: boolean;                  // one-time use flag
  usedBy?: mongoose.Types.ObjectId; // userId who redeemed it
  usedAt?: Date;                    // when it was redeemed

  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchase: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ── Personalized fields ───────────────────────────────────────────────
    isPersonalized: {
      type: Boolean,
      default: false,
    },
    assignedToEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    assignedToName: {
      type: String,
      trim: true,
    },
    assignedAt: {
      type: Date,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    usedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for fast lookup by email
CouponSchema.index({ assignedToEmail: 1, isPersonalized: 1 });
CouponSchema.index({ code: 1, isActive: 1 });

export default mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema);
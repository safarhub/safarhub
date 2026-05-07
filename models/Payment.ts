import mongoose, { Schema, Document } from "mongoose";

export type PaymentStatus = "created" | "captured" | "failed";

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: "razorpay";
  status: PaymentStatus;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  failureReason?: string;
  raw?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["razorpay"], default: "razorpay" },
    status: { type: String, enum: ["created", "captured", "failed"], default: "created" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, index: true, unique: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    failureReason: { type: String },
    raw: Schema.Types.Mixed,
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1, provider: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", PaymentSchema);
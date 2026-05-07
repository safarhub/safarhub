import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  requirementId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  message: string;
  kind?: "preset" | "price_offer" | "price_counter" | "price_accept" | "drive_link" | "system";
  priceAmount?: number | null;
  linkUrl?: string | null;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: "UserRequirement",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    kind: {
      type: String,
      enum: ["preset", "price_offer", "price_counter", "price_accept", "drive_link", "system"],
      default: "preset",
    },
    priceAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    linkUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
MessageSchema.index({ requirementId: 1, createdAt: 1 });

export default mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);

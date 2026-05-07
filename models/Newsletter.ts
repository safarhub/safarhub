import mongoose, { Schema, Document } from "mongoose";

export interface INewsletter extends Document {
  email: string;
  subscribed: boolean;
  consent: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  isVerified: boolean;
  unsubscribedAt?: Date;
  unsubscribeToken?: string;
  subscribedAt: Date;
  updatedAt?: Date;
}

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    subscribed: { type: Boolean, default: true },
    consent: { type: Boolean, required: true },
    verificationToken: String,
    verificationTokenExpiry: Date,
    isVerified: { type: Boolean, default: false },
    unsubscribedAt: Date,
    unsubscribeToken: String,
    subscribedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Newsletter ||
  mongoose.model<INewsletter>("Newsletter", newsletterSchema);

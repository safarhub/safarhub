import mongoose, { Document, Schema } from "mongoose";

export interface IStayBookingLock extends Document {
  stayId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt?: Date;
}

const stayBookingLockSchema = new Schema<IStayBookingLock>(
  {
    stayId: {
      type: Schema.Types.ObjectId,
      ref: "Stay",
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 45 * 1000),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stayBookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.StayBookingLock ||
  mongoose.model<IStayBookingLock>("StayBookingLock", stayBookingLockSchema);

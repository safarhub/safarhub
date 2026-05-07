import mongoose, { Document, Schema } from "mongoose";

export interface IStayRoomBlock extends Document {
  stayId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId;
  roomName: string;
  startDate: Date;
  endDate: Date;
  blockedCount: number;
  reason?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const stayRoomBlockSchema = new Schema<IStayRoomBlock>(
  {
    stayId: { type: Schema.Types.ObjectId, ref: "Stay", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId },
    roomName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    blockedCount: { type: Number, required: true, min: 1, default: 1 },
    reason: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

stayRoomBlockSchema.index({ stayId: 1, roomId: 1, startDate: 1, endDate: 1, isActive: 1 });
stayRoomBlockSchema.index({ vendorId: 1, stayId: 1, isActive: 1, startDate: 1 });

export default mongoose.models.StayRoomBlock ||
  mongoose.model<IStayRoomBlock>("StayRoomBlock", stayRoomBlockSchema);

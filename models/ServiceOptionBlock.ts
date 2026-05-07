import mongoose, { Document, Schema } from "mongoose";

export type BlockedServiceType = "tour" | "adventure" | "vehicle";

export interface IServiceOptionBlock extends Document {
  serviceType: BlockedServiceType;
  serviceId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  optionId?: mongoose.Types.ObjectId;
  optionName: string;
  startDate: Date;
  endDate: Date;
  blockedCount: number;
  reason?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const serviceOptionBlockSchema = new Schema<IServiceOptionBlock>(
  {
    serviceType: {
      type: String,
      enum: ["tour", "adventure", "vehicle"],
      required: true,
      index: true,
    },
    serviceId: { type: Schema.Types.ObjectId, required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    optionId: { type: Schema.Types.ObjectId },
    optionName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    blockedCount: { type: Number, required: true, min: 1, default: 1 },
    reason: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

serviceOptionBlockSchema.index({
  serviceType: 1,
  serviceId: 1,
  optionId: 1,
  startDate: 1,
  endDate: 1,
  isActive: 1,
});
serviceOptionBlockSchema.index({ vendorId: 1, serviceType: 1, serviceId: 1, isActive: 1, startDate: 1 });

export default mongoose.models.ServiceOptionBlock ||
  mongoose.model<IServiceOptionBlock>("ServiceOptionBlock", serviceOptionBlockSchema);

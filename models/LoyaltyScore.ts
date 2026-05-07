import mongoose, { Schema, Document } from "mongoose";

export type UserLevel = "Scout" | "Explorer" | "Traveller" | "Adventurer" | "Safarite";
export type VendorLevel = "Seedling" | "Beginner" | "Trailblazer" | "Summit" | "Safarite Pro";

export interface IPenaltyEvent {
  event: string;
  scoreDeduction: number;
  levelImpact?: string;
  recoveryPath?: string;
  appliedAt: Date;
  appliedBy?: mongoose.Types.ObjectId;
  note?: string;
}

export interface IDemotionRecord {
  fromLevel: string;
  toLevel: string;
  at: Date;
  reason: string;
}

export interface ILoyaltyScore extends Document {
  userId: mongoose.Types.ObjectId;
  accountType: "user" | "vendor";

  level: string;
  compositeScore: number;

  metrics: {
    // Common
    totalBookings: number;
    avgRating: number;
    cancellations: number;
    policyViolations: number;
    // User-specific
    ratingsGiven: number;
    promoActivity: number;
    noShows: number;
    // Vendor-specific
    totalRevenue: number;
    fakeReviewAttempts: number;
    repeatCancellations: number;
  };

  penaltyHistory: IPenaltyEvent[];
  penaltyScoreTotal: number;

  demotionCount: number;
  demotionHistory: IDemotionRecord[];
  levelFrozen: boolean;
  frozenUntil?: Date;
  freezeReason?: string;

  isSuspended: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;

  scoreBelowThresholdSince?: Date;

  // Perks
  currentDiscount: number;
  perks: string[];

  lastCalculated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const penaltyEventSchema = new Schema<IPenaltyEvent>(
  {
    event: { type: String, required: true },
    scoreDeduction: { type: Number, required: true },
    levelImpact: String,
    recoveryPath: String,
    appliedAt: { type: Date, default: Date.now },
    appliedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: String,
  },
  { _id: false }
);

const demotionRecordSchema = new Schema<IDemotionRecord>(
  {
    fromLevel: { type: String, required: true },
    toLevel: { type: String, required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const loyaltyScoreSchema = new Schema<ILoyaltyScore>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    accountType: { type: String, enum: ["user", "vendor"], required: true },

    level: { type: String, default: "Scout" },
    compositeScore: { type: Number, default: 0 },

    metrics: {
      totalBookings: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      cancellations: { type: Number, default: 0 },
      policyViolations: { type: Number, default: 0 },
      ratingsGiven: { type: Number, default: 0 },
      promoActivity: { type: Number, default: 0 },
      noShows: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      fakeReviewAttempts: { type: Number, default: 0 },
      repeatCancellations: { type: Number, default: 0 },
    },

    penaltyHistory: { type: [penaltyEventSchema], default: [] },
    penaltyScoreTotal: { type: Number, default: 0 },

    demotionCount: { type: Number, default: 0 },
    demotionHistory: { type: [demotionRecordSchema], default: [] },
    levelFrozen: { type: Boolean, default: false },
    frozenUntil: Date,
    freezeReason: String,

    isSuspended: { type: Boolean, default: false },
    suspendedAt: Date,
    suspensionReason: String,

    scoreBelowThresholdSince: Date,

    currentDiscount: { type: Number, default: 0 },
    perks: { type: [String], default: [] },

    lastCalculated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.LoyaltyScore ||
  mongoose.model<ILoyaltyScore>("LoyaltyScore", loyaltyScoreSchema);
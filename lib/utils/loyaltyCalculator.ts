// lib/utils/loyaltyCalculator.ts
// All logic derived from SafarHub Financial Planning PDF

// ─── USER LEVELS ─────────────────────────────────────────────────────────────
export const USER_LEVELS = [
  {
    name: "Scout",
    minScore: 0,
    discount: 0,
    perks: ["Platform Dashboard", "Normal pricing"],
    color: "#6b7280",
    badge: "🏕️",
  },
  {
    name: "Explorer",
    minScore: 10,
    discount: 2.5,
    perks: ["Leaderboard Entry", "Blog/Insta Story post", "2.5% discount on invoice >₹4000"],
    color: "#3b82f6",
    badge: "🧭",
  },
  {
    name: "Traveller",
    minScore: 50,
    discount: 5,
    perks: ["Top 50", "One free Breakfast", "Insta Story cover", "5% discount on invoice >₹4000"],
    color: "#8b5cf6",
    badge: "✈️",
  },
  {
    name: "Adventurer",
    minScore: 100,
    discount: 10,
    perks: [
      "Free Breakfast",
      "Featured on platform",
      "Permit to Publish Blog",
      "Insta Story Cover",
      "Top 10",
      "₹99 optional subscription for upgradation",
      "10% discount on invoice >₹4000",
    ],
    color: "#f59e0b",
    badge: "🏔️",
  },
  {
    name: "Safarite",
    minScore: 200,
    discount: 10,
    perks: [
      "Free Premium Membership",
      "Customize Vacation Planning",
      "Regional Place Visit",
      "Local Community Meetup Bonfire",
      "Top 5",
      "Free Premium service + Commission Reduction",
    ],
    color: "#10b981",
    badge: "🌟",
  },
];

// ─── VENDOR LEVELS ───────────────────────────────────────────────────────────
export const VENDOR_LEVELS = [
  {
    name: "Seedling",
    minScore: 0,
    perks: ["Standard Listing"],
    color: "#6b7280",
    badge: "🌱",
  },
  {
    name: "Beginner",
    minScore: 105,
    perks: ["Explorer tag on profile", "Top 100 list"],
    color: "#3b82f6",
    badge: "🌿",
  },
  {
    name: "Trailblazer",
    minScore: 275,
    perks: ["Boosted in search results", "Top 50 list"],
    color: "#8b5cf6",
    badge: "🔥",
  },
  {
    name: "Summit",
    minScore: 530,
    perks: [
      "Featured on category page",
      "Featured in Instagram",
      "Special Blog Post",
      "Top 5 in search result",
    ],
    color: "#f59e0b",
    badge: "⛰️",
  },
  {
    name: "Safarite Pro",
    minScore: 900,
    perks: [
      "Homepage spotlight",
      "Top 5",
      "Community Programme",
      "Commission Reduction",
      "Social Media Promotion",
      "Priority in search result",
      "Customized booking option venue",
    ],
    color: "#10b981",
    badge: "👑",
  },
];

// ─── USER SCORE CALCULATION ───────────────────────────────────────────────────
export interface UserMetrics {
  totalBookings: number;
  ratingsGiven: number;      // ratings given to vendors (promoActivity proxy)
  promoActivity: number;     // blog posts, social activity
  policyViolations: number;
  cancellations: number;
  noShows: number;
  ratingDroppedBelow3: boolean;
}

export function calculateUserScore(metrics: UserMetrics): number {
  const bookingScore = metrics.totalBookings * 2.5;
  const ratingScore = metrics.ratingsGiven * 10;
  const promoScore = metrics.promoActivity * 5;
  // Temporarily disable all deduction logic.
  const violationPenalty = 0;
  const cancellationPenalty = 0;
  const noShowPenalty = 0;
  const ratingDropPenalty = 0;

  return Math.max(
    0,
    bookingScore + ratingScore + promoScore + violationPenalty + cancellationPenalty + noShowPenalty + ratingDropPenalty
  );
}

// ─── VENDOR SCORE CALCULATION ─────────────────────────────────────────────────
export interface VendorMetrics {
  totalBookings: number;
  totalRevenue: number;      // in ₹
  avgRating: number;
  cancellations: number;
  policyViolations: number;
  noShows: number;
  repeatCancellations: number; // 3+/month triggers
  fakeReviewAttempts: number;
}

export function calculateVendorScore(metrics: VendorMetrics): number {
  const bookingScore = metrics.totalBookings * 5;
  const revenueScore = metrics.totalRevenue / 1000;
  const ratingScore = metrics.avgRating * 10;
  // Temporarily disable all deduction logic.
  const cancellationPenalty = 0;
  const violationPenalty = 0;
  const noShowPenalty = 0;
  const repeatCancelPenalty = 0;
  const fakeReviewPenalty = 0;

  return Math.max(
    0,
    bookingScore + revenueScore + ratingScore + cancellationPenalty + violationPenalty + noShowPenalty + repeatCancelPenalty + fakeReviewPenalty
  );
}

// ─── LEVEL RESOLVER ───────────────────────────────────────────────────────────
export function resolveUserLevel(score: number) {
  const sorted = [...USER_LEVELS].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((l) => score >= l.minScore) ?? USER_LEVELS[0];
}

export function resolveVendorLevel(score: number) {
  const sorted = [...VENDOR_LEVELS].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((l) => score >= l.minScore) ?? VENDOR_LEVELS[0];
}

// ─── NEXT LEVEL INFO ─────────────────────────────────────────────────────────
export function getNextLevel(score: number, accountType: "user" | "vendor") {
  const levels = accountType === "user" ? USER_LEVELS : VENDOR_LEVELS;
  const sorted = [...levels].sort((a, b) => a.minScore - b.minScore);
  const next = sorted.find((l) => l.minScore > score);
  return next ?? null;
}

export function getLevelProgress(score: number, accountType: "user" | "vendor"): number {
  const levels = accountType === "user" ? USER_LEVELS : VENDOR_LEVELS;
  const sorted = [...levels].sort((a, b) => a.minScore - b.minScore);
  const currentLevelIndex = [...sorted].reverse().findIndex((l) => score >= l.minScore);
  const current = sorted[sorted.length - 1 - currentLevelIndex];
  const next = sorted.find((l) => l.minScore > score);

  if (!next) return 100; // max level
  if (!current) return 0;

  const range = next.minScore - current.minScore;
  const progress = score - current.minScore;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ─── DEMOTION CHECK ──────────────────────────────────────────────────────────
export function shouldDemote(
  currentLevelName: string,
  compositeScore: number,
  accountType: "user" | "vendor"
): boolean {
  const levels = accountType === "user" ? USER_LEVELS : VENDOR_LEVELS;
  const current = levels.find((l) => l.name === currentLevelName);
  if (!current) return false;
  // Demotion if score falls 30% below level threshold
  const threshold = current.minScore * 0.7;
  return compositeScore < threshold && current.minScore > 0;
}

export function getPreviousLevel(currentLevelName: string, accountType: "user" | "vendor") {
  const levels = accountType === "user" ? USER_LEVELS : VENDOR_LEVELS;
  const sorted = [...levels].sort((a, b) => a.minScore - b.minScore);
  const idx = sorted.findIndex((l) => l.name === currentLevelName);
  return idx > 0 ? sorted[idx - 1] : sorted[0];
}
"use client";
// app/profile/page.tsx  ← REPLACE your existing file with this

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfileLayout } from "./ProfileLayoutContext";
import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LevelData {
  name: string;
  minScore: number;
  discount?: number;
  perks: string[];
  color: string;
  badge: string;
}

interface LoyaltyData {
  accountType: "user" | "vendor";
  level: LevelData;
  compositeScore: number;
  nextLevel: LevelData | null;
  progress: number;
  metrics: {
    totalBookings: number;
    avgRating: number;
    cancellations: number;
    policyViolations: number;
    ratingsGiven?: number;
    totalRevenue?: number;
    promoActivity?: number;
    noShows?: number;
  };
  penaltyHistory: Array<{ event: string; scoreDeduction: number; appliedAt: string; note?: string }>;
  currentDiscount?: number;
  isSuspended: boolean;
  levelFrozen: boolean;
  demotionCount: number;
  demotionHistory: Array<{ fromLevel: string; toLevel: string; at: string; reason: string }>;
}

const LEVEL_BADGE_COLORS: Record<string, string> = {
  Scout: "bg-gray-100 text-gray-700 border-gray-300",
  Explorer: "bg-blue-100 text-blue-700 border-blue-300",
  Traveller: "bg-violet-100 text-violet-700 border-violet-300",
  Adventurer: "bg-amber-100 text-amber-700 border-amber-300",
  Safarite: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Seedling: "bg-gray-100 text-gray-700 border-gray-300",
  Beginner: "bg-blue-100 text-blue-700 border-blue-300",
  Trailblazer: "bg-violet-100 text-violet-700 border-violet-300",
  Summit: "bg-amber-100 text-amber-700 border-amber-300",
  "Safarite Pro": "bg-emerald-100 text-emerald-700 border-emerald-300",
};

const PROGRESS_BAR_COLORS: Record<string, string> = {
  Scout: "from-gray-400 to-gray-500",
  Explorer: "from-blue-400 to-blue-600",
  Traveller: "from-violet-400 to-violet-600",
  Adventurer: "from-amber-400 to-yellow-500",
  Safarite: "from-emerald-400 to-teal-500",
  Seedling: "from-gray-400 to-gray-500",
  Beginner: "from-blue-400 to-blue-600",
  Trailblazer: "from-violet-400 to-violet-600",
  Summit: "from-amber-400 to-yellow-500",
  "Safarite Pro": "from-emerald-400 to-teal-500",
};

// ── Avatar component ──────────────────────────────────────────────────────────
function Avatar({ user, size = 64 }: { user: any; size?: number }) {
  if (user.avatar) {
    return (
      <Image
        src={user.avatar}
        alt="Profile"
        width={size}
        height={size}
        className="rounded-full border-4 border-green-200 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const first = user.fullName?.trim().charAt(0).toUpperCase() ?? "U";
  return (
    <div
      className="rounded-full border-4 border-green-200 flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: "linear-gradient(to bottom right, #a855f7, #ec4899)",
      }}
    >
      {first}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { user } = useProfileLayout();
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);

  useEffect(() => {
    const fetchLoyalty = async () => {
      try {
        const res = await fetch("/api/loyalty/me");
        const data = await res.json();
        if (data.success) setLoyalty(data.loyalty);
      } catch {
        // ignore
      } finally {
        setLoyaltyLoading(false);
      }
    };
    fetchLoyalty();
  }, []);

  if (!user) return null;

  const levelName = loyalty?.level?.name ?? (user.accountType === "vendor" ? "Seedling" : "Scout");
  const badgeClass = LEVEL_BADGE_COLORS[levelName] ?? LEVEL_BADGE_COLORS["Scout"];
  const barClass = PROGRESS_BAR_COLORS[levelName] ?? PROGRESS_BAR_COLORS["Scout"];

  return (
    <div className="flex flex-col gap-6 pt-15">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button
            onClick={() => router.push("/")}
            className="bg-linear-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 md:px-5 py-2 rounded-xl font-medium shadow-md transition-all duration-200 text-sm"
          >
            Back to Home
          </button>
          <button
            onClick={() => router.push("/profile/requirements")}
            className="bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 md:px-6 py-2 rounded-xl font-medium shadow-md transition-all duration-200 text-sm"
          >
            Post Requirement
          </button>
          <button
            onClick={() => router.push("/profile/edit")}
            className="bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 md:px-6 py-2 rounded-xl font-medium shadow-md transition-all duration-200 text-sm"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* ── Profile card ────────────────────────────────────────────────── */}
      <div className="bg-white shadow-xl rounded-3xl p-6 md:p-8">
        <div className="flex gap-4 md:gap-6 mb-8 items-center">
          <div className="md:hidden"><Avatar user={user} size={80} /></div>
          <div className="hidden md:block"><Avatar user={user} size={100} /></div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-800">{user.fullName}</h2>
              {loyalty && (
                <span className={`text-xs font-semibold border px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                  {loyalty.level.badge} {loyalty.level.name}
                </span>
              )}
              {loyalty?.isSuspended && (
                <span className="text-xs font-semibold bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full">
                  🚫 Suspended
                </span>
              )}
              {loyalty?.levelFrozen && !loyalty.isSuspended && (
                <span className="text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300 px-2.5 py-0.5 rounded-full">
                  🔒 Level Frozen
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-1">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
          <div>
            <p className="mb-3"><span className="font-semibold text-gray-800">Full Name:</span> {user.fullName}</p>
            <p className="mb-3"><span className="font-semibold text-gray-800">Phone:</span> {user.contactNumber || "N/A"}</p>
            <p className="mb-3"><span className="font-semibold text-gray-800">Gender:</span> {user.additionalDetails?.gender || "N/A"}</p>
            <p className="mb-3">
              <span className="font-semibold text-gray-800">Address:</span>{" "}
              {(() => {
                const address = user.additionalDetails?.addresses?.[0];
                if (!address) return "N/A";
                const parts = [address.street, address.city, address.state].filter(Boolean);
                return parts.length ? parts.join(", ") : "N/A";
              })()}
            </p>
          </div>
          <div>
            <p className="mb-3"><span className="font-semibold text-gray-800">Email:</span> {user.email}</p>
            <p className="mb-3"><span className="font-semibold text-gray-800">Age:</span> {user.age || "N/A"}</p>
            <p className="mb-3"><span className="font-semibold text-gray-800">DOB:</span> {user.additionalDetails?.dateOfBirth || "N/A"}</p>
            <p><span className="font-semibold text-gray-800">About:</span> {user.additionalDetails?.about || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* ── Loyalty Progress Card ────────────────────────────────────────── */}
      <div className="bg-white shadow-xl rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            🏆 Loyalty Progress
          </h2>
          {loyalty && (
            <span className="text-xs text-gray-400">
              Last updated: {new Date(loyalty.level?.name ? Date.now() : Date.now()).toLocaleDateString()}
            </span>
          )}
        </div>

        {loyaltyLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
          </div>
        ) : loyalty ? (
          <div className="space-y-6">
            {/* Level + Score overview */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${badgeClass} text-lg font-bold`}>
                <span className="text-2xl">{loyalty.level.badge}</span>
                <span>{loyalty.level.name}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-gray-600 font-medium">
                    Score: <span className="font-bold text-gray-800">{loyalty.compositeScore.toFixed(1)}</span>
                  </span>
                  {loyalty.nextLevel && (
                    <span className="text-sm text-gray-400">
                      Next: {loyalty.nextLevel.badge} {loyalty.nextLevel.name} ({loyalty.nextLevel.minScore} pts)
                    </span>
                  )}
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${loyalty.progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${barClass}`}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{loyalty.progress}% to next level</p>
              </div>
            </div>

            {/* Metrics grid */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Score Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ScoreCard
                  icon="📦"
                  label="Total Bookings"
                  value={loyalty.metrics.totalBookings}
                  sub={loyalty.accountType === "vendor" ? `+${(loyalty.metrics.totalBookings * 5).toFixed(0)} pts` : `+${(loyalty.metrics.totalBookings * 2.5).toFixed(1)} pts`}
                  positive
                />
                {loyalty.accountType === "vendor" ? (
                  <ScoreCard
                    icon="💰"
                    label="Total Revenue"
                    value={`₹${((loyalty.metrics.totalRevenue ?? 0) / 1000).toFixed(1)}k`}
                    sub={`+${((loyalty.metrics.totalRevenue ?? 0) / 1000).toFixed(1)} pts`}
                    positive
                  />
                ) : (
                  <ScoreCard
                    icon="⭐"
                    label="Reviews Given"
                    value={loyalty.metrics.ratingsGiven ?? 0}
                    sub={`+${((loyalty.metrics.ratingsGiven ?? 0) * 10).toFixed(0)} pts`}
                    positive
                  />
                )}
                <ScoreCard
                  icon="🌟"
                  label="Avg Rating"
                  value={loyalty.metrics.avgRating ? loyalty.metrics.avgRating.toFixed(1) : "N/A"}
                  sub={loyalty.accountType === "vendor" ? `+${(loyalty.metrics.avgRating * 10).toFixed(0)} pts` : ""}
                  positive
                />
                <ScoreCard
                  icon="❌"
                  label="Cancellations"
                  value={loyalty.metrics.cancellations}
                  sub={loyalty.accountType === "vendor" ? `-${(loyalty.metrics.cancellations * 2.5).toFixed(1)} pts` : `-${(loyalty.metrics.cancellations * 2).toFixed(0)} pts`}
                  positive={false}
                />
                <ScoreCard
                  icon="⚠️"
                  label="Policy Violations"
                  value={loyalty.metrics.policyViolations}
                  sub={`-${(loyalty.metrics.policyViolations * 5).toFixed(0)} pts`}
                  positive={false}
                />
                {loyalty.accountType === "user" && (
                  <ScoreCard
                    icon="📣"
                    label="Promo Activity"
                    value={loyalty.metrics.promoActivity ?? 0}
                    sub={`+${((loyalty.metrics.promoActivity ?? 0) * 5).toFixed(0)} pts`}
                    positive
                  />
                )}
                <ScoreCard
                  icon="🚫"
                  label="No-Shows"
                  value={loyalty.metrics.noShows ?? 0}
                  sub={loyalty.accountType === "vendor" ? `-${((loyalty.metrics.noShows ?? 0) * 12).toFixed(0)} pts` : `-${((loyalty.metrics.noShows ?? 0) * 5).toFixed(0)} pts`}
                  positive={false}
                />
              </div>
            </div>

            {/* Perks */}
            {loyalty.level.perks?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Your Current Perks</h3>
                <div className="flex flex-wrap gap-2">
                  {loyalty.level.perks.map((perk, i) => (
                    <span
                      key={i}
                      className={`text-xs font-medium border px-3 py-1 rounded-full ${badgeClass}`}
                    >
                      ✓ {perk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Discount */}
            {(loyalty.currentDiscount ?? 0) > 0 && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                <span className="text-2xl">🎟️</span>
                <div>
                  <p className="text-emerald-800 font-semibold text-sm">
                    {loyalty.currentDiscount}% Discount on all bookings above ₹4,000
                  </p>
                  <p className="text-emerald-600 text-xs">Applied automatically at checkout</p>
                </div>
              </div>
            )}

            {/* Penalty history */}
            {loyalty.penaltyHistory?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-500 mb-2">⚠️ Recent Penalties</h3>
                <div className="rounded-xl border border-red-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 text-red-700">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Event</th>
                        <th className="text-right px-4 py-2 font-medium">Score</th>
                        <th className="text-right px-4 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyalty.penaltyHistory.map((p, i) => (
                        <tr key={i} className="border-t border-red-50">
                          <td className="px-4 py-2 text-gray-700">{p.event}</td>
                          <td className="px-4 py-2 text-right text-red-600 font-semibold">
                            -{p.scoreDeduction}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 text-xs">
                            {new Date(p.appliedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Demotion history */}
            {loyalty.demotionHistory?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-orange-500 mb-2">📉 Demotion History</h3>
                <div className="space-y-2">
                  {loyalty.demotionHistory.map((d, i) => (
                    <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2 text-sm text-gray-700">
                      Demoted from <strong>{d.fromLevel}</strong> → <strong>{d.toLevel}</strong>{" "}
                      <span className="text-gray-400">on {new Date(d.at).toLocaleDateString()}</span>
                      <span className="text-gray-500 ml-1">({d.reason})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">🏕️</p>
            <p>Start booking to begin your loyalty journey!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score card tile ───────────────────────────────────────────────────────────
function ScoreCard({
  icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub: string;
  positive: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${positive ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
      <p className="text-gray-500 text-xs mb-1">{icon} {label}</p>
      <p className={`text-lg font-bold ${positive ? "text-green-700" : "text-red-600"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${positive ? "text-green-500" : "text-red-400"}`}>{sub}</p>}
    </div>
  );
}
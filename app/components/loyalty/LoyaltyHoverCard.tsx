"use client";
// app/components/loyalty/LoyaltyHoverCard.tsx

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LevelData {
  name: string;
  minScore: number;
  discount: number;
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
  };
  penaltyHistory: Array<{ event: string; scoreDeduction: number; appliedAt: string }>;
  currentDiscount?: number;
  isSuspended: boolean;
  levelFrozen: boolean;
  demotionCount: number;
}

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Scout:        { bg: "from-gray-700 to-gray-600",    border: "border-gray-500",  text: "text-gray-300",  glow: "shadow-gray-500/30" },
  Explorer:     { bg: "from-blue-700 to-blue-600",    border: "border-blue-400",  text: "text-blue-300",  glow: "shadow-blue-500/40" },
  Traveller:    { bg: "from-violet-700 to-violet-600",border: "border-violet-400",text: "text-violet-300",glow: "shadow-violet-500/40" },
  Adventurer:   { bg: "from-amber-600 to-yellow-500", border: "border-amber-400", text: "text-amber-200", glow: "shadow-amber-500/40" },
  Safarite:     { bg: "from-emerald-700 to-teal-600", border: "border-emerald-400",text: "text-emerald-200",glow:"shadow-emerald-500/40"},
  Seedling:     { bg: "from-gray-700 to-gray-600",    border: "border-gray-500",  text: "text-gray-300",  glow: "shadow-gray-500/30" },
  Beginner:     { bg: "from-blue-700 to-blue-600",    border: "border-blue-400",  text: "text-blue-300",  glow: "shadow-blue-500/40" },
  Trailblazer:  { bg: "from-violet-700 to-violet-600",border: "border-violet-400",text: "text-violet-300",glow: "shadow-violet-500/40" },
  Summit:       { bg: "from-amber-600 to-yellow-500", border: "border-amber-400", text: "text-amber-200", glow: "shadow-amber-500/40" },
  "Safarite Pro":{ bg: "from-emerald-700 to-teal-600",border: "border-emerald-400",text:"text-emerald-200",glow:"shadow-emerald-500/40"},
};

export default function LoyaltyHoverCard({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLoyalty = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty/me");
      const data = await res.json();
      if (data.success) {
        setLoyalty(data.loyalty);
        setFetched(true);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
      fetchLoyalty();
    }, 200);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 300);
  };

  const colors = loyalty ? (LEVEL_COLORS[loyalty.level.name] ?? LEVEL_COLORS["Scout"]) : LEVEL_COLORS["Scout"];

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute right-0 top-full mt-3 w-80 rounded-2xl border ${colors.border} bg-gray-900 shadow-2xl ${colors.glow} z-50 overflow-hidden`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header gradient */}
            <div className={`bg-gradient-to-r ${colors.bg} px-4 py-3 flex items-center gap-3`}>
              <span className="text-2xl">{loyalty?.level?.badge ?? "🏕️"}</span>
              <div>
                <p className="text-white font-bold text-sm">
                  {loading ? "Loading..." : (loyalty?.level?.name ?? "Scout")}
                </p>
                <p className="text-white/70 text-xs">
                  {loyalty?.accountType === "vendor" ? "Vendor Level" : "Traveller Level"}
                </p>
              </div>
              {loyalty?.isSuspended && (
                <span className="ml-auto text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full font-medium">
                  Suspended
                </span>
              )}
              {loyalty?.levelFrozen && !loyalty.isSuspended && (
                <span className="ml-auto text-xs bg-orange-500/80 text-white px-2 py-0.5 rounded-full font-medium">
                  Frozen
                </span>
              )}
            </div>

            {loading && (
              <div className="px-4 py-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}

            {!loading && loyalty && (
              <div className="px-4 py-3 space-y-3">
                {/* Score + progress */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-400 text-xs font-medium">Composite Score</span>
                    <span className={`text-sm font-bold ${colors.text}`}>
                      {loyalty.compositeScore.toFixed(1)}
                      {loyalty.nextLevel && (
                        <span className="text-gray-500 font-normal text-xs">
                          {" "}/ {loyalty.nextLevel.minScore}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${loyalty.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                      className={`h-full rounded-full bg-gradient-to-r ${colors.bg}`}
                    />
                  </div>
                  {loyalty.nextLevel ? (
                    <p className="text-gray-500 text-xs mt-1">
                      {loyalty.progress}% to <span className={colors.text}>{loyalty.nextLevel.badge} {loyalty.nextLevel.name}</span>
                    </p>
                  ) : (
                    <p className={`text-xs mt-1 ${colors.text} font-medium`}>Max Level Reached 🎉</p>
                  )}
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile
                    label="Bookings"
                    value={loyalty.metrics.totalBookings}
                    icon="📦"
                  />
                  {loyalty.accountType === "vendor" ? (
                    <MetricTile
                      label="Revenue"
                      value={`₹${((loyalty.metrics.totalRevenue ?? 0) / 1000).toFixed(1)}k`}
                      icon="💰"
                    />
                  ) : (
                    <MetricTile
                      label="Reviews Given"
                      value={loyalty.metrics.ratingsGiven ?? 0}
                      icon="⭐"
                    />
                  )}
                  <MetricTile
                    label="Avg Rating"
                    value={loyalty.metrics.avgRating ? loyalty.metrics.avgRating.toFixed(1) : "N/A"}
                    icon="🌟"
                  />
                  <MetricTile
                    label="Cancellations"
                    value={loyalty.metrics.cancellations}
                    icon="❌"
                    danger={loyalty.metrics.cancellations > 2}
                  />
                </div>

                {/* Discount badge */}
                {loyalty.currentDiscount != null && loyalty.currentDiscount > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-3 py-2">
                    <span className="text-emerald-400 text-base">🎟️</span>
                    <div>
                      <p className="text-emerald-300 text-xs font-semibold">
                        {loyalty.currentDiscount}% Discount Active
                      </p>
                      <p className="text-emerald-600 text-xs">On invoices over ₹4,000</p>
                    </div>
                  </div>
                )}

                {/* Perks */}
                {loyalty.level.perks && loyalty.level.perks.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs font-medium mb-1.5">Current Perks</p>
                    <div className="flex flex-wrap gap-1">
                      {loyalty.level.perks.slice(0, 3).map((perk, i) => (
                        <span
                          key={i}
                          className={`text-xs ${colors.text} bg-white/5 border ${colors.border} border-opacity-30 rounded-lg px-2 py-0.5`}
                        >
                          {perk}
                        </span>
                      ))}
                      {loyalty.level.perks.length > 3 && (
                        <span className="text-xs text-gray-500 px-2 py-0.5">
                          +{loyalty.level.perks.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent penalties */}
                {loyalty.penaltyHistory && loyalty.penaltyHistory.length > 0 && (
                  <div>
                    <p className="text-red-400/80 text-xs font-medium mb-1">Recent Penalties</p>
                    <div className="space-y-1">
                      {loyalty.penaltyHistory.slice(-2).map((p, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-500">
                          <span className="truncate max-w-[180px]">{p.event}</span>
                          <span className="text-red-400 font-medium ml-2">-{p.scoreDeduction}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer link */}
                <div className="border-t border-white/5 pt-2">
                  <a
                    href="/profile"
                    className={`text-xs ${colors.text} hover:underline flex items-center gap-1`}
                  >
                    View full progress in profile →
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: string | number;
  icon: string;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 ${danger ? "bg-red-900/30 border border-red-700/30" : "bg-white/5"}`}>
      <p className="text-gray-500 text-xs">{icon} {label}</p>
      <p className={`text-sm font-bold mt-0.5 ${danger ? "text-red-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
"use client";
// app/components/Pages/admin/LoyaltyTable.tsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface LoyaltyRow {
  _id: string | null;
  userId: {
    _id: string;
    fullName: string;
    email: string;
    accountType: string;
    avatar?: string;
  };
  accountType: "user" | "vendor";
  level: string;
  compositeScore: number;
  metrics: {
    totalBookings: number;
    avgRating: number;
    cancellations: number;
    policyViolations: number;
    totalRevenue?: number;
  };
  isSuspended: boolean;
  levelFrozen: boolean;
  demotionCount: number;
  currentDiscount: number;
  lastCalculated: string | null;
}

interface Summary {
  totalTracked: number;
  suspended: number;
  frozen: number;
  levelDistribution: Record<string, number>;
}

const LEVEL_COLORS: Record<string, string> = {
  Scout: "bg-gray-100 text-gray-700",
  Explorer: "bg-blue-100 text-blue-700",
  Traveller: "bg-violet-100 text-violet-700",
  Adventurer: "bg-amber-100 text-amber-700",
  Safarite: "bg-emerald-100 text-emerald-700",
  Seedling: "bg-gray-100 text-gray-700",
  Beginner: "bg-blue-100 text-blue-700",
  Trailblazer: "bg-violet-100 text-violet-700",
  Summit: "bg-amber-100 text-amber-700",
  "Safarite Pro": "bg-emerald-100 text-emerald-700",
};

const LEVEL_BADGES: Record<string, string> = {
  Scout: "🏕️", Explorer: "🧭", Traveller: "✈️", Adventurer: "🏔️", Safarite: "🌟",
  Seedling: "🌱", Beginner: "🌿", Trailblazer: "🔥", Summit: "⛰️", "Safarite Pro": "👑",
};

export default function LoyaltyTable() {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "user" | "vendor">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?type=${filter}` : "";
      const res = await fetch(`/api/admin/loyalty${params}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        setSummary(data.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleAction = async (
    userId: string,
    action: "suspend" | "unsuspend" | "freeze" | "unfreeze",
    note?: string
  ) => {
    setActionLoading(userId + action);
    try {
      await fetch("/api/admin/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, action, note }),
      });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">🏆 Loyalty Leaderboard</h2>
        <div className="flex gap-2">
          {(["all", "user", "vendor"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <SummaryPill label="Tracked" value={summary.totalTracked} color="bg-indigo-50 text-indigo-700" />
          <SummaryPill label="Suspended" value={summary.suspended} color="bg-red-50 text-red-700" />
          <SummaryPill label="Frozen" value={summary.frozen} color="bg-orange-50 text-orange-700" />
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">
            <p className="font-semibold mb-1">Level Distribution</p>
            {Object.entries(summary.levelDistribution).map(([level, count]) => (
              <div key={level} className="flex justify-between">
                <span>{LEVEL_BADGES[level]} {level}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Level</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Score</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Bookings</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Rating</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Cancels</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Violations</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400">
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-400">No loyalty data yet</td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const uid = row.userId?._id?.toString();
                return (
                  <motion.tr
                    key={uid ?? i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {row.userId?.fullName?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[120px]">
                            {row.userId?.fullName ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[120px]">
                            {row.userId?.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.accountType === "vendor"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-sky-100 text-sky-700"
                      }`}>
                        {row.accountType}
                      </span>
                    </td>

                    {/* Level */}
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${LEVEL_COLORS[row.level] ?? "bg-gray-100 text-gray-700"}`}>
                        {LEVEL_BADGES[row.level]} {row.level}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 text-right font-bold text-gray-800">
                      {row.compositeScore.toFixed(1)}
                    </td>

                    {/* Bookings */}
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.metrics.totalBookings}
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3 text-right text-gray-600">
                      {row.metrics.avgRating ? row.metrics.avgRating.toFixed(1) : "—"}
                    </td>

                    {/* Cancellations */}
                    <td className={`px-4 py-3 text-right font-medium ${row.metrics.cancellations > 2 ? "text-red-500" : "text-gray-600"}`}>
                      {row.metrics.cancellations}
                    </td>

                    {/* Violations */}
                    <td className={`px-4 py-3 text-right font-medium ${row.metrics.policyViolations > 0 ? "text-orange-500" : "text-gray-600"}`}>
                      {row.metrics.policyViolations}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {row.isSuspended ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Suspended</span>
                      ) : row.levelFrozen ? (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Frozen</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        {row.isSuspended ? (
                          <ActionBtn
                            label="Unsuspend"
                            color="green"
                            loading={actionLoading === uid + "unsuspend"}
                            onClick={() => uid && handleAction(uid, "unsuspend")}
                          />
                        ) : (
                          <ActionBtn
                            label="Suspend"
                            color="red"
                            loading={actionLoading === uid + "suspend"}
                            onClick={() => uid && handleAction(uid, "suspend", "Admin action")}
                          />
                        )}
                        {row.levelFrozen ? (
                          <ActionBtn
                            label="Unfreeze"
                            color="blue"
                            loading={actionLoading === uid + "unfreeze"}
                            onClick={() => uid && handleAction(uid, "unfreeze")}
                          />
                        ) : (
                          <ActionBtn
                            label="Freeze"
                            color="orange"
                            loading={actionLoading === uid + "freeze"}
                            onClick={() => uid && handleAction(uid, "freeze", "Admin action")}
                          />
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
  loading,
}: {
  label: string;
  color: "red" | "green" | "orange" | "blue";
  onClick: () => void;
  loading: boolean;
}) {
  const colorMap = {
    red: "bg-red-100 text-red-700 hover:bg-red-200",
    green: "bg-green-100 text-green-700 hover:bg-green-200",
    orange: "bg-orange-100 text-orange-700 hover:bg-orange-200",
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${colorMap[color]} disabled:opacity-50`}
    >
      {loading ? "..." : label}
    </button>
  );
}
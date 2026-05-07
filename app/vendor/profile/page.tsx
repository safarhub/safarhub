"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Pages/vendor/Sidebar";

type AdditionalDetails = {
  dateOfBirth?: string;
  gender?: string;
  about?: string;
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }>;
};

type VendorUser = {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  contactNumber?: string;
  accountType: "vendor";
  additionalDetails?: AdditionalDetails;
  vendorServices?: string[];
  isVendorApproved?: boolean;
};

type LevelData = {
  name: string;
  minScore: number;
  discount?: number;
  perks: string[];
  color: string;
  badge: string;
};

type LoyaltyData = {
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
    totalRevenue?: number;
    noShows?: number;
  };
  currentDiscount?: number;
  isSuspended: boolean;
  levelFrozen: boolean;
};

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

export default function VendorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<VendorUser | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Get navigation function from global context
  const navigate = typeof window !== 'undefined' ? (window as any).__VENDOR_NAVIGATE__?.navigate : null;

  // Verify vendor session and hydrate profile
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (res.status !== 200) {
          router.replace("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const verifiedUser = data?.user;
        if (!res.ok || !verifiedUser) {
          router.replace("/login");
          return;
        }
        if (verifiedUser.accountType !== "vendor") {
          router.replace("/login");
          return;
        }

        let base: VendorUser = verifiedUser;

        // Merge vendor services/approval from admin vendor endpoint (if available)
        const vendorId = base._id || base.id;
        if (vendorId) {
          try {
            const vRes = await fetch(`/api/admin/vendors?id=${vendorId}`);
            const vData = await vRes.json();
            if (vData?.success && vData?.vendor) {
              base = {
                ...base,
                vendorServices: vData.vendor.vendorServices || base.vendorServices,
                isVendorApproved:
                  typeof vData.vendor.isVendorApproved === "boolean"
                    ? vData.vendor.isVendorApproved
                    : base.isVendorApproved,
              };
            }
          } catch {
            // ignore vendor fetch errors, still show basic profile
          }
        }

        setUser(base);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  useEffect(() => {
    const loadLoyalty = async () => {
      try {
        const res = await fetch("/api/loyalty/me", { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.loyalty?.accountType === "vendor") {
          setLoyalty(data.loyalty);
        }
      } catch {
        // Keep page usable even if loyalty endpoint fails.
      } finally {
        setLoyaltyLoading(false);
      }
    };

    loadLoyalty();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );

  if (!user) return null;

  const addr = user.additionalDetails?.addresses?.[0];
  const locationParts = [
    addr?.street,
    addr?.city,
    addr?.state,
    addr?.country,
    addr?.postalCode,
  ].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : "N/A";

  const dob =
    user.additionalDetails?.dateOfBirth
      ? new Date(user.additionalDetails.dateOfBirth).toLocaleDateString()
      : "N/A";

  const gender = user.additionalDetails?.gender || "N/A";
  const bio = user.additionalDetails?.about || "N/A";

  const services = (user.vendorServices || []).map((s) =>
    s === "vehicle" ? "Vehicle Rental" : s.charAt(0).toUpperCase() + s.slice(1)
  );

  const levelName = loyalty?.level?.name ?? "Seedling";
  const badgeClass = LEVEL_BADGE_COLORS[levelName] ?? LEVEL_BADGE_COLORS.Seedling;
  const barClass = PROGRESS_BAR_COLORS[levelName] ?? PROGRESS_BAR_COLORS.Seedling;

  return (
        <div className="flex h-screen bg-gray-50 relative ">
             {/* Desktop sidebar */}
                {/* <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen pt-15 overflow-y-auto overflow-x-hidden">
               <Sidebar />
             </div> */}
      <div className="flex-1 lg:pt-0 overflow-y-auto min-h-screen">
        {/* Mobile Menu Button */}
        <div className="lg:hidden sticky top-0 z-40 bg-sky-50 px-4 pt-4 pb-2">
          {/* <button
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow border text-gray-800"
          >
            ☰ <span className="text-sm font-medium">Menu</span>
          </button> */}
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-24 pb-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Vendor Profile</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate ? navigate("/vendor/profile/edit") : router.push("/vendor/profile/edit")}
              className="bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-all duration-200"
            >
              Edit Profile
            </button>
            <button
              onClick={() => navigate ? navigate("/vendor") : router.push("/vendor")}
              className="bg-linear-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-all duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                <span className="font-semibold text-gray-800">Name:</span> {user.fullName}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Phone:</span>{" "}
                {user.contactNumber || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Approval:</span>{" "}
                {user.isVendorApproved ? (
                  <span className="text-green-600 font-semibold">Approved</span>
                ) : (
                  <span className="text-orange-600 font-semibold">Pending</span>
                )}
              </p>
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Additional Details</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                <span className="font-semibold text-gray-800">Location:</span> {location}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Date of Birth:</span> {dob}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Gender:</span> {gender}
              </p>
              <div>
                <span className="font-semibold text-gray-800">Bio:</span>
                <p className="mt-1 text-gray-700">{bio}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Services Provided</h2>
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {services.map((svc, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium"
                >
                  {svc}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No services selected yet.</p>
          )}
        </div>

        {/* Loyalty */}
        <div className="bg-white shadow-xl rounded-3xl p-6 md:p-8 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">🏆 Vendor Loyalty Progress</h2>
            {loyalty && (
              <span className={`text-xs font-semibold border px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                {loyalty.level.badge} {loyalty.level.name}
              </span>
            )}
          </div>

          {loyaltyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
            </div>
          ) : loyalty ? (
            <div className="space-y-6">
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
                    {loyalty.nextLevel ? (
                      <span className="text-sm text-gray-400">
                        Next: {loyalty.nextLevel.badge} {loyalty.nextLevel.name} ({loyalty.nextLevel.minScore} pts)
                      </span>
                    ) : (
                      <span className="text-sm text-emerald-700 font-medium">Max Level Reached</span>
                    )}
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${barClass}`}
                      style={{ width: `${loyalty.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{loyalty.progress}% to next level</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Score Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ScoreCard
                    icon="📦"
                    label="Total Bookings"
                    value={loyalty.metrics.totalBookings}
                    sub={`+${(loyalty.metrics.totalBookings * 5).toFixed(1)} pts`}
                    positive
                  />
                  <ScoreCard
                    icon="💰"
                    label="Total Revenue"
                    value={`₹${((loyalty.metrics.totalRevenue ?? 0) / 1000).toFixed(1)}k`}
                    sub={`+${((loyalty.metrics.totalRevenue ?? 0) / 1000).toFixed(1)} pts`}
                    positive
                  />
                  <ScoreCard
                    icon="🌟"
                    label="Avg Rating"
                    value={loyalty.metrics.avgRating ? loyalty.metrics.avgRating.toFixed(1) : "N/A"}
                    sub={`+${(loyalty.metrics.avgRating * 10).toFixed(1)} pts`}
                    positive
                  />
                  <ScoreCard
                    icon="❌"
                    label="Cancellations"
                    value={loyalty.metrics.cancellations}
                    sub="0.0 pts (deductions paused)"
                    positive={false}
                  />
                  <ScoreCard
                    icon="⚠️"
                    label="Policy Violations"
                    value={loyalty.metrics.policyViolations}
                    sub="0.0 pts (deductions paused)"
                    positive={false}
                  />
                  <ScoreCard
                    icon="🚫"
                    label="No-Shows"
                    value={loyalty.metrics.noShows ?? 0}
                    sub="0.0 pts (deductions paused)"
                    positive={false}
                  />
                </div>
              </div>

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

              {(loyalty.isSuspended || loyalty.levelFrozen) && (
                <div className="flex flex-wrap gap-2">
                  {loyalty.isSuspended && (
                    <span className="text-xs font-semibold bg-red-100 text-red-700 border border-red-300 px-2.5 py-0.5 rounded-full">
                      🚫 Suspended
                    </span>
                  )}
                  {loyalty.levelFrozen && (
                    <span className="text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300 px-2.5 py-0.5 rounded-full">
                      🔒 Level Frozen
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">🏕️</p>
              <p>Loyalty data is not available yet. Complete bookings to start earning points.</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {/* {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-90 bg-black/40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-100 lg:hidden overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-800">Menu</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="px-3 py-1.5 rounded-md border text-gray-700"
              >
                Close
              </button>
            </div>
            <Sidebar />
          </div>
        </>
      )} */}
    </div>
  );
}

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



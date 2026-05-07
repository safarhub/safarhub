"use client";
// app/profile/coupons/page.tsx

import { useEffect, useState } from "react";
import { FaTicketAlt, FaCopy, FaCheckCircle, FaLock, FaHourglass } from "react-icons/fa";
import { toast } from "react-hot-toast";

interface Coupon {
  _id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountAmount: number;
  minPurchase: number;
  maxDiscount?: number;
  expiryDate: string;
  isUsed: boolean;
  usedAt?: string;
  assignedAt?: string;
  isActive: boolean;
}

function CouponCard({ coupon }: { coupon: Coupon }) {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(coupon.expiryDate) < new Date();
  const isUnavailable = coupon.isUsed || isExpired || !coupon.isActive;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast.success("Coupon code copied!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const discountLabel =
    coupon.discountType === "percentage"
      ? `${coupon.discountAmount}% OFF`
      : `₹${coupon.discountAmount} OFF`;

  const statusBadge = () => {
    if (coupon.isUsed)
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full">
          <FaCheckCircle size={9} /> Used
        </span>
      );
    if (isExpired)
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-100 text-red-500 border border-red-200 px-2.5 py-1 rounded-full">
          <FaHourglass size={9} /> Expired
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
        <FaCheckCircle size={9} /> Active
      </span>
    );
  };

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all ${
        isUnavailable
          ? "bg-gray-50 border-gray-200 opacity-70"
          : "bg-white border-green-100 shadow-md shadow-green-50 hover:shadow-lg hover:shadow-green-100"
      }`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${
          isUnavailable ? "bg-gray-300" : "bg-gradient-to-b from-green-400 to-emerald-600"
        }`}
      />

      <div className="pl-5 pr-5 py-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isUnavailable ? "bg-gray-100" : "bg-green-50"
              }`}
            >
              <FaTicketAlt
                size={16}
                className={isUnavailable ? "text-gray-400" : "text-green-600"}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Exclusive Coupon
              </p>
              <div className="flex items-center gap-1.5">
                <FaLock size={9} className="text-amber-500" />
                <span className="text-[11px] text-amber-600 font-semibold">
                  Assigned to you only
                </span>
              </div>
            </div>
          </div>
          {statusBadge()}
        </div>

        {/* Code + copy */}
        <div
          className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-4 ${
            isUnavailable ? "bg-gray-100" : "bg-green-50 border border-green-100"
          }`}
        >
          <span
            className={`font-mono font-black text-xl tracking-widest ${
              isUnavailable ? "text-gray-400 line-through" : "text-green-700"
            }`}
          >
            {coupon.code}
          </span>
          {!isUnavailable && (
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-green-200 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600"
              }`}
            >
              {copied ? (
                <>
                  <FaCheckCircle size={11} /> Copied!
                </>
              ) : (
                <>
                  <FaCopy size={11} /> Copy
                </>
              )}
            </button>
          )}
        </div>

        {/* Discount info */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div
            className={`text-2xl font-black ${
              isUnavailable ? "text-gray-400" : "text-gray-900"
            }`}
          >
            {discountLabel}
          </div>
          {coupon.minPurchase > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              Min ₹{coupon.minPurchase}
            </span>
          )}
          {coupon.maxDiscount && coupon.discountType === "percentage" && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              Max ₹{coupon.maxDiscount}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3">
          <span>
            Valid until{" "}
            <span className={`font-semibold ${isExpired ? "text-red-500" : "text-gray-600"}`}>
              {new Date(coupon.expiryDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </span>
          </span>
          {coupon.isUsed && coupon.usedAt ? (
            <span className="text-gray-400">
              Used on {new Date(coupon.usedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </span>
          ) : (
            <span className="text-green-600 font-semibold">One-time use</span>
          )}
        </div>

        {/* How to use */}
        {!isUnavailable && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">💡</span>
            <span>
              Apply code <strong>{coupon.code}</strong> at checkout to get your discount.
              This code works only on your account.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await fetch("/api/profile/coupons", { credentials: "include" });
        const data = await res.json();
        if (data.success) setCoupons(data.coupons ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, []);

  const active = coupons.filter(
    (c) => !c.isUsed && new Date(c.expiryDate) >= new Date()
  );
  const inactive = coupons.filter(
    (c) => c.isUsed || new Date(c.expiryDate) < new Date()
  );

  return (
    <div className="flex flex-col gap-6 pt-15">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">My Coupons</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Exclusive discount coupons assigned to your account
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-green-500 rounded-full animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <FaTicketAlt size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No coupons yet</h2>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            When SafarHub assigns you an exclusive coupon, it will appear here. Keep
            booking to earn special discounts!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active coupons */}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Active ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map((c) => (
                  <CouponCard key={c._id} coupon={c} />
                ))}
              </div>
            </div>
          )}

          {/* Used / expired */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                Used / Expired ({inactive.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inactive.map((c) => (
                  <CouponCard key={c._id} coupon={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
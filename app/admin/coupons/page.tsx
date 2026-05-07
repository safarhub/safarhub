"use client";
// app/admin/coupons/page.tsx  ← REPLACE existing file

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FaPlus, FaTrash, FaTicketAlt, FaToggleOn, FaToggleOff,
  FaUserTag, FaTimes, FaCheckCircle, FaEnvelope, FaLock, FaChevronDown,
} from "react-icons/fa";
import { toast } from "react-hot-toast";

interface Coupon {
  _id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountAmount: number;
  minPurchase: number;
  maxDiscount?: number;
  expiryDate: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  isPersonalized: boolean;
  assignedToEmail?: string;
  assignedToName?: string;
  isUsed: boolean;
  createdAt: string;
}

function TopAssignModal({ coupons, onClose, onSuccess }: {
  coupons: Coupon[]; onClose: () => void; onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);
  const eligible = coupons.filter((c) => c.isActive && !c.isPersonalized && new Date(c.expiryDate) >= new Date());
  const selected = eligible.find((c) => c._id === selectedId);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter a valid email"); return; }
    if (!selectedId) { toast.error("Select a coupon"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons/assign", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), couponId: selectedId, adminNote: adminNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Failed");
      if (data.warning) toast.error(data.warning, { duration: 6000 });
      else toast.success(`Coupon assigned & email sent to ${email}`);
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err?.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><FaUserTag className="text-white" size={16} /></div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Assign Coupon to User</h2>
              <p className="text-green-100 text-xs">One-time use · Branded email sent instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"><FaTimes size={13} /></button>
        </div>
        <form onSubmit={handleAssign} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Coupon <span className="text-red-500">*</span></label>
            {eligible.length === 0 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">No eligible active coupons. Create one using "+ Add Coupon" first.</div>
            ) : (
              <>
                <div className="relative">
                  <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white transition">
                    <option value="">— Choose a coupon —</option>
                    {eligible.map((c) => (
                      <option key={c._id} value={c._id}>{c.code} · {c.discountAmount}{c.discountType === "percentage" ? "% OFF" : " ₹ OFF"}{c.minPurchase > 0 ? ` · Min ₹${c.minPurchase}` : ""}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400"><FaChevronDown size={11} /></span>
                </div>
                {selected && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl bg-green-50 border border-green-100 px-3 py-2.5">
                    <span className="font-mono font-bold text-green-700 text-sm">{selected.code}</span>
                    <span className="text-xs text-gray-500">{selected.discountAmount}{selected.discountType === "percentage" ? "% OFF" : " ₹ OFF"}</span>
                    <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">1× USE</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">User Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400"><FaEnvelope size={13} /></span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition" />
            </div>
            <p className="mt-1 text-xs text-gray-400 flex items-center gap-1"><FaLock size={10} /> Locked to this email — only they can use it</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Personal Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="e.g. Thank you for being a loyal customer!"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 transition" />
            <p className="mt-1 text-xs text-gray-400">Shown inside the email the user receives</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
            <p className="font-semibold flex items-center gap-1.5 mb-1"><FaCheckCircle size={11} /> What happens</p>
            <ul className="space-y-0.5 pl-4 list-disc text-blue-600">
              <li>Coupon locked to this email only</li>
              <li>User gets a branded email with their code</li>
              <li>One-time use · expires on set date</li>
            </ul>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading || eligible.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</> : <><FaEnvelope size={13} /> Assign &amp; Send Email</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RowAssignModal({ coupon, onClose, onSuccess }: { coupon: Coupon; onClose: () => void; onSuccess: () => void; }) {
  const [email, setEmail] = useState(coupon.assignedToEmail ?? "");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons/assign", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), couponId: coupon._id, adminNote: adminNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Failed");
      if (data.warning) toast.error(data.warning, { duration: 6000 });
      else toast.success(`Coupon assigned & email sent to ${email}`);
      onSuccess(); onClose();
    } catch (err: any) { toast.error(err?.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-600 to-emerald-600">
          <div><h2 className="text-white font-bold text-sm">Assign {coupon.code}</h2><p className="text-green-100 text-xs">One-time use · Email sent to user</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"><FaTimes size={12} /></button>
        </div>
        <form onSubmit={handleAssign} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">User Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400"><FaEnvelope size={12} /></span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition" />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 flex items-center gap-1"><FaLock size={9} /> Locked to this email only</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Note (optional)</label>
            <textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Personal message for the email…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 transition" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FaEnvelope size={12} /> Send</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCouponsPage() {
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTopAssign, setShowTopAssign] = useState(false);
  const [rowAssignTarget, setRowAssignTarget] = useState<Coupon | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "general" | "assigned">("all");

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/coupons", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Failed to fetch coupons");
      setCoupons(data.coupons || []);
    } catch (err: any) { setError(err?.message || "Unable to fetch coupons"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Failed");
      toast.success("Coupon deleted"); loadCoupons();
    } catch (err: any) { toast.error(err?.message || "Failed to delete"); }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }), credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Failed");
      toast.success("Status updated"); loadCoupons();
    } catch (err: any) { toast.error(err?.message || "Failed"); }
  };

  const filtered = coupons.filter((c) => {
    if (activeTab === "general") return !c.isPersonalized;
    if (activeTab === "assigned") return c.isPersonalized;
    return true;
  });

  return (
    <>
      {showTopAssign && <TopAssignModal coupons={coupons} onClose={() => setShowTopAssign(false)} onSuccess={loadCoupons} />}
      {rowAssignTarget && <RowAssignModal coupon={rowAssignTarget} onClose={() => setRowAssignTarget(null)} onSuccess={loadCoupons} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupons Management</h1>
            <p className="text-sm text-gray-500">Manage and create discount coupons for users.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTopAssign(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-green-600 bg-white px-5 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition shadow-sm">
              <FaUserTag size={13} /> Assign to User
            </button>
            <Link href="/admin/add-coupons"
              className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition shadow-lg shadow-green-100">
              <FaPlus /> Add Coupon
            </Link>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !error && coupons.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "all", label: "All", count: coupons.length },
              { key: "general", label: "General", count: coupons.filter((c) => !c.isPersonalized).length },
              { key: "assigned", label: "Assigned to User", count: coupons.filter((c) => c.isPersonalized).length },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition ${activeTab === tab.key ? "bg-green-600 text-white shadow" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {tab.label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex justify-center py-20"><div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" /></div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-6 text-red-700 border border-red-100">{error}</div>
          ) : coupons.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-100">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 text-gray-400"><FaTicketAlt size={32} /></div>
              <h3 className="text-lg font-bold text-gray-900">No coupons found</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">Create your first coupon to start offering discounts to your customers.</p>
              <Link href="/admin/add-coupons" className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition shadow-lg shadow-green-100">
                <FaPlus /> Create First Coupon
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Coupon Code</th>
                      <th className="px-6 py-4">Discount</th>
                      <th className="px-6 py-4">Usage</th>
                      <th className="px-6 py-4">Assigned To</th>
                      <th className="px-6 py-4">Expiry</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">No coupons in this category.</td></tr>
                    ) : filtered.map((coupon) => (
                      <tr key={coupon._id} className={`hover:bg-gray-50/50 transition-colors ${coupon.isPersonalized ? "bg-amber-50/30" : ""}`}>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-lg bg-green-50 px-3 py-1.5 font-mono text-base font-bold text-green-700 border border-green-100">{coupon.code}</span>
                            {coupon.isPersonalized && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"><FaLock size={8} /> PERSONAL</span>}
                            {coupon.isPersonalized && coupon.isUsed && <span className="inline-flex text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">USED</span>}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-gray-900">{coupon.discountAmount}{coupon.discountType === "percentage" ? "% OFF" : " ₹ OFF"}</div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Min: ₹{coupon.minPurchase}</div>
                        </td>
                        <td className="px-6 py-5">
                          {coupon.isPersonalized ? (
                            <span className={`text-xs font-semibold ${coupon.isUsed ? "text-gray-400" : "text-amber-600"}`}>{coupon.isUsed ? "✓ Used" : "Unused"}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 max-w-[60px] rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${coupon.usageLimit ? (coupon.usageCount / coupon.usageLimit) * 100 : 0}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-600">{coupon.usageCount} / {coupon.usageLimit || "∞"}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {coupon.isPersonalized && coupon.assignedToEmail ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-800 truncate max-w-[140px]">{coupon.assignedToName || coupon.assignedToEmail}</p>
                              <p className="text-[11px] text-gray-400 truncate max-w-[140px]">{coupon.assignedToEmail}</p>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-xs font-medium ${new Date(coupon.expiryDate) < new Date() ? "text-red-500" : "text-gray-600"}`}>
                            {new Date(coupon.expiryDate).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <button onClick={() => toggleStatus(coupon._id, coupon.isActive)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${coupon.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}>
                            {coupon.isActive ? <FaToggleOn size={14} /> : <FaToggleOff size={14} />}
                            {coupon.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            {!coupon.isPersonalized && coupon.isActive && new Date(coupon.expiryDate) >= new Date() && (
                              <button onClick={() => setRowAssignTarget(coupon)} title="Assign to user"
                                className="inline-flex h-9 items-center gap-1.5 px-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-all shadow-sm text-xs font-semibold border border-amber-200 hover:border-amber-600">
                                <FaUserTag size={12} /> Assign
                              </button>
                            )}
                            {coupon.isPersonalized && !coupon.isUsed && coupon.isActive && (
                              <button onClick={() => setRowAssignTarget(coupon)} title="Re-assign"
                                className="inline-flex h-9 items-center gap-1.5 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm text-xs font-semibold border border-blue-200 hover:border-blue-600">
                                <FaUserTag size={12} /> Re-assign
                              </button>
                            )}
                            <button onClick={() => handleDelete(coupon._id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Delete">
                              <FaTrash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
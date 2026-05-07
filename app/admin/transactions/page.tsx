"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaCheckCircle, FaClock, FaTimesCircle, FaSpinner } from "react-icons/fa";

type VendorSalesRow = {
  orderId?: string;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorEmail?: string | null;
  vendorPhone?: string | null;
  quantity?: number;
  soldAmount?: number;
  vendorPayableAmount?: number;
  commissionMadeAmount?: number;
  platformCommissionAmount?: number;
  status?: string;
  orderCreatedAt?: string | null;
  source?: string;
  serviceType?: string;
};

type VendorSalesSummary = {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string | null;
  vendorPhone?: string | null;
  orderCount: number;
  deliveredOrderCount: number;
  cancelledOrderCount: number;
  itemCount: number;
  cancelledItemCount: number;
  grossSales: number;
  commissionMade: number;
  netPayable: number;
  cancelledAmount: number;
  lastSaleAt?: string | null;
};

type VendorSalesTotals = {
  vendorCount: number;
  orderCount: number;
  grossSales: number;
  commissionMade: number;
  requirementCommissionMade: number;
  netPayable: number;
  cancelledAmount: number;
};

type VendorOption = {
  _id: string;
  fullName?: string;
  email?: string;
};

type TransactionVendor = {
  _id: string;
  fullName?: string;
  email?: string;
};

type AdminTransaction = {
  _id: string;
  status: string;
  vendorId?: string | TransactionVendor | null;
  message: string;
  amount?: number;
  createdAt: string;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [activeTab, setActiveTab] = useState<"create" | "manage" | "sales">("create");
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [vendorSales, setVendorSales] = useState<VendorSalesSummary[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [hasLoadedSales, setHasLoadedSales] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesTotals, setSalesTotals] = useState<VendorSalesTotals>({
    vendorCount: 0,
    orderCount: 0,
    grossSales: 0,
    commissionMade: 0,
    requirementCommissionMade: 0,
    netPayable: 0,
    cancelledAmount: 0,
  });

  const [formData, setFormData] = useState({
    vendorId: "",
    message: "",
    amount: "",
    currency: "INR",
    scheduledDate: "",
    notes: "",
  });

  const loadVendors = useCallback(async () => {
    try {
      setLoadingVendors(true);
      const res = await fetch("/api/admin/vendors", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Failed to load vendors", err);
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const res = await fetch("/api/admin/transactions", { credentials: "include" });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Failed to load transactions: ${res.status} ${res.statusText}`, text.slice(0, 100));
        return;
      }

      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  const loadSalesBreakdown = useCallback(async () => {
    try {
      setLoadingSales(true);
      setSalesError("");

      const res = await fetch("/api/admin/vendor-sales-breakdown", { credentials: "include" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load vendor sales breakdown");
      }

      const rows: VendorSalesRow[] = data.data || [];
      const summaryMap = new Map<string, VendorSalesSummary>();
      const saleOrderSets = new Map<string, Set<string>>();
      const deliveredOrderSets = new Map<string, Set<string>>();
      const cancelledOrderSets = new Map<string, Set<string>>();
      const totalSaleOrders = new Set<string>();

      let totalGrossSales = 0;
      let totalCommissionMade = 0;
      let totalRequirementCommissionMade = 0;
      let totalNetPayable = 0;
      let totalCancelledAmount = 0;

      rows.forEach((row) => {
        const vendorId = row.vendorId || "unknown_vendor";
        const vendorName = row.vendorName || "Unknown vendor";

        if (!summaryMap.has(vendorId)) {
          summaryMap.set(vendorId, {
            vendorId,
            vendorName,
            vendorEmail: row.vendorEmail || null,
            vendorPhone: row.vendorPhone || null,
            orderCount: 0,
            deliveredOrderCount: 0,
            cancelledOrderCount: 0,
            itemCount: 0,
            cancelledItemCount: 0,
            grossSales: 0,
            commissionMade: 0,
            netPayable: 0,
            cancelledAmount: 0,
            lastSaleAt: row.orderCreatedAt || null,
          });
          saleOrderSets.set(vendorId, new Set<string>());
          deliveredOrderSets.set(vendorId, new Set<string>());
          cancelledOrderSets.set(vendorId, new Set<string>());
        }

        const summary = summaryMap.get(vendorId)!;
        if (!summary.vendorEmail && row.vendorEmail) summary.vendorEmail = row.vendorEmail;
        if (!summary.vendorPhone && row.vendorPhone) summary.vendorPhone = row.vendorPhone;

        const soldAmount = Number(row.soldAmount || 0);
        const netPayable = Number(row.vendorPayableAmount ?? soldAmount);
        const commissionMade = Number(
          row.commissionMadeAmount ?? row.platformCommissionAmount ?? Math.max(soldAmount - netPayable, 0)
        );
        const quantity = Math.max(Number(row.quantity || 0), 1);
        const status = String(row.status || "").toLowerCase();
        const orderId = row.orderId || "";

        const rowTime = row.orderCreatedAt ? new Date(row.orderCreatedAt).getTime() : 0;
        const summaryTime = summary.lastSaleAt ? new Date(summary.lastSaleAt).getTime() : 0;
        if (rowTime && rowTime > summaryTime) {
          summary.lastSaleAt = row.orderCreatedAt;
        }

        if (status === "cancelled") {
          summary.cancelledAmount += soldAmount;
          summary.cancelledItemCount += quantity;
          totalCancelledAmount += soldAmount;
          if (orderId) cancelledOrderSets.get(vendorId)?.add(orderId);
          return;
        }

        summary.grossSales += soldAmount;
  summary.commissionMade += commissionMade;
        summary.netPayable += netPayable;
        summary.itemCount += quantity;

        totalGrossSales += soldAmount;
  totalCommissionMade += commissionMade;
        if (String(row.source || "").toLowerCase() === "requirement") {
          totalRequirementCommissionMade += commissionMade;
        }
        totalNetPayable += netPayable;

        if (orderId) {
          saleOrderSets.get(vendorId)?.add(orderId);
          totalSaleOrders.add(orderId);
          if (status === "delivered") {
            deliveredOrderSets.get(vendorId)?.add(orderId);
          }
        }
      });

      const summaries = Array.from(summaryMap.values())
        .map((summary) => {
          const vendorSaleOrders = saleOrderSets.get(summary.vendorId)?.size || 0;
          const vendorDeliveredOrders = deliveredOrderSets.get(summary.vendorId)?.size || 0;
          const vendorCancelledOrders = cancelledOrderSets.get(summary.vendorId)?.size || 0;
          return {
            ...summary,
            orderCount: vendorSaleOrders,
            deliveredOrderCount: vendorDeliveredOrders,
            cancelledOrderCount: vendorCancelledOrders,
          };
        })
        .sort((a, b) => b.netPayable - a.netPayable);

      setVendorSales(summaries);
      setSalesTotals({
        vendorCount: summaries.length,
        orderCount: totalSaleOrders.size,
        grossSales: totalGrossSales,
        commissionMade: totalCommissionMade,
        requirementCommissionMade: totalRequirementCommissionMade,
        netPayable: totalNetPayable,
        cancelledAmount: totalCancelledAmount,
      });
      setHasLoadedSales(true);
    } catch (err: unknown) {
      console.error("Failed to load vendor sales", err);
      const message = err instanceof Error ? err.message : "Failed to load vendor sales breakdown.";
      setSalesError(message);
      setHasLoadedSales(true);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (res.status !== 200) return router.replace("/login");
        const data = await res.json().catch(() => null);
        const verifiedUser = data?.user;
        if (!res.ok || !verifiedUser) return router.replace("/login");
        if (verifiedUser.accountType !== "admin") return router.replace("/login");
        setAuthorized(true);
        loadVendors();
        loadTransactions();
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [router, loadVendors, loadTransactions]);

  useEffect(() => {
    if (authorized && activeTab === "sales" && !loadingSales && !hasLoadedSales) {
      loadSalesBreakdown();
    }
  }, [authorized, activeTab, loadingSales, hasLoadedSales, loadSalesBreakdown]);

  const handleStatusChange = async (transactionId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update status");
      }

      await loadTransactions();
      alert("Status updated successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      alert(message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <FaCheckCircle className="text-green-500" size={16} />;
      case "processing":
        return <FaSpinner className="text-blue-500 animate-spin" size={16} />;
      case "cancelled":
        return <FaTimesCircle className="text-red-500" size={16} />;
      default:
        return <FaClock className="text-yellow-500" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendorId || !formData.message || !formData.scheduledDate) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendorId: formData.vendorId,
          message: formData.message,
          amount: formData.amount ? parseFloat(formData.amount) : undefined,
          currency: formData.currency,
          scheduledDate: new Date(formData.scheduledDate).toISOString(),
          notes: formData.notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create transaction");
      }

      setFormData({
        vendorId: "",
        message: "",
        amount: "",
        currency: "INR",
        scheduledDate: "",
        notes: "",
      });

      await loadTransactions();
      setActiveTab("manage");
      alert("Transaction created successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create transaction";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );
  if (!authorized) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
      </div>

      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === "create"
            ? "border-green-600 text-green-600"
            : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
        >
          Create Transaction
        </button>
        <button
          onClick={() => {
            setActiveTab("manage");
            loadTransactions();
          }}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === "manage"
            ? "border-green-600 text-green-600"
            : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
        >
          Manage Transactions
        </button>
        <button
          onClick={() => {
            setActiveTab("sales");
            loadSalesBreakdown();
          }}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === "sales"
            ? "border-green-600 text-green-600"
            : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
        >
          Vendor Sales Breakdown
        </button>
      </div>

      {activeTab === "create" ? (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="vendorId" className="block text-sm font-bold text-gray-700 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                {loadingVendors ? (
                  <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                ) : (
                  <select
                    id="vendorId"
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                  >
                    <option value="">Select a vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor._id} value={vendor._id}>
                        {vendor.fullName} ({vendor.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                  placeholder="Enter transaction message..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="amount" className="block text-sm font-bold text-gray-700 mb-2">
                    Amount (Optional)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="currency" className="block text-sm font-bold text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="scheduledDate" className="block text-sm font-bold text-gray-700 mb-2">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-bold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-gray-50/50"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Submit Transaction"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : activeTab === "manage" ? (
        <div className="w-full">
          {loadingTransactions ? (
            <div className="flex justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-500 font-medium">No transactions found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Vendor</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Message</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((txn) => (
                      <tr key={txn._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(txn.status)}
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                                txn.status
                              )}`}
                            >
                              {txn.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">
                            {txn.vendorId && typeof txn.vendorId === "object"
                              ? txn.vendorId.fullName || txn.vendorId.email
                              : "Unknown"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate" title={txn.message}>
                            {txn.message}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-black text-gray-900">
                            {txn.amount
                              ? `₹${txn.amount.toLocaleString()}`
                              : "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500 font-medium">{formatDate(txn.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <select
                            value={txn.status}
                            onChange={(e) => handleStatusChange(txn._id, e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none transition-all bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Vendors</p>
              <p className="mt-2 text-2xl font-black text-gray-900">{salesTotals.vendorCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Orders Counted</p>
              <p className="mt-2 text-2xl font-black text-gray-900">{salesTotals.orderCount}</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Gross Sales</p>
              <p className="mt-2 text-xl font-black text-gray-900">{currencyFormatter.format(salesTotals.grossSales)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Commission Made</p>
              <p className="mt-2 text-xl font-black text-amber-700">{currencyFormatter.format(salesTotals.commissionMade)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Requirement Platform Fee</p>
              <p className="mt-2 text-xl font-black text-sky-700">{currencyFormatter.format(salesTotals.requirementCommissionMade)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Net Payable</p>
              <p className="mt-2 text-xl font-black text-green-700">{currencyFormatter.format(salesTotals.netPayable)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Vendor-wise Sales Price Breakup</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Sales exclude cancelled orders from payable amount. Cancelled totals are shown separately.
                </p>
              </div>
              <button
                onClick={loadSalesBreakdown}
                className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {loadingSales ? (
              <div className="flex justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
              </div>
            ) : salesError ? (
              <div className="p-8 text-center">
                <p className="text-red-600 font-semibold">{salesError}</p>
              </div>
            ) : vendorSales.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-gray-500 font-medium">No vendor sales available yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Vendor</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Orders</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Gross</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Commission Made</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Cancelled</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Net Payable</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Last Sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vendorSales.map((vendor) => (
                      <tr key={vendor.vendorId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">{vendor.vendorName}</p>
                          <p className="text-xs text-gray-500">{vendor.vendorEmail || "No email"}</p>
                          {vendor.vendorPhone ? (
                            <p className="text-xs text-gray-500">{vendor.vendorPhone}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">{vendor.orderCount}</p>
                          <p className="text-xs text-gray-500">Delivered: {vendor.deliveredOrderCount}</p>
                          {vendor.cancelledOrderCount > 0 ? (
                            <p className="text-xs text-red-500">Cancelled: {vendor.cancelledOrderCount}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">
                          {currencyFormatter.format(vendor.grossSales)}
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-amber-700">
                          {currencyFormatter.format(vendor.commissionMade)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-red-600">{currencyFormatter.format(vendor.cancelledAmount)}</p>
                          {vendor.cancelledItemCount > 0 ? (
                            <p className="text-xs text-gray-500">Items: {vendor.cancelledItemCount}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-green-700">
                          {currencyFormatter.format(vendor.netPayable)}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                          {vendor.lastSaleAt ? formatDate(vendor.lastSaleAt) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingSales && !salesError && salesTotals.cancelledAmount > 0 ? (
              <div className="px-6 py-3 border-t border-gray-100 bg-red-50/40">
                <p className="text-xs font-semibold text-red-700">
                  Cancelled value excluded from payout: {currencyFormatter.format(salesTotals.cancelledAmount)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

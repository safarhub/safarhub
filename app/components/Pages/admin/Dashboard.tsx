"use client";
// app/components/Pages/admin/Dashboard.tsx  ← REPLACE your existing file

import React, { useEffect, useState } from "react";
import StatCard from "./StatCard";
import DashboardVendorTable from "./DashboardVendorTable";
import LoyaltyTable from "./LoyaltyTable";

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<string>("0");
  const [orders, setOrders] = useState<string>("0");
  const [vendors, setVendors] = useState<string>("0");
  const [earnings, setEarnings] = useState<string>("₹0");
  const [activeTab, setActiveTab] = useState<"overview" | "loyalty">("overview");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const data = await res.json();
        if (data?.success) {
          const formatNumber = (n: number) => n.toLocaleString("en-IN");
          const formatINR = (n: number) =>
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(n);

          setUsers(formatNumber(data.totals.users || 0));
          setOrders(formatNumber(data.totals.orders || 0));
          setVendors(formatNumber(data.totals.vendors || 0));
          setEarnings(formatINR(data.totals.earningsINR || 0));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-6 text-gray-900 overflow-x-auto">
      <h1 className="text-2xl font-semibold mb-2">Hi 👋</h1>
      <p className="text-gray-800 mb-6">Welcome to your dashboard!</p>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Total Users" value={loading ? "…" : users} color="bg-indigo-500" />
        <StatCard title="Total Orders" value={loading ? "…" : orders} color="bg-yellow-500" />
        <StatCard title="Total Vendors" value={loading ? "…" : vendors} color="bg-red-400" />
        <StatCard title="Total Earnings" value={loading ? "…" : earnings} color="bg-green-500" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mt-8 mb-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          📊 Vendors Overview
        </button>
        <button
          onClick={() => setActiveTab("loyalty")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "loyalty"
              ? "bg-indigo-600 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          🏆 Loyalty Program
        </button>
      </div>

      {activeTab === "overview" ? (
        <DashboardVendorTable />
      ) : (
        <LoyaltyTable />
      )}
    </div>
  );
};

export default Dashboard;
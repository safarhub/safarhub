"use client";
import React, { useEffect, useState } from "react";

type Customer = {
  _id: string;
  fullName: string;
  email: string;
  contactNumber?: string;
  age?: number;
  accountType?: "user" | "vendor" | "admin";
  createdAt: string;
};

const CustomerTable: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setCustomers(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleRemove = async (id: string, name: string) => {
    const ok = window.confirm(`Remove ${name}? This action cannot be undone.`);
    if (!ok) return;

    try {
      setDeletingId(id);
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to remove user");
      }

      setCustomers((prev) => prev.filter((user) => user._id !== id));
    } catch (error: any) {
      alert(error?.message || "Unable to remove user");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6  overflow-y-auto overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4 text-black">All Customers</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-gray-700">
          <thead>
            <tr className="border-b text-sm text-gray-700">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Age</th>
              <th>Signup Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id} className="border-b hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-800">{c.fullName}</td>
                <td>{c.email}</td>
                <td>{c.contactNumber || "—"}</td>
                <td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.accountType === "vendor"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {c.accountType || "user"}
                  </span>
                </td>
                <td>{typeof c.age === "number" ? c.age : "—"}</td>
                <td>{new Date(c.createdAt).toLocaleString("en-IN")}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleRemove(c._id, c.fullName)}
                    disabled={deletingId === c._id}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      deletingId === c._id
                        ? "border-gray-200 text-gray-400"
                        : "border-red-200 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {deletingId === c._id ? "Removing..." : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerTable;



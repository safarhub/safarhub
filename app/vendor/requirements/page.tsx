"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { useVendorLayout } from "../VendorLayoutContext";

type Requirement = {
  _id: string;
  title: string;
  description: string;
  categories: string[];
  expectedPriceMin?: number | null;
  expectedPriceMax?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  numberOfGuests?: number | null;
  createdAt: string;
  user?: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    contactNumber?: string;
  };
};

export default function VendorRequirementsPage() {
  const { user } = useVendorLayout();
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/requirements/vendor", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error("Failed to load requirements", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const handleStartChat = (requirementId: string, userId: string) => {
    router.push(`/vendor/requirements/${requirementId}/chat?userId=${userId}`);
  };

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Customer Requirements</h1>
          <p className="text-gray-500 mt-1">
            View requirements that match your services
          </p>
        </div>
        <button
          onClick={loadRequirements}
          className="bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-xl font-medium shadow-md transition-all duration-200 flex items-center gap-2"
        >
          <FiRefreshCw size={18} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FiMessageSquare size={32} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Requirements Found
          </h2>
          <p className="text-gray-600">
            There are no customer requirements matching your services at the moment.
            Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requirements.map((req) => (
            (() => {
              const numberOfDays =
                req.checkIn && req.checkOut
                  ? Math.ceil(
                      (new Date(req.checkOut).getTime() - new Date(req.checkIn).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;

              return (
            <div
              key={req._id}
              className="bg-white shadow-md rounded-2xl p-6 hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-800">{req.title}</h3>
                <span className="text-sm text-gray-500">
                  {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>

              {req.description && (
                <p className="text-gray-600 mb-3">{req.description}</p>
              )}

              {(req.expectedPriceMin !== null && req.expectedPriceMin !== undefined) ||
              (req.expectedPriceMax !== null && req.expectedPriceMax !== undefined) ? (
                <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-amber-900">
                  Customer asked price: INR {req.expectedPriceMin ?? "-"} - INR {req.expectedPriceMax ?? "-"}
                </p>
              ) : null}

              <p className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm font-medium text-blue-900">
                Check-in: {req.checkIn ? new Date(req.checkIn).toLocaleDateString() : "-"} • Check-out: {req.checkOut ? new Date(req.checkOut).toLocaleDateString() : "-"}
                {numberOfDays ? ` (${numberOfDays} days)` : ""}
                {` • Guests: ${req.numberOfGuests !== null && req.numberOfGuests !== undefined ? req.numberOfGuests : "-"}`}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {req.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {req.user && (
                <div className="border-t pt-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    {req.user.avatar ? (
                      <img
                        src={req.user.avatar}
                        alt={req.user.fullName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                        {req.user.fullName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800">
                        {req.user.fullName}
                      </p>
                      <p className="text-sm text-gray-500">{req.user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => handleStartChat(req._id, req.user?._id || "")}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <FiMessageSquare size={18} />
                Chat with Customer
              </button>
            </div>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}

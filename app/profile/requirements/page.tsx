"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileLayout } from "../ProfileLayoutContext";
import { FiPlus, FiMessageSquare } from "react-icons/fi";

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
  user?: any;
};

const CATEGORY_OPTIONS = [
  { value: "stays", label: "Stays" },
  { value: "adventure", label: "Adventure" },
  { value: "tours", label: "Tours" },
  { value: "vehicle-rental", label: "Vehicle Rental" },
  { value: "market-place", label: "Market Place" },
];

export default function RequirementsPage() {
  const { user } = useProfileLayout();
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categories: [] as string[],
    expectedPriceMin: "",
    expectedPriceMax: "",
    checkIn: "",
    checkOut: "",
    numberOfGuests: "",
  });

  const loadRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/requirements/user", {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || formData.categories.length === 0) {
      alert("Please provide a title and select at least one category");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setFormData({
          title: "",
          description: "",
          categories: [],
          expectedPriceMin: "",
          expectedPriceMax: "",
          checkIn: "",
          checkOut: "",
          numberOfGuests: "",
        });
        setShowForm(false);
        loadRequirements();
      } else {
        alert(data.message || "Failed to post requirement");
      }
    } catch (error) {
      console.error("Failed to post requirement", error);
      alert("Failed to post requirement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pt-15">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Requirements</h1>
          <p className="text-gray-500 mt-1">
            Post your travel requirements and connect with vendors
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-medium shadow-md transition-all duration-200 flex items-center gap-2"
        >
          <FiPlus size={20} />
          New Requirement
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow-xl rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Post a New Requirement
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Need a hotel in Goa for 3 nights"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Provide more details about your requirement..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expected Price Min (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.expectedPriceMin}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedPriceMin: e.target.value })
                  }
                  placeholder="e.g., 8000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expected Price Max (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.expectedPriceMax}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedPriceMax: e.target.value })
                  }
                  placeholder="e.g., 12000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Check-In
                </label>
                <input
                  type="date"
                  value={formData.checkIn}
                  onChange={(e) =>
                    setFormData({ ...formData, checkIn: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Check-Out
                </label>
                <input
                  type="date"
                  value={formData.checkOut}
                  onChange={(e) =>
                    setFormData({ ...formData, checkOut: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Guests
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.numberOfGuests}
                  onChange={(e) =>
                    setFormData({ ...formData, numberOfGuests: e.target.value })
                  }
                  placeholder="e.g., 2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categories <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleCategoryToggle(option.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      formData.categories.includes(option.value)
                        ? "bg-purple-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post Requirement"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <FiMessageSquare size={32} className="text-purple-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Requirements Yet
          </h2>
          <p className="text-gray-600 mb-4">
            Start by posting your first travel requirement
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2"
          >
            <FiPlus size={20} />
            Post Your First Requirement
          </button>
        </div>
      ) : (
        <div className="space-y-4">
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
                <p className="text-sm text-gray-600 mb-3">
                  Expected price: INR {req.expectedPriceMin ?? "-"} - INR {req.expectedPriceMax ?? "-"}
                </p>
              ) : null}

              <p className="text-sm text-gray-600 mb-3">
                Stay details: {req.checkIn ? new Date(req.checkIn).toLocaleDateString() : "-"} to {req.checkOut ? new Date(req.checkOut).toLocaleDateString() : "-"}
                {numberOfDays ? ` (${numberOfDays} days)` : ""}
                {` • Guests: ${req.numberOfGuests !== null && req.numberOfGuests !== undefined ? req.numberOfGuests : "-"}`}
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {req.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              <button
                onClick={() =>
                  router.push(`/profile/requirements/${req._id}/chat`)
                }
                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-2"
              >
                <FiMessageSquare size={18} />
                View Responses
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

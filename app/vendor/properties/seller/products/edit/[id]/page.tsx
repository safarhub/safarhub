"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/app/components/Pages/vendor/Sidebar";
import { FaUpload, FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import { calculateCommission } from "@/lib/utils/commission";

type Variant = {
  _id?: string;
  color: string;
  size: string;
  stock: number;
  photos: string[];
  price?: number;
};

type CategoryOption = {
  slug: string;
  name: string;
  requiresVariants: boolean;
  owned: boolean;
};

const SERVICE_CATEGORY_KEYWORDS = [
  "stay",
  "hostel",
  "resort",
  "bnb",
  "tour",
  "adventure",
  "vehicle",
  "rental",
  "rent",
  "package",
];

const isProductCategory = (category: { slug?: string; name?: string }) => {
  const value = `${category.slug || ""} ${category.name || ""}`.toLowerCase();

  if (value.includes("market-place") || value.includes("marketplace") || value.includes("product")) {
    return true;
  }

  return !SERVICE_CATEGORY_KEYWORDS.some((keyword) => value.includes(keyword));
};

export default function SellerEditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  
  // Get navigation function from global context
  const navigate = typeof window !== 'undefined' ? (window as any).__VENDOR_NAVIGATE__?.navigate : null;

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    basePrice: 0,
    sellerBasePrice: 0,
    listingType: "buy" as "buy" | "rent",
    rentPriceDay: 0,
    sellerRentPriceDay: 0,
    commissionAmount: 0,
    commissionRate: 0,
    rentalQuantity: 0,
    rentalStartDate: "",
    rentalEndDate: "",
    stock: 0,
    images: [] as string[],
    variants: [] as Variant[],
    tags: [] as string[],
    isActive: true,
  });

  const [bulkColor, setBulkColor] = useState("");
  const [bulkSizes, setBulkSizes] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (res.status !== 200) {
          router.replace("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const user = data?.user;
        if (!user || user.accountType !== "vendor" || !user.isSeller) {
          router.replace("/vendor");
          return;
        }
        setAuthorized(true);
        fetchCategories();
        loadProduct();
      } catch {
        router.replace("/login");
      } finally {
        setCheckingAuth(false);
      }
    };
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, productId]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      // Only fetch vendor's own categories
      const res = await fetch("/api/categories?mine=true", { credentials: "include" });
      const data = await res.json();
      const vendorCategories: CategoryOption[] = [];
      
      if (data?.success) {
        vendorCategories.push(
          ...(data.categories || [])
            .filter((cat: any) => isProductCategory(cat))
            .map((cat: any) => ({
              slug: cat.slug,
              name: cat.name,
              requiresVariants: cat.requiresVariants,
              owned: true,
            }))
        );
      }
      
      setCategories(vendorCategories);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load product");
      }
      const product = data.product;
      setFormData({
        name: product.name || "",
        category: product.category || "",
        description: product.description || "",
        basePrice: product.basePrice || 0,
        sellerBasePrice: product.sellerBasePrice ?? product.basePrice ?? 0,
        listingType: product.listingType || "buy",
        rentPriceDay: product.rentPriceDay || 0,
        sellerRentPriceDay: product.sellerRentPriceDay ?? product.rentPriceDay ?? 0,
        commissionAmount: product.commissionAmount ?? 0,
        commissionRate: product.commissionRate ?? 0,
        rentalQuantity: product.rentalQuantity ?? 0,
        rentalStartDate: product.rentalStartDate ? new Date(product.rentalStartDate).toISOString().slice(0, 10) : "",
        rentalEndDate: product.rentalEndDate ? new Date(product.rentalEndDate).toISOString().slice(0, 10) : "",
        stock: product.stock ?? 0,
        images: product.images || [],
        variants: product.variants || [],
        tags: product.tags || [],
        isActive: product.isActive !== undefined ? product.isActive : true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load product";
      alert(message);
      navigate ? navigate("/vendor/properties/seller/products") : router.push("/vendor/properties/seller/products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFormData((prev) => {
      const sellerPrice =
        prev.listingType === "buy" ? prev.sellerBasePrice : prev.sellerRentPriceDay;
      const { ratePercent, amount, listingPrice } = calculateCommission(
        prev.listingType,
        prev.category,
        sellerPrice
      );

      const nextBasePrice = prev.listingType === "buy" ? listingPrice : 0;
      const nextRentPrice = prev.listingType === "rent" ? listingPrice : 0;

      if (
        prev.basePrice === nextBasePrice &&
        prev.rentPriceDay === nextRentPrice &&
        prev.commissionRate === ratePercent &&
        prev.commissionAmount === amount
      ) {
        return prev;
      }

      return {
        ...prev,
        basePrice: nextBasePrice,
        rentPriceDay: nextRentPrice,
        commissionRate: ratePercent,
        commissionAmount: amount,
      };
    });
  }, [formData.listingType, formData.category, formData.sellerBasePrice, formData.sellerRentPriceDay]);

  const uploadMedia = async (files: File[], folder: string) => {
    if (!files.length) return [] as string[];
    setUploadingState((prev) => ({ ...prev, [folder]: true }));
    setUploadError(null);

    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("folder", folder);

    try {
      const res = await fetch("/api/uploads/products", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.message || "Upload failed");
      const uploads = (data.uploads ?? []) as Array<{ url: string }>;
      return uploads.map((u) => u.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      throw err;
    } finally {
      setUploadingState((prev) => ({ ...prev, [folder]: false }));
    }
  };

  const handleMainImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = await uploadMedia(files, "products/main");
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (err) {
      console.error("Failed to upload images:", err);
    }
  };

  const removeMainImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          color: "",
          size: "",
          stock: 0,
          photos: [],
          price: prev.basePrice,
        },
      ],
    }));
  };

  const toggleBulkSize = (size: string) => {
    setBulkSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const addVariantsBulk = () => {
    const color = bulkColor.trim();
    if (!color || bulkSizes.length === 0) return;
    setFormData((prev) => {
      const existing = new Set(prev.variants.map((v) => `${v.color}|${v.size}`));
      const toAdd = bulkSizes
        .filter((sz) => !existing.has(`${color}|${sz}`))
        .map((sz) => ({
          color,
          size: sz,
          stock: 0,
          photos: [],
          price: prev.basePrice,
        }));
      const next = { ...prev, variants: [...prev.variants, ...toAdd] };
      return next;
    });
    setBulkColor("");
    setBulkSizes([]);
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = <K extends keyof Variant>(index: number, field: K, value: Variant[K]) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [field]: value };
      return { ...prev, variants };
    });
  };

  const handleVariantImages = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variantIndex: number
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = await uploadMedia(files, `products/variants/${variantIndex}`);
      updateVariant(variantIndex, "photos", [
        ...formData.variants[variantIndex].photos,
        ...urls,
      ]);
    } catch (err) {
      console.error("Failed to upload variant images:", err);
    }
  };

  const removeVariantImage = (variantIndex: number, imageIndex: number) => {
    setFormData((prev) => {
      const variants = [...prev.variants];
      variants[variantIndex].photos = variants[variantIndex].photos.filter(
        (_, i) => i !== imageIndex
      );
      return { ...prev, variants };
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) errs.name = "Product name is required";
    if (!formData.description.trim()) errs.description = "Description is required";
    if (formData.listingType === "buy" && formData.sellerBasePrice <= 0) {
      errs.sellerBasePrice = "Your price must be greater than 0";
    }
    if (formData.listingType === "rent" && formData.sellerRentPriceDay <= 0) {
      errs.sellerRentPriceDay = "Your rent price per day must be greater than 0";
    }
    if (
      formData.listingType === "rent" &&
      !(categories.find((cat) => cat.slug === formData.category)?.requiresVariants) &&
      formData.rentalQuantity <= 0
    ) {
      errs.rentalQuantity = "Rental quantity must be greater than 0";
    }
    if (formData.listingType === "rent" && !formData.rentalStartDate) errs.rentalStartDate = "Rental start date is required";
    if (formData.listingType === "rent" && !formData.rentalEndDate) errs.rentalEndDate = "Rental end date is required";
    if (
      formData.listingType === "rent" &&
      formData.rentalStartDate &&
      formData.rentalEndDate &&
      new Date(formData.rentalEndDate) < new Date(formData.rentalStartDate)
    ) {
      errs.rentalEndDate = "Rental end date must be after start date";
    }
    if (formData.images.length === 0) errs.images = "At least one image is required";

    const selectedCategory = categories.find((cat) => cat.slug === formData.category);
    if (selectedCategory?.requiresVariants) {
      if (formData.variants.length === 0) {
        errs.variants = `At least one variant is required for ${selectedCategory.name}`;
      } else {
        formData.variants.forEach((variant, idx) => {
          if (!variant.color.trim()) errs[`variant-${idx}-color`] = "Color is required";
          if (!variant.size.trim()) errs[`variant-${idx}-size`] = "Size is required";
          if (variant.stock < 0) errs[`variant-${idx}-stock`] = "Stock must be 0 or greater";
        });
      }
    } else if (selectedCategory && formData.listingType === "buy") {
      if (formData.stock < 0) errs.stock = "Stock must be 0 or greater";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update product");
      }
      navigate ? navigate("/vendor/properties/seller/products") : router.push("/vendor/properties/seller/products");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update product";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((cat) => cat.slug === formData.category);
  const needsVariants = selectedCategory?.requiresVariants || false;
  const fixedSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen bg-gray-50 text-black">
      {/* <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen pt-15 overflow-y-auto overflow-x-hidden">
        <Sidebar />
      </div> */}

      <div className="flex-1 flex flex-col overflow-y-auto">
       <div className="sticky top-0 z-40 bg-sky-50 border-b p-4 lg:pt-15 pt-0">
  <div className="flex items-center justify-between">
    
    {/* Left Side: Menu + Title */}
    {/* <div className="flex items-center gap-3">
      <button
        className="lg:hidden px-3 py-2 rounded border text-gray-700"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>

      <h1 className="text-2xl font-semibold text-gray-900">
        Edit Product
      </h1>
    </div> */}

    {/* Right Side: Cancel */}
    <button
      onClick={() => router.back()}
      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
    >
      Cancel
    </button>

  </div>
</div>

        <form onSubmit={handleSubmit} className="flex-1 p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter product name"
                />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                {loadingCategories ? (
                  <div className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-500">
                    Loading categories...
                  </div>
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCategory = categories.find((cat) => cat.slug === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        category: e.target.value,
                        stock: newCategory?.requiresVariants ? 0 : prev.stock,
                        variants: newCategory?.requiresVariants ? prev.variants : [],
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Describe your product"
                />
                {errors.description && (
                  <p className="text-red-600 text-sm mt-1">{errors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Listing Type</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.listingType === "buy"}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          listingType: "buy",
                          rentPriceDay: 0,
                          sellerRentPriceDay: 0,
                          rentalQuantity: 0,
                          rentalStartDate: "",
                          rentalEndDate: "",
                        }))
                      }
                      className="h-4 w-4 text-green-600"
                    />
                    <span className="text-gray-900">For Sale (Buy)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.listingType === "rent"}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          listingType: "rent",
                          basePrice: 0,
                          sellerBasePrice: 0,
                        }))
                      }
                      className="h-4 w-4 text-green-600"
                    />
                    <span className="text-gray-900">For Rent</span>
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Inventory</h3>
                {formData.listingType === "buy" && !needsVariants && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Available Stock (Units) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          stock: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter available stock"
                    />
                    {errors.stock && <p className="text-red-600 text-sm mt-1">{errors.stock}</p>}
                  </div>
                )}
                {formData.listingType === "buy" && needsVariants && (
                  <p className="text-sm text-gray-600">
                    This category uses variants. Set stock per variant in the Variants section below.
                  </p>
                )}
                {formData.listingType === "rent" && (
                  !needsVariants ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Available Stock (Rental Units) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.rentalQuantity}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            rentalQuantity: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {errors.rentalQuantity && <p className="text-red-600 text-sm mt-1">{errors.rentalQuantity}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Rental availability will be calculated from variant stock.</p>
                  )
                )}
              </div>

              {formData.listingType === "buy" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Your Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.sellerBasePrice}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sellerBasePrice: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                    {errors.sellerBasePrice && (
                      <p className="text-red-600 text-sm mt-1">{errors.sellerBasePrice}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Listing Price (Auto) (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.basePrice}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Your Rent Price / Day (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.sellerRentPriceDay}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sellerRentPriceDay: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {errors.sellerRentPriceDay && <p className="text-red-600 text-sm mt-1">{errors.sellerRentPriceDay}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Listing Rent / Day (Auto) (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.rentPriceDay}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Rental Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.rentalStartDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          rentalStartDate: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {errors.rentalStartDate && <p className="text-red-600 text-sm mt-1">{errors.rentalStartDate}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Rental End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.rentalEndDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          rentalEndDate: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {errors.rentalEndDate && <p className="text-red-600 text-sm mt-1">{errors.rentalEndDate}</p>}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-900">Product is active</label>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="h-5 w-5 rounded border-gray-300"
                />
              </div>


            </section>

            <section className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Product Images</h2>
              <div>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 text-gray-900">
                  <FaUpload className="text-gray-600" />
                  <span>Select images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleMainImages}
                  />
                </label>
                {uploadingState["products/main"] && (
                  <p className="text-sm text-gray-600 mt-1">Uploading…</p>
                )}
                {errors.images && <p className="text-red-600 text-sm mt-1">{errors.images}</p>}
                {formData.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {formData.images.map((src, i) => (
                      <div key={i} className="relative">
                        <img src={src} alt="" className="w-full h-32 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeMainImage(i)}
                          className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadError && <p className="text-sm text-red-500 mt-2">{uploadError}</p>}
              </div>
            </section>

            {needsVariants && (
              <section className="bg-white rounded-xl shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Variants</h2>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <FaPlus /> Add Variant
                  </button>
                </div>
                {errors.variants && <p className="text-red-600 text-sm">{errors.variants}</p>}

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Color</label>
                      <input
                        type="text"
                        value={bulkColor}
                        onChange={(e) => setBulkColor(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., Red"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-900 mb-2">Sizes</label>
                      <div className="flex flex-wrap gap-2">
                        {fixedSizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggleBulkSize(size)}
                            className={`px-3 py-1 rounded-full border text-sm font-semibold ${
                              bulkSizes.includes(size)
                                ? "border-green-600 bg-green-50 text-green-700"
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addVariantsBulk}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <FaPlus /> Add Selected Sizes
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {formData.variants.map((variant, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Variant {idx + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Color <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={variant.color}
                            onChange={(e) => updateVariant(idx, "color", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="e.g., Red"
                          />
                          {errors[`variant-${idx}-color`] && (
                            <p className="text-red-600 text-sm mt-1">
                              {errors[`variant-${idx}-color`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Size <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={variant.size}
                            onChange={(e) => updateVariant(idx, "size", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select size</option>
                            {fixedSizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          {errors[`variant-${idx}-size`] && (
                            <p className="text-red-600 text-sm mt-1">
                              {errors[`variant-${idx}-size`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Stock <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) =>
                              updateVariant(idx, "stock", parseInt(e.target.value) || 0)
                            }
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          {errors[`variant-${idx}-stock`] && (
                            <p className="text-red-600 text-sm mt-1">
                              {errors[`variant-${idx}-stock`]}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Variant Price (₹) - Optional
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={variant.price || ""}
                          onChange={(e) =>
                            updateVariant(
                              idx,
                              "price",
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Leave empty to use base price"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Variant Photos
                        </label>
                        <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 text-gray-900">
                          <FaUpload className="text-gray-600" />
                          <span>Select photos</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleVariantImages(e, idx)}
                          />
                        </label>
                        {uploadingState[`products/variants/${idx}`] && (
                          <p className="text-sm text-gray-600 mt-1">Uploading…</p>
                        )}
                        {variant.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {variant.photos.map((src, i) => (
                              <div key={i} className="relative">
                                <img src={src} alt="" className="w-full h-24 object-cover rounded-lg" />
                                <button
                                  type="button"
                                  onClick={() => removeVariantImage(idx, i)}
                                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1"
                                >
                                  <FaTimes />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Tags</h2>
              <div className="flex flex-col lg:flex-row gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter tag and press Enter"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Add
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-green-700 hover:text-green-900"
                      >
                        <FaTimes />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Updating..." : "Update Product"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg bg-gray-200 px-6 py-3 text-gray-700 font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-100 bg-black/40 lg:hidden"
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




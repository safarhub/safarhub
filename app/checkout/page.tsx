"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { FaCheck, FaPlus, FaShoppingBag } from "react-icons/fa";
import { useCart } from "../hooks/useCart";
import PageLoader from "../components/common/PageLoader";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Address = {
  _id: string;
  name: string;
  phone: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
  landmark?: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items: cartItems } = useCart({ autoLoad: true });

  const itemId = searchParams.get("item");
  const itemType = searchParams.get("type") as "Product" | "Stay" | "Tour" | "Adventure" | "VehicleRental" | null;
  const quantity = parseInt(searchParams.get("quantity") || "1");
  const fromCart = searchParams.get("fromCart") === "true";
  const variantIdParam = searchParams.get("variant");

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [singleRentalStart, setSingleRentalStart] = useState("");
  const [singleRentalEnd, setSingleRentalEnd] = useState("");
  const [cartRentalWindows, setCartRentalWindows] = useState<Record<string, { start: string; end: string }>>({});

  const [newAddress, setNewAddress] = useState({
    name: "",
    phone: "",
    pincode: "",
    address: "",
    city: "",
    state: "",
    landmark: "",
  });

  const toInputDate = (value?: string | Date | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };

  const nextDate = (start: string) => {
    const date = new Date(start);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + 1);
    return toInputDate(date);
  };

  const calcRentalDays = (start?: string, end?: string) => {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return 1;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getUnitPrice = (itemData: any, variant?: any) => {
    const fallbackPrice = Number(variant?.price ?? itemData?.price ?? itemData?.basePrice ?? 0);
    if (itemData?.listingType === "rent") {
      return Number(itemData?.rentPriceDay ?? fallbackPrice);
    }
    return fallbackPrice;
  };

  const computeSubtotal = () => {
    if (!item) return 0;

    if (item.isCart) {
      return item.items.reduce((sum: number, cartItem: any) => {
        const itemData = cartItem.item;
        const quantityValue = Number(cartItem.quantity || 1);
        const unitPrice = getUnitPrice(itemData, cartItem.variant);
        const rentalDays =
          cartItem.itemType === "Product" && itemData?.listingType === "rent"
            ? calcRentalDays(cartRentalWindows[cartItem._id]?.start, cartRentalWindows[cartItem._id]?.end)
            : 1;
        return sum + unitPrice * quantityValue * rentalDays;
      }, 0);
    }

    const quantityValue = Number(item.quantity || quantity || 1);
    const unitPrice = getUnitPrice(item, item.variant);
    const rentalDays =
      (item.itemType || itemType) === "Product" && item.listingType === "rent"
        ? calcRentalDays(singleRentalStart, singleRentalEnd)
        : 1;
    return unitPrice * quantityValue * rentalDays;
  };

  const loadRazorpayScript = async () => {
    if (typeof window !== "undefined" && window.Razorpay) {
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        existingScript.addEventListener("load", () => resolve(true), { once: true });
        existingScript.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    loadData();
  }, [itemId, itemType, fromCart, cartItems, variantIdParam]);

  useEffect(() => {
    if (!item) return;

    if (item.isCart) {
      const windows: Record<string, { start: string; end: string }> = {};
      item.items.forEach((cartItem: any) => {
        const itemData = cartItem.item;
        if (cartItem.itemType === "Product" && itemData?.listingType === "rent") {
          const start = toInputDate(itemData?.rentalStartDate) || toInputDate(new Date());
          const end = toInputDate(itemData?.rentalEndDate) || nextDate(start);
          windows[cartItem._id] = { start, end: end && end > start ? end : nextDate(start) };
        }
      });
      setCartRentalWindows(windows);
      return;
    }

    if ((item.itemType || itemType) === "Product" && item.listingType === "rent") {
      const startFromQuery = searchParams.get("rentalStartDate") || "";
      const endFromQuery = searchParams.get("rentalEndDate") || "";
      const start = startFromQuery || toInputDate(item.rentalStartDate) || toInputDate(new Date());
      const end = endFromQuery || toInputDate(item.rentalEndDate) || nextDate(start);
      setSingleRentalStart(start);
      setSingleRentalEnd(end && end > start ? end : nextDate(start));
    }
  }, [item, itemType, searchParams]);

  const loadData = async () => {
    try {
      // Load item
      if (fromCart && cartItems.length > 0) {
        // Use cart items
        const productItems = cartItems.filter((i) => i.itemType === "Product");
        if (productItems.length > 0) {
          setItem({ items: productItems, isCart: true });
        }
      } else if (itemId && itemType) {
        // Load single item
        let apiPath = "";
        if (itemType === "Product") {
          apiPath = `/api/products/${itemId}`;
        } else if (itemType === "Stay") {
          apiPath = `/stays/${itemId}`;
        } else if (itemType === "Tour") {
          apiPath = `/api/tours/${itemId}`;
        } else if (itemType === "Adventure") {
          apiPath = `/api/vendor/adventures/${itemId}`;
        } else if (itemType === "VehicleRental") {
          apiPath = `/api/vehicle-rentals/${itemId}`;
        }

        if (apiPath) {
          const res = await fetch(apiPath);
          if (res.ok) {
            const data = await res.json();
            const itemData = data.product || data.stay || data.tour || data.adventure || data.vehicleRental || data;
            let resolvedVariant = null;
            if (itemType === "Product" && variantIdParam && Array.isArray(itemData?.variants)) {
              resolvedVariant =
                itemData.variants.find(
                  (variant: any) => variant?._id?.toString() === variantIdParam
                ) || null;
            }

            setItem({
              ...itemData,
              itemType,
              quantity,
              isCart: false,
              variantId: resolvedVariant?._id?.toString() || variantIdParam,
              variant: resolvedVariant,
            });
          }
        }
      }

      // Load addresses
      const addrRes = await fetch("/api/addresses", { credentials: "include" });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddresses(addrData.addresses || []);
        if (addrData.addresses && addrData.addresses.length > 0) {
          setSelectedAddress(addrData.addresses[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.pincode || !newAddress.address || !newAddress.city || !newAddress.state) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAddress),
      });

      if (!res.ok) {
        throw new Error("Failed to add address");
      }

      const data = await res.json();
      setAddresses([...addresses, data.address]);
      setSelectedAddress(data.address);
      setShowNewAddress(false);
      setNewAddress({ name: "", phone: "", pincode: "", address: "", city: "", state: "", landmark: "" });
    } catch (err) {
      alert("Failed to add address");
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          subtotal: computeSubtotal(),
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid coupon");
      }

      setAppliedCoupon(data.coupon);
      setCouponCode("");
    } catch (err: any) {
      setCouponError(err.message);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      alert("Please select or add an address");
      return;
    }

    setProcessing(true);
    let checkoutOpened = false;
    try {
      let orderItems: any[] = [];

      if (item?.isCart) {
        // From cart - use all product items
        orderItems = item.items.map((cartItem: any) => ({
          ...(cartItem.itemType === "Product" && cartItem.item?.listingType === "rent"
            ? {
                rentalStartDate: cartRentalWindows[cartItem._id]?.start,
                rentalEndDate: cartRentalWindows[cartItem._id]?.end,
              }
            : {}),
          itemId: cartItem.itemId,
          itemType: cartItem.itemType,
          quantity: cartItem.quantity,
          variantId: cartItem.variantId || null,
        }));
      } else if (item) {
        // Single item
        orderItems = [
          {
            itemId: item._id || itemId,
            itemType: item.itemType || itemType,
            quantity: item.quantity || quantity,
            variantId: item.variantId || variantIdParam || null,
            ...(itemType === "Product" && item.listingType === "rent"
              ? {
                  rentalStartDate: singleRentalStart,
                  rentalEndDate: singleRentalEnd,
                }
              : {}),
          },
        ];
      }

      for (const orderItem of orderItems) {
        if (orderItem.itemType === "Product") {
          const refItem = item?.isCart
            ? item.items.find((cartItem: any) => cartItem.itemId === orderItem.itemId && (cartItem.variantId || null) === (orderItem.variantId || null))?.item
            : item;
          if (refItem?.listingType === "rent") {
            const start = orderItem.rentalStartDate;
            const end = orderItem.rentalEndDate;
            if (!start || !end || new Date(end) <= new Date(start)) {
              throw new Error("Please choose a valid rental period before payment.");
            }
          }
        }
      }

      if (orderItems.length === 0) {
        throw new Error("No items to order");
      }

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: orderItems,
          address: {
            name: selectedAddress.name,
            phone: selectedAddress.phone,
            pincode: selectedAddress.pincode,
            address: selectedAddress.address,
            city: selectedAddress.city,
            state: selectedAddress.state,
            landmark: selectedAddress.landmark,
          },
          deliveryCharge: 0,
          couponCode: appliedCoupon?.code,
          totalAmount: total,
        }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json();
        throw new Error(errorData?.message || "Failed to place order");
      }

      const orderData = await orderRes.json();
      const localOrderId = orderData?.order?._id;
      if (!localOrderId) {
        throw new Error("Order ID not found");
      }

      const paymentOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: localOrderId }),
      });

      const paymentOrderData = await paymentOrderRes.json();
      if (!paymentOrderRes.ok || !paymentOrderData?.success) {
        throw new Error(paymentOrderData?.message || "Failed to create payment order");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout. Please try again.");
      }

      const razorpayOptions = {
        key: paymentOrderData.key,
        amount: paymentOrderData.amount,
        currency: paymentOrderData.currency,
        name: "Safar Hub",
        description: `Order #${localOrderId}`,
        order_id: paymentOrderData.razorpayOrderId,
        prefill: {
          name: selectedAddress.name,
          contact: selectedAddress.phone,
        },
        notes: {
          localOrderId,
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                localOrderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.message || "Payment verification failed");
            }

            router.push("/profile/orders");
          } catch (verifyErr: any) {
            alert(verifyErr?.message || "Payment verification failed");
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
        theme: {
          color: "#16a34a",
        },
      };

      const paymentObject = new window.Razorpay(razorpayOptions);
      paymentObject.on("payment.failed", (response: any) => {
        alert(response?.error?.description || "Payment failed. Please try again.");
        setProcessing(false);
      });
      checkoutOpened = true;
      paymentObject.open();
      return;
    } catch (err: any) {
      alert(err.message || "Failed to place order");
    } finally {
      if (!checkoutOpened) {
        setProcessing(false);
      }
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">No items to checkout</p>
          <button
            onClick={() => router.push("/services/products")}
            className="rounded-lg bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  const subtotal = item.isCart
    ? computeSubtotal()
    : computeSubtotal();
  const deliveryCharge = 0;
  const discount = appliedCoupon?.appliedDiscount || 0;
  const total = subtotal + deliveryCharge - discount;

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-8 px-6 lg:px-2 pt-20">
      <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Item Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            {item.isCart ? (
              <div className="space-y-3">
                {item.items.map((cartItem: any) => {
                  const itemData = cartItem.item;
                  const price = getUnitPrice(itemData, cartItem.variant);
                  const isRentProduct = cartItem.itemType === "Product" && itemData?.listingType === "rent";
                  const rentalStart = cartRentalWindows[cartItem._id]?.start;
                  const rentalEnd = cartRentalWindows[cartItem._id]?.end;
                  const rentalDays = isRentProduct ? calcRentalDays(rentalStart, rentalEnd) : 1;
                  const image =
                    cartItem.variant?.photos?.[0] ||
                    itemData?.images?.[0] ||
                    itemData?.photos?.[0] ||
                    "/placeholder.jpg";
                  return (
                    <div key={cartItem._id} className="flex gap-4 pb-3 border-b">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <Image src={image} alt={itemData?.name || "Product"} fill sizes="100vw" className="object-cover" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{itemData?.name}</h3>
                        {cartItem.variant && (
                          <p className="text-sm text-gray-600">
                            Variant:{" "}
                            <span className="font-medium text-gray-900">
                              {cartItem.variant.color} • {cartItem.variant.size}
                            </span>
                          </p>
                        )}
                        <p className="text-sm text-gray-600">Quantity: {cartItem.quantity}</p>
                        {isRentProduct && (
                          <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={rentalStart || ""}
                                onChange={(e) =>
                                  setCartRentalWindows((prev) => ({
                                    ...prev,
                                    [cartItem._id]: {
                                      start: e.target.value,
                                      end: prev[cartItem._id]?.end || nextDate(e.target.value),
                                    },
                                  }))
                                }
                                className="rounded border border-gray-300 px-2 py-1 text-xs"
                              />
                              <input
                                type="date"
                                value={rentalEnd || ""}
                                onChange={(e) =>
                                  setCartRentalWindows((prev) => ({
                                    ...prev,
                                    [cartItem._id]: {
                                      start: prev[cartItem._id]?.start || toInputDate(new Date()),
                                      end: e.target.value,
                                    },
                                  }))
                                }
                                className="rounded border border-gray-300 px-2 py-1 text-xs"
                              />
                            </div>
                            <p className="text-xs text-gray-600">Rental Days: {rentalDays}</p>
                          </div>
                        )}
                        <p className="text-lg font-bold text-green-600">₹{(price * cartItem.quantity * rentalDays).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <Image
                    src={
                      item.variant?.photos?.[0] ||
                      item.images?.[0] ||
                      item.photos?.[0] ||
                      "/placeholder.jpg"
                    }
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {item.variant && (
                    <p className="text-sm text-gray-600">
                      Variant:{" "}
                      <span className="font-medium text-gray-900">
                        {item.variant.color} • {item.variant.size}
                      </span>
                    </p>
                  )}
                  <p className="text-sm text-gray-600">Quantity: {item.quantity || quantity}</p>
                  {(item.itemType || itemType) === "Product" && item.listingType === "rent" && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={singleRentalStart}
                          onChange={(e) => setSingleRentalStart(e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={singleRentalEnd}
                          onChange={(e) => setSingleRentalEnd(e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <p className="text-xs text-gray-600">Rental Days: {calcRentalDays(singleRentalStart, singleRentalEnd)}</p>
                    </div>
                  )}
                  <p className="text-lg font-bold text-green-600">
                    ₹
                    {(
                      getUnitPrice(item, item.variant) *
                      (item.quantity || quantity) *
                      (((item.itemType || itemType) === "Product" && item.listingType === "rent")
                        ? calcRentalDays(singleRentalStart, singleRentalEnd)
                        : 1)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Address Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <span className="h-2 w-2 rounded-full bg-green-600"></span>
              Delivery Address
            </h2>

            {addresses.length > 0 && (
              <div className="space-y-3 mb-4">
                {addresses.map((addr) => (
                  <div
                    key={addr._id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative ${selectedAddress?._id === addr._id
                      ? "border-green-600 bg-green-50/50 shadow-md"
                      : "border-gray-100 hover:border-gray-300 bg-gray-50/30"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{addr.name}</p>
                          {selectedAddress?._id === addr._id && (
                            <span className="text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full uppercase">Selected</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">{addr.address}</p>
                        <p className="text-sm text-gray-600 font-medium">
                          {addr.city}, {addr.state} - <span className="text-gray-900 font-bold">{addr.pincode}</span>
                        </p>
                        {addr.landmark && (
                          <p className="text-xs text-gray-500 bg-white/50 inline-block px-2 py-1 rounded-md border border-gray-100">
                            <span className="font-bold">Landmark:</span> {addr.landmark}
                          </p>
                        )}
                        <p className="text-sm text-gray-900 font-bold mt-2 flex items-center gap-1">
                          <span className="text-gray-500 text-xs font-normal">Phone:</span> {addr.phone}
                        </p>
                      </div>
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedAddress?._id === addr._id ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
                        {selectedAddress?._id === addr._id && <FaCheck className="text-white text-[10px]" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showNewAddress ? (
              <button
                onClick={() => setShowNewAddress(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-gray-700 hover:border-green-600 hover:text-green-600"
              >
                <FaPlus /> Add New Address
              </button>
            ) : (
              <div className="space-y-6 p-6 border-2 border-green-600 bg-white rounded-2xl shadow-sm">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Add New Address</h3>
                  <span className="text-xs font-semibold text-rose-500 uppercase tracking-tighter">* Required fields</span>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newAddress.name}
                      onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Phone Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Pincode *</label>
                    <input
                      type="text"
                      placeholder="e.g. 110001"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">City *</label>
                    <input
                      type="text"
                      placeholder="e.g. New Delhi"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">State *</label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Landmark (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Big Hospital"
                      value={newAddress.landmark}
                      onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Full Address *</label>
                  <textarea
                    placeholder="Enter house no, street, area details..."
                    value={newAddress.address}
                    onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 font-medium placeholder:text-gray-400 focus:border-green-600 focus:ring-1 focus:ring-green-600 focus:outline-none transition-all shadow-sm"
                    rows={3}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleAddAddress}
                    className="flex-1 rounded-xl bg-green-600 px-6 py-4 text-white font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg active:scale-[0.98]"
                  >
                    Save & Use This Address
                  </button>
                  <button
                    onClick={() => {
                      setShowNewAddress(false);
                      setNewAddress({ name: "", phone: "", pincode: "", address: "", city: "", state: "", landmark: "" });
                    }}
                    className="px-6 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold uppercase tracking-widest hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="bg-white rounded-lg shadow p-6 h-fit sticky top-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Price Details</h2>

          {/* Coupon Section */}
          <div className="mb-6 space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-900">HAVE A COUPON?</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="COUPON CODE"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 uppercase font-bold text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none"
              />
              <button
                onClick={handleApplyCoupon}
                disabled={validatingCoupon || !couponCode}
                className="rounded-lg bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-black disabled:opacity-50"
              >
                {validatingCoupon ? "..." : "Apply"}
              </button>
            </div>
            {couponError && <p className="text-xs text-red-500 font-medium">{couponError}</p>}

            {appliedCoupon && (
              <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold">
                    %
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-800 tracking-wider uppercase">
                      {appliedCoupon.code}
                    </p>
                    <p className="text-[10px] text-green-600 font-medium">Applied successfully</p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-xs font-bold text-red-500 hover:text-red-700"
                >
                  REMOVE
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount</span>
                <span>-₹{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
              <span>Total</span>
              <span>₹{total.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={processing || !selectedAddress}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaShoppingBag /> {processing ? "Processing Payment..." : "Pay with Razorpay"}
          </button>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Payment: Secure Razorpay checkout
          </p>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FaShoppingBag, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import LocalLoader from "../../components/common/LocalLoader";
import CancellationModal from "../../components/common/CancellationModal";
import ReviewModal from "../../components/Reviews/ReviewModal";
import { UNIFIED_CANCELLATION_POLICY_LINES } from "@/lib/utils/cancellationPolicy";

const PRESET_ORDER_REASONS = [
  "Ordered the wrong item",
  "Found a better price elsewhere",
  "Shipping feels too slow",
  "No longer need the product",
  "Payment or billing issue",
];

type OrderItem = {
  itemId: string;
  itemType: string;
  quantity: number;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  rentalDays?: number | null;
  listingType?: "buy" | "rent";
  unitPrice?: number;
  lineAmount?: number;
  itemData?: any;
  variantId?: string | null;
  variant?: {
    color?: string;
    size?: string;
    price?: number;
    photos?: string[];
  } | null;
  status?: string;
  deliveryDate?: string | null;
};

type Order = {
  _id: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  orderKind?: "service_payment" | "order";
  bookingSynced?: boolean;
  bookingSyncIssue?: boolean;
  orderContext?: "catalog" | "requirement_deal";
  requirementDealDetails?: {
    requirementTitle: string;
    amount: number;
    vendorName: string;
    customerName: string;
    checkIn?: string | null;
    checkOut?: string | null;
    numberOfGuests?: number | null;
    numberOfDays?: number | null;
  } | null;
  address: {
    name: string;
    phone: string;
    pincode: string;
    address: string;
    city: string;
    state: string;
    landmark?: string;
  };
  status: string;
  createdAt: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancellationBreakdown?: {
    policyLabel?: string;
    daysBeforeArrival?: number | null;
    deductionPercent?: number;
    deductionAmount?: number;
    refundAmount?: number;
  } | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; type: any } | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await fetch("/api/orders", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeStatus = (status: string) => {
    if (!status) return "Pending";
    if (status === "Placed") return "Paid";
    return status;
  };

  const getStatusColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case "Pending":
        return "bg-blue-100 text-blue-700";
      case "Paid":
        return "bg-emerald-100 text-emerald-700";
      case "Processing":
        return "bg-yellow-100 text-yellow-700";
      case "Shipped":
        return "bg-purple-100 text-purple-700";
      case "Delivered":
        return "bg-green-100 text-green-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canCancelOrder = (order: Order) => {
    const status = normalizeStatus(order.status);
    if (status === "Delivered" || status === "Cancelled") return false;
    return true;
  };

  const openCancellationModal = (orderId: string) => {
    setCancellingId(orderId);
    setModalOpen(true);
  };

  const handleCancelOrder = async (reason: string) => {
    if (!cancellingId) return;
    setModalSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${cancellingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel", reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Unable to cancel order");
      }
      await loadOrders();
      setModalOpen(false);
      setCancellingId(null);
    } catch (err: any) {
      alert(err?.message || "We couldn’t cancel the order right now. Please try again.");
    } finally {
      setModalSubmitting(false);
    }
  };

  if (loading) {
    return <LocalLoader />;
  }

  return (
    <div className="space-y-6 lg:pt-15 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
        <span className="text-sm text-gray-600">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FaShoppingBag className="text-6xl text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No orders yet</h2>
          <p className="text-gray-500 mb-6">Your order history will appear here</p>
        </div>
      ) : (
        <div className="space-y-6 ">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FaShoppingBag className="text-green-600" />
                    <span className="font-semibold text-gray-900">Order #{order._id.slice(-8).toUpperCase()}</span>
                  </div>
                  {order.orderContext === "requirement_deal" && order.requirementDealDetails && (
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                      <p className="font-semibold">Requirement: {order.requirementDealDetails.requirementTitle}</p>
                      <p>Amount: ₹{order.requirementDealDetails.amount.toLocaleString()}</p>
                      <p>Vendor: {order.requirementDealDetails.vendorName}</p>
                      <p>Customer: {order.requirementDealDetails.customerName}</p>
                      {(order.requirementDealDetails.checkIn || order.requirementDealDetails.checkOut) && (
                        <p>
                          Dates: {order.requirementDealDetails.checkIn ? formatDate(order.requirementDealDetails.checkIn) : "-"}
                          {" "}to{" "}
                          {order.requirementDealDetails.checkOut ? formatDate(order.requirementDealDetails.checkOut) : "-"}
                          {order.requirementDealDetails.numberOfDays ? ` (${order.requirementDealDetails.numberOfDays} days)` : ""}
                        </p>
                      )}
                      {order.requirementDealDetails.numberOfGuests ? (
                        <p>Guests: {order.requirementDealDetails.numberOfGuests}</p>
                      ) : null}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <FaCalendarAlt />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaMapMarkerAlt />
                      <span>{order.address.city}, {order.address.state}</span>
                    </div>
                  </div>
                  {order.bookingSyncIssue && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Payment is captured, but booking confirmation is not visible yet. Please contact support with this order ID.
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {normalizeStatus(order.status)}
                  </span>
                  {canCancelOrder(order) && (
                    <button
                      type="button"
                      onClick={() => openCancellationModal(order._id)}
                      disabled={modalSubmitting && cancellingId === order._id}
                      className={`text-sm font-semibold rounded-full border px-4 py-1 ${modalSubmitting && cancellingId === order._id
                        ? "border-gray-200 text-gray-400"
                        : "border-red-200 text-red-600 hover:bg-red-50"
                        }`}
                    >
                      {modalSubmitting && cancellingId === order._id ? "Cancelling..." : "Cancel Order"}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {order.items.map((item, idx) => {
                  const itemData = item.itemData;
                  const isRentalItem =
                    item.listingType === "rent" ||
                    itemData?.listingType === "rent" ||
                    Boolean(item.rentalDays) ||
                    Boolean(item.rentalStartDate) ||
                    Boolean(item.rentalEndDate) ||
                    Number(itemData?.rentPriceDay ?? 0) > 0;
                  const unitPrice = isRentalItem
                    ? Number(
                        item.unitPrice ??
                          itemData?.rentPriceDay ??
                          item.variant?.price ??
                          itemData?.price ??
                          itemData?.basePrice ??
                          0
                      )
                    : Number(item.unitPrice ?? item.variant?.price ?? itemData?.price ?? itemData?.basePrice ?? 0);
                  const rentalDays = Number(item.rentalDays ?? 0);
                  const rentalMultiplier = isRentalItem ? (rentalDays > 0 ? rentalDays : 1) : 1;
                  const computedLineTotal = Number(unitPrice) * item.quantity * rentalMultiplier;
                  const singleOrderFallback = order.items.length === 1 ? order.totalAmount : 0;
                  const lineTotal = Number(
                    item.lineAmount ?? (computedLineTotal || singleOrderFallback)
                  );
                  const image =
                    item.variant?.photos?.[0] ||
                    itemData?.images?.[0] ||
                    itemData?.photos?.[0];
                  const itemTitle = itemData?.name || itemData?.title || "Item";
                  return (
                    <div key={idx} className="flex gap-4 pb-4 border-b last:border-0">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {typeof image === "string" && image.trim().length > 0 ? (
                          <Image src={image} alt={itemTitle} fill sizes="100vw" className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{itemTitle}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(item.status || order.status)}`}>
                            {normalizeStatus(item.status || order.status)}
                          </span>
                          {isRentalItem && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              Rental
                            </span>
                          )}
                        </div>
                        {item.variant && (
                          <p className="text-sm text-gray-600">
                            Variant:{" "}
                            <span className="font-medium text-gray-900">
                              {item.variant.color} • {item.variant.size}
                            </span>
                          </p>
                        )}
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        {isRentalItem ? (
                          <>
                            <p className="text-xs text-gray-500">
                              Rental period:{" "}
                              <span className="font-semibold text-gray-700">
                                {item.rentalStartDate ? formatDate(item.rentalStartDate) : "-"} to {item.rentalEndDate ? formatDate(item.rentalEndDate) : "-"}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Price details:{" "}
                              <span className="font-semibold text-gray-700">
                                ₹{Number(unitPrice).toLocaleString()} / day x {item.quantity} x {rentalMultiplier} day{rentalMultiplier > 1 ? "s" : ""}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Delivery date:{" "}
                            <span className="font-semibold text-gray-700">
                              {item.deliveryDate ? formatDate(item.deliveryDate) : "Not scheduled yet"}
                            </span>
                          </p>
                        )}
                        <p className="text-lg font-bold text-green-600">₹{lineTotal.toLocaleString()}</p>

                        {(item.status === "Delivered" || order.status === "Delivered") && (
                          <button
                            onClick={() => {
                              setReviewTarget({ id: item.itemId, type: "Product" });
                              setReviewModalOpen(true);
                            }}
                            className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-1.5 rounded-lg transition-colors"
                          >
                            Write a Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-green-600" />
                    Delivery Address
                  </h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p className="font-bold text-gray-900">{order.address.name}</p>
                    <p className="font-medium leading-relaxed">{order.address.address}</p>
                    <p className="font-medium">
                      {order.address.city}, {order.address.state} - <span className="font-bold text-gray-900">{order.address.pincode}</span>
                    </p>
                    {order.address.landmark && (
                      <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block mt-1">
                        <span className="font-bold">Landmark:</span> {order.address.landmark}
                      </p>
                    )}
                    <p className="mt-2 text-gray-900 font-bold flex items-center gap-1">
                      <span className="text-gray-500 text-xs font-normal underline decoration-green-200">Phone:</span> {order.address.phone}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">₹{order.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform Charge:</span>
                      <span className="font-medium">₹{order.deliveryCharge}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                      <span>Total:</span>
                      <span>₹{(order.totalAmount + order.deliveryCharge).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {order.cancellationReason && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Cancellation reason</p>
                  <p className="mt-1">{order.cancellationReason}</p>
                  {order.cancellationBreakdown && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-white/70 p-3 text-xs text-red-800">
                      <p className="font-semibold">
                        Deduction: ₹{Number(order.cancellationBreakdown.deductionAmount ?? 0).toLocaleString()} 
                        {typeof order.cancellationBreakdown.deductionPercent === "number"
                          ? ` (${order.cancellationBreakdown.deductionPercent}%)`
                          : ""}
                      </p>
                      <p className="mt-1">
                        Refund: ₹{Number(order.cancellationBreakdown.refundAmount ?? 0).toLocaleString()}
                      </p>
                      {order.cancellationBreakdown.policyLabel && (
                        <p className="mt-1 text-red-700/90">{order.cancellationBreakdown.policyLabel}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CancellationModal
        open={modalOpen}
        title="Cancel this order"
        subtitle="Charges are applied by arrival window: 45+ days free, 45-30 days 15%, 30-7 days 35%, within 7 days 100%."
        policyLines={Array.from(UNIFIED_CANCELLATION_POLICY_LINES)}
        presetReasons={PRESET_ORDER_REASONS}
        submitting={modalSubmitting}
        onClose={() => {
          if (modalSubmitting) return;
          setModalOpen(false);
          setCancellingId(null);
        }}
        onConfirm={handleCancelOrder}
      />

      {reviewTarget && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          targetId={reviewTarget.id}
          targetType={reviewTarget.type}
          onSuccess={() => {
            loadOrders();
          }}
        />
      )}
    </div>
  );
}


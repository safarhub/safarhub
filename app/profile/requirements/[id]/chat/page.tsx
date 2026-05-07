"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiSend, FiArrowLeft } from "react-icons/fi";
import { useProfileLayout } from "../../../ProfileLayoutContext";
import { REQUIREMENT_CHAT_PRESETS_CUSTOMER } from "@/lib/utils/requirementChatPresets";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Message = {
  _id: string;
  message: string;
  kind?: "preset" | "price_offer" | "price_counter" | "price_accept" | "drive_link" | "system";
  priceAmount?: number | null;
  linkUrl?: string | null;
  sender: {
    _id: string;
    fullName: string;
    avatar?: string;
  };
  receiver: {
    _id: string;
    fullName: string;
    avatar?: string;
  };
  createdAt: string;
};

type Vendor = {
  _id: string;
  fullName: string;
  avatar?: string;
};

type Requirement = {
  _id: string;
  title: string;
  expectedPriceMin?: number | null;
  expectedPriceMax?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  numberOfGuests?: number | null;
};

const REQUIREMENT_COMMISSION_RATE = 2.5;

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function formatPriceLabel(msg: Message, isMe: boolean) {
  if ((msg.kind !== "price_offer" && msg.kind !== "price_counter") || !msg.priceAmount) {
    return null;
  }

  if (msg.kind === "price_offer") {
    return isMe ? "My offered price" : "Vendor offered price";
  }

  return isMe ? "My asked price" : "Customer asked price";
}

export default function UserRequirementChatPage() {
  const { user } = useProfileLayout();
  const router = useRouter();
  const params = useParams();
  const requirementId = params.id as string;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [counterPrice, setCounterPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
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
    scrollToBottom();
  }, [messages]);

  const loadRequirement = useCallback(async () => {
    try {
      const res = await fetch(`/api/requirements/${requirementId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.requirement) {
        setRequirement(data.requirement);
      }
    } catch (error) {
      console.error("Failed to load requirement", error);
    }
  }, [requirementId]);

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/messages/conversations?requirementId=${requirementId}`,
        {
          credentials: "include",
        }
      );
      const data = await res.json();
      if (data.success) {
        setVendors(data.partners || []);
        
        // Auto-select first vendor if available
        if (data.partners && data.partners.length > 0 && !selectedVendor) {
          setSelectedVendor(data.partners[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load vendors", error);
    } finally {
      setLoading(false);
    }
  }, [requirementId, selectedVendor]);

  const loadMessages = useCallback(async () => {
    if (!selectedVendor) return;

    try {
      const res = await fetch(
        `/api/messages?requirementId=${requirementId}&userId=${selectedVendor._id}`,
        {
          credentials: "include",
        }
      );
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  }, [requirementId, selectedVendor]);

  useEffect(() => {
    loadRequirement();
    loadVendors();
  }, [loadRequirement, loadVendors]);

  useEffect(() => {
    if (selectedVendor) {
      loadMessages();
      
      // Poll for new messages every 3 seconds
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedVendor, loadMessages]);

  const latestNegotiatedPrice = [...messages]
    .reverse()
    .find((msg) => (msg.kind === "price_offer" || msg.kind === "price_counter") && !!msg.priceAmount)
    ?.priceAmount;

  const latestConfirmedPrice = [...messages]
    .reverse()
    .find((msg) => msg.kind === "price_accept" && !!msg.priceAmount)
    ?.priceAmount;

  const requirementCommissionAmount = latestConfirmedPrice
    ? roundToTwo((latestConfirmedPrice * REQUIREMENT_COMMISSION_RATE) / 100)
    : 0;
  const requirementTotalPayable = latestConfirmedPrice
    ? roundToTwo(latestConfirmedPrice + requirementCommissionAmount)
    : 0;

  const priceLocked = Boolean(latestConfirmedPrice);

  const bookingConfirmed = messages.some(
    (msg) =>
      msg.kind === "system" &&
      typeof msg.message === "string" &&
      (msg.message.startsWith("Payment completed for INR ") ||
        msg.message.startsWith("Booking confirmed at INR "))
  );

  const handleSendMessage = async (presetText: string) => {
    if (!presetText.trim() || !selectedVendor) return;

    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId: selectedVendor._id,
          message: presetText.trim(),
          kind: "preset",
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadMessages();
      } else {
        alert(data.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSendCounter = async () => {
    if (priceLocked) {
      alert("Price is already confirmed. Counter offer is disabled.");
      return;
    }

    if (!selectedVendor || !counterPrice.trim() || sending) return;
    const amount = Number(counterPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid counter offer amount");
      return;
    }

    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId: selectedVendor._id,
          message: "Counter offer shared",
          kind: "price_counter",
          priceAmount: amount,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to send counter offer");
        return;
      }

      setCounterPrice("");
      loadMessages();
    } catch {
      alert("Failed to send counter offer");
    } finally {
      setSending(false);
    }
  };

  const handlePayNow = async () => {
    if (!selectedVendor || !latestConfirmedPrice || sending || bookingConfirmed) return;

    let checkoutOpened = false;

    try {
      setSending(true);

      const createOrderRes = await fetch("/api/requirements/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          vendorId: selectedVendor._id,
          amount: latestConfirmedPrice,
        }),
      });

      const createOrderData = await createOrderRes.json();
      if (!createOrderRes.ok || !createOrderData?.success || !createOrderData?.orderId) {
        throw new Error(createOrderData?.message || "Failed to create requirement order");
      }

      const localOrderId = createOrderData.orderId as string;

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
        description: `Requirement payment #${localOrderId}`,
        order_id: paymentOrderData.razorpayOrderId,
        prefill: {
          name: user.fullName,
          email: user.email,
        },
        notes: {
          localOrderId,
          requirementId,
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

            loadMessages();
          } catch (verifyErr: any) {
            alert(verifyErr?.message || "Payment verification failed");
          } finally {
            setSending(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSending(false);
          },
        },
        theme: {
          color: "#0ea5e9",
        },
      };

      const paymentObject = new window.Razorpay(razorpayOptions);
      paymentObject.on("payment.failed", (response: any) => {
        alert(response?.error?.description || "Payment failed. Please try again.");
        setSending(false);
      });
      checkoutOpened = true;
      paymentObject.open();
      return;

    } catch (error: any) {
      alert(error?.message || "Failed to initiate payment");
    } finally {
      if (!checkoutOpened) {
        setSending(false);
      }
    }
  };

  const handleConfirmPrice = async () => {
    if (!selectedVendor || !latestNegotiatedPrice || sending) return;

    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId: selectedVendor._id,
          message: `Price confirmed at INR ${latestNegotiatedPrice}`,
          kind: "price_accept",
          priceAmount: latestNegotiatedPrice,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to confirm price");
        return;
      }

      loadMessages();
    } catch {
      alert("Failed to confirm price");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  const requirementDays =
    requirement?.checkIn && requirement?.checkOut
      ? Math.ceil(
          (new Date(requirement.checkOut).getTime() - new Date(requirement.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  return (
    <div className="space-y-6 pt-15">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/profile/requirements")}
          className="text-gray-600 hover:text-gray-800"
        >
          <FiArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Requirement Responses</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FiSend size={32} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Responses Yet
          </h2>
          <p className="text-gray-600">
            Vendors haven&apos;t responded to your requirement yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Vendor List */}
          <div className="lg:col-span-1 bg-white shadow-md rounded-2xl p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 mb-3">Vendors</h2>
            {vendors.map((vendor) => (
              <button
                key={vendor._id}
                onClick={() => setSelectedVendor(vendor)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedVendor?._id === vendor._id
                    ? "bg-purple-100 border-2 border-purple-500"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  {vendor.avatar ? (
                    <img
                      src={vendor.avatar}
                      alt={vendor.fullName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-blue-400 flex items-center justify-center text-white font-bold">
                      {vendor.fullName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold text-sm truncate">
                      {vendor.fullName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3 bg-white shadow-md rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[620px]">
            {selectedVendor ? (
              <>
                {/* Chat Header */}
                <div className="bg-purple-500 text-white px-6 py-4">
                  <h3 className="font-bold text-lg">{selectedVendor.fullName}</h3>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Expected price</p>
                    <p>
                      INR {requirement?.expectedPriceMin ?? "-"} - INR {requirement?.expectedPriceMax ?? "-"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p className="font-semibold">Stay details</p>
                    <p>
                      {requirement?.checkIn ? new Date(requirement.checkIn).toLocaleDateString() : "-"} to {requirement?.checkOut ? new Date(requirement.checkOut).toLocaleDateString() : "-"}
                      {requirementDays ? ` (${requirementDays} days)` : ""}
                    </p>
                    <p>
                      Guests: {requirement?.numberOfGuests !== null && requirement?.numberOfGuests !== undefined ? requirement.numberOfGuests : "-"}
                    </p>
                  </div>

                  {messages.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender._id === user._id;
                      return (
                        <div
                          key={msg._id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-md px-4 py-2 rounded-2xl ${
                              isMe
                                ? "bg-purple-500 text-white"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            <p className="text-sm font-semibold mb-1">
                              {msg.sender.fullName}
                            </p>
                            <p>{msg.message}</p>
                            {(msg.kind === "price_offer" || msg.kind === "price_counter") && msg.priceAmount ? (
                              <p className={`text-sm mt-1 font-semibold ${isMe ? "text-purple-100" : "text-gray-700"}`}>
                                {formatPriceLabel(msg, isMe)}: INR {msg.priceAmount}
                              </p>
                            ) : null}
                            {msg.kind === "price_accept" && msg.priceAmount ? (
                              <p className={`text-sm mt-1 font-semibold ${isMe ? "text-emerald-100" : "text-emerald-700"}`}>
                                Confirmed price: INR {msg.priceAmount}
                              </p>
                            ) : null}
                            {msg.kind === "system" && msg.priceAmount ? (
                              <p className={`text-sm mt-1 font-semibold ${isMe ? "text-sky-100" : "text-sky-700"}`}>
                                Booking confirmed amount: INR {msg.priceAmount}
                              </p>
                            ) : null}
                            {msg.kind === "drive_link" && msg.linkUrl ? (
                              <a
                                href={msg.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-sm mt-1 underline break-all ${isMe ? "text-purple-100" : "text-blue-700"}`}
                              >
                                {msg.linkUrl}
                              </a>
                            ) : null}
                            <p
                              className={`text-xs mt-1 ${
                                isMe ? "text-purple-100" : "text-gray-500"
                              }`}
                            >
                              {new Date(msg.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t px-6 py-4 max-h-[280px] overflow-y-auto">
                  {latestNegotiatedPrice ? (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-900">
                        Latest negotiated price: INR {latestNegotiatedPrice}
                      </p>
                      <button
                        type="button"
                        onClick={handleConfirmPrice}
                        disabled={sending}
                        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Confirm This Price
                      </button>
                    </div>
                  ) : null}

                  {latestConfirmedPrice ? (
                    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                      <p className="text-sm font-semibold text-sky-900">
                        Confirmed amount: INR {latestConfirmedPrice}
                      </p>
                      <p className="mt-1 text-xs text-sky-900">
                        Platform fee ({REQUIREMENT_COMMISSION_RATE}%): INR {requirementCommissionAmount}
                      </p>
                      <p className="text-sm font-semibold text-sky-900">
                        Total payable: INR {requirementTotalPayable}
                      </p>
                      <button
                        type="button"
                        onClick={handlePayNow}
                        disabled={sending || bookingConfirmed}
                        className="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {bookingConfirmed ? "Booking Confirmed" : `Pay Now (INR ${requirementTotalPayable})`}
                      </button>
                    </div>
                  ) : null}

                  {priceLocked ? (
                    <p className="mb-3 text-sm font-medium text-emerald-700">
                      Price is confirmed. New counter offers are disabled.
                    </p>
                  ) : null}

                  <p className="text-sm text-gray-600 mb-2">Quick messages</p>
                  <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                    {Object.values(REQUIREMENT_CHAT_PRESETS_CUSTOMER).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSendMessage(preset)}
                        disabled={sending}
                        className="shrink-0 rounded-full border border-purple-200 px-3 py-1 text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      min={0}
                      value={counterPrice}
                      onChange={(e) => setCounterPrice(e.target.value)}
                      placeholder="Your counter offer (INR)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={sending || priceLocked}
                    />
                    <button
                      type="button"
                      onClick={handleSendCounter}
                      disabled={sending || !counterPrice.trim() || priceLocked}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                    >
                      Send Counter Offer
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a vendor to start chatting
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

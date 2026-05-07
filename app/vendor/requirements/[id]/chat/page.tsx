"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { useVendorLayout } from "../../../VendorLayoutContext";
import { REQUIREMENT_CHAT_PRESETS_VENDOR } from "@/lib/utils/requirementChatPresets";

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
  user?: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
  };
};

function formatPriceLabel(msg: Message, isMe: boolean) {
  if ((msg.kind !== "price_offer" && msg.kind !== "price_counter") || !msg.priceAmount) {
    return null;
  }

  if (msg.kind === "price_offer") {
    return isMe ? "My offered price" : "Vendor offered price";
  }

  return isMe ? "My asked price" : "Customer asked price";
}

export default function VendorChatPage() {
  const { user } = useVendorLayout();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const requirementId = params.id as string;
  const userId = searchParams.get("userId");

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [offerPrice, setOfferPrice] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
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
      } else {
        setError("Failed to load requirement");
      }
    } catch (error) {
      console.error("Failed to load requirement", error);
      setError("Failed to load requirement");
    }
  }, [requirementId]);

  const loadMessages = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/messages?requirementId=${requirementId}&userId=${userId}`,
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
    } finally {
      setLoading(false);
    }
  }, [requirementId, userId]);

  useEffect(() => {
    loadRequirement();
    loadMessages();

    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [loadRequirement, loadMessages]);

  const latestConfirmedPrice = [...messages]
    .reverse()
    .find((msg) => msg.kind === "price_accept" && !!msg.priceAmount)
    ?.priceAmount;

  const requirementDays =
    requirement?.checkIn && requirement?.checkOut
      ? Math.ceil(
          (new Date(requirement.checkOut).getTime() - new Date(requirement.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const priceLocked = Boolean(latestConfirmedPrice);

  const handleSendMessage = async (presetText: string) => {
    if (!presetText.trim() || !userId) return;

    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId: userId,
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

  const handleSendOffer = async () => {
    if (priceLocked) {
      alert("Price is already confirmed. New offers are disabled.");
      return;
    }

    if (!userId || !offerPrice.trim() || sending) return;

    const amount = Number(offerPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid offer amount");
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
          receiverId: userId,
          message: "Service offer shared",
          kind: "price_offer",
          priceAmount: amount,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to send offer");
        return;
      }

      setOfferPrice("");
      loadMessages();
    } catch {
      alert("Failed to send offer");
    } finally {
      setSending(false);
    }
  };

  const handleSendDriveLink = async () => {
    if (!userId || !driveLink.trim() || sending) return;

    try {
      setSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId: userId,
          message: "Google Drive link shared",
          kind: "drive_link",
          linkUrl: driveLink.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to send link");
        return;
      }

      setDriveLink("");
      loadMessages();
    } catch {
      alert("Failed to send link");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !requirement) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">{error || "Requirement not found"}</p>
          <button
            onClick={() => router.push("/vendor/requirements")}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
          >
            Back to Requirements
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/vendor/requirements")}
          className="text-gray-600 hover:text-gray-800"
        >
          <FiArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{requirement.title}</h1>
          {requirement.user && (
            <p className="text-sm text-gray-500">
              Chat with {requirement.user.fullName}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Customer asked price</p>
          <p>
            INR {requirement.expectedPriceMin ?? "-"} - INR {requirement.expectedPriceMax ?? "-"}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">Customer travel details</p>
          <p>
            {requirement.checkIn ? new Date(requirement.checkIn).toLocaleDateString() : "-"} to {requirement.checkOut ? new Date(requirement.checkOut).toLocaleDateString() : "-"}
            {requirementDays ? ` (${requirementDays} days)` : ""}
          </p>
          <p>
            Guests: {requirement.numberOfGuests !== null && requirement.numberOfGuests !== undefined ? requirement.numberOfGuests : "-"}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
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
                      ? "bg-green-500 text-white"
                      : "bg-white text-gray-800 shadow-md"
                  }`}
                >
                  <p className="text-sm font-semibold mb-1">
                    {msg.sender.fullName}
                  </p>
                  <p>{msg.message}</p>
                  {(msg.kind === "price_offer" || msg.kind === "price_counter") && msg.priceAmount ? (
                    <p className={`text-sm mt-1 font-semibold ${isMe ? "text-green-100" : "text-gray-700"}`}>
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
                      className={`text-sm mt-1 underline break-all ${isMe ? "text-green-100" : "text-blue-700"}`}
                    >
                      {msg.linkUrl}
                    </a>
                  ) : null}
                  <p
                    className={`text-xs mt-1 ${
                      isMe ? "text-green-100" : "text-gray-500"
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
      <div className="bg-white border-t px-6 py-4 max-h-[280px] overflow-y-auto">
        {priceLocked ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Confirmed price locked at INR {latestConfirmedPrice}. New offers/counters are disabled.
          </div>
        ) : null}

        <p className="text-sm text-gray-600 mb-2">Quick messages</p>
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {Object.values(REQUIREMENT_CHAT_PRESETS_VENDOR).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSendMessage(preset)}
              disabled={sending}
              className="shrink-0 rounded-full border border-green-200 px-3 py-1 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            min={0}
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            placeholder="Your offer (INR)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={sending || priceLocked}
          />
          <button
            type="button"
            onClick={handleSendOffer}
            disabled={sending || !offerPrice.trim() || priceLocked}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Send Offer
          </button>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="Google Drive link"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={sending}
          />
          <button
            type="button"
            onClick={handleSendDriveLink}
            disabled={sending || !driveLink.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Share Drive Link
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type Conversation = {
  requirementId: string;
  vendorId: string;
  customerId: string;
  requirementTitle: string;
  vendorName: string;
  vendorEmail?: string;
  customerName: string;
  customerEmail?: string;
  lastMessage: string;
  lastKind?: string;
  lastPriceAmount?: number | null;
  lastCreatedAt?: string;
  totalMessages: number;
};

type ChatMessage = {
  _id: string;
  message: string;
  kind?: string;
  priceAmount?: number | null;
  sender: {
    _id: string;
    fullName?: string;
    accountType?: "user" | "vendor" | "admin";
  };
  receiver: {
    _id: string;
    fullName?: string;
    accountType?: "user" | "vendor" | "admin";
  };
  createdAt: string;
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKey = useMemo(() => {
    if (!selected) return "";
    return `${selected.requirementId}_${selected.vendorId}_${selected.customerId}`;
  }, [selected]);

  const loadConversations = async () => {
    try {
      setLoadingList(true);
      setError(null);
      const res = await fetch("/api/admin/chats", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load conversations");
      }

      const rows: Conversation[] = data.conversations || [];
      setConversations(rows);
      if (!rows.length) {
        setSelected(null);
        setMessages([]);
        return;
      }

      setSelected((prev) => {
        if (!prev) return rows[0];
        const exists = rows.find(
          (row) =>
            row.requirementId === prev.requirementId &&
            row.vendorId === prev.vendorId &&
            row.customerId === prev.customerId
        );
        return exists || rows[0];
      });
    } catch (err: any) {
      setError(err?.message || "Unable to load chat conversations");
    } finally {
      setLoadingList(false);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      setLoadingMessages(true);
      const query = new URLSearchParams({
        requirementId: conversation.requirementId,
        vendorId: conversation.vendorId,
        customerId: conversation.customerId,
      });
      const res = await fetch(`/api/admin/chats/messages?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load messages");
      }
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err?.message || "Unable to load chat messages");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selected) {
      loadMessages(selected);
    }
  }, [selectedKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Chat Monitor</h1>
          <p className="text-sm text-gray-600">
            View of vendor and customer conversations for requirement deals.
          </p>
        </div>
        <button
          type="button"
          onClick={loadConversations}
          className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-3 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Conversations
          </h2>

          {loadingList ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No vendor-customer chats found.</div>
          ) : (
            <div className="space-y-2">
              {conversations.map((row) => {
                const key = `${row.requirementId}_${row.vendorId}_${row.customerId}`;
                const active = key === selectedKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(row)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      active ? "border-green-300 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-gray-900">{row.requirementTitle}</p>
                    <p className="mt-1 text-xs text-gray-600">Vendor: {row.vendorName}</p>
                    <p className="text-xs text-gray-600">Customer: {row.customerName}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">{row.lastMessage}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {formatDateTime(row.lastCreatedAt)} • {row.totalMessages} messages
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:col-span-2">
          {!selected ? (
            <div className="py-16 text-center text-sm text-gray-500">Select a conversation to view messages.</div>
          ) : (
            <>
              <div className="mb-3 border-b border-gray-100 pb-3">
                <p className="text-lg font-semibold text-gray-900">{selected.requirementTitle}</p>
                <p className="text-xs text-gray-600">Vendor: {selected.vendorName} • Customer: {selected.customerName}</p>
              </div>

              {loadingMessages ? (
                <div className="py-16 text-center text-sm text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-500">No messages in this conversation.</div>
              ) : (
                <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                  {messages.map((msg) => {
                    const senderName = msg.sender?.fullName || "Unknown";
                    const senderRole = msg.sender?.accountType || "-";
                    return (
                      <div key={msg._id} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {senderName} <span className="text-xs font-normal text-gray-500">({senderRole})</span>
                          </p>
                          <p className="text-xs text-gray-400">{formatDateTime(msg.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-sm text-gray-800">{msg.message}</p>
                        {msg.kind && msg.kind !== "preset" && (
                          <p className="mt-1 text-xs text-gray-500">Type: {msg.kind}</p>
                        )}
                        {typeof msg.priceAmount === "number" && (
                          <p className="mt-1 text-xs font-semibold text-sky-700">Amount: INR {msg.priceAmount}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Message = {
  _id: string;
  message: string;
  sender: any;
  receiver: any;
  createdAt: string;
};

type SocketContextType = {
  sendMessage: (requirementId: string, receiverId: string, message: string) => void;
  messages: Message[];
  connected: boolean;
};

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected] = useState(true); // For now, always connected (using polling)

  const sendMessage = useCallback(async (requirementId: string, receiverId: string, message: string) => {
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requirementId,
          receiverId,
          message,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (error) {
      console.error("Failed to send message", error);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ sendMessage, messages, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}

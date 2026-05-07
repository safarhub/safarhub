"use client";
// app/components/loyalty/NavbarAvatarWithLoyalty.tsx
// ✅ DROP-IN REPLACEMENT: Use this wherever your existing avatar/initial circle is in Navbar.tsx

import Image from "next/image";
import LoyaltyHoverCard from "./LoyaltyHoverCard";

interface NavbarAvatarWithLoyaltyProps {
  user: {
    fullName?: string;
    avatar?: string;
    accountType?: string;
  } | null;
  onClick?: () => void;
}

export default function NavbarAvatarWithLoyalty({ user, onClick }: NavbarAvatarWithLoyaltyProps) {
  if (!user) return null;

  const initial = user.fullName?.trim().charAt(0).toUpperCase() ?? "U";

  return (
    <LoyaltyHoverCard>
      <button
        onClick={onClick}
        className="relative focus:outline-none group"
        aria-label="User menu"
      >
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt="Avatar"
            width={40}
            height={40}
            className="w-10 h-10 rounded-full border-2 border-green-400 group-hover:border-green-300 transition-all object-cover"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full border-2 border-green-400 group-hover:border-green-300 transition-all flex items-center justify-center text-white font-bold text-sm select-none"
            style={{
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
            }}
          >
            {initial}
          </div>
        )}
        {/* Pulse ring to hint hover interactivity */}
        <span className="absolute -inset-0.5 rounded-full ring-2 ring-green-400/0 group-hover:ring-green-400/40 transition-all duration-300" />
      </button>
    </LoyaltyHoverCard>
  );
}
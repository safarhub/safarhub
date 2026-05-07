import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Login - SafarHub",
  description: "Login to your SafarHub account.",
  alternates: {
    canonical: "https://www.safarhub.in/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

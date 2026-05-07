import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign Up - SafarHub",
  description: "Create your SafarHub account.",
  alternates: {
    canonical: "https://www.safarhub.in/signup",
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

"use client";

import Navbar from "./components/Pages/hf/Navbar";
import Footer from "./components/Pages/hf/Footer";
import { usePathname } from "next/navigation";

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVendorRoute = pathname.startsWith("/vendor");

  return (
    <main className="flex min-h-screen flex-col bg-sky-50">
      <Navbar />
      <div className="flex-1">{children}</div>
      {!isVendorRoute && <Footer />}
    </main>  
  );
}

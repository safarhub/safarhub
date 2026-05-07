"use client";

import { Toaster } from "react-hot-toast";
import { CookieConsent } from "./components/CookieConsent";

export default function Providers() {
  return (
    <>
      <Toaster position="bottom-right" reverseOrder={false} />
      <CookieConsent />
    </>
  );
}

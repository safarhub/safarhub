import type { Metadata } from "next";
import { Geist, Roboto_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import SiteFrame from "./SiteFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.safarhub.in"),
  title: "Best Travel Website in Kolkata with smart travel solutions | Safarhub",
  description: "Looking for smart travel solutions in Kolkata? Safarhub offers expert guidance, great deals on hotels, and personalized travel packages for a seamless journey.",
  alternates: {
    canonical: "https://www.safarhub.in",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <Script id="gtm-datalayer" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              'gtm.start': new Date().getTime(),
              event: 'gtm.js'
            });
          `}
        </Script>
        <Script
          id="gtm-loader"
          src="https://www.googletagmanager.com/gtm.js?id=GTM-PFJP4ZCD"
          strategy="afterInteractive"
        />
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PFJP4ZCD"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {recaptchaSiteKey ? (
          <Script
            id="recaptcha-loader"
            src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`}
            strategy="afterInteractive"
          />
        ) : null}
        <Providers />
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ready to grow your travel business join us now",
  description:
    "Grow your travel business with Safarhub and unlock new opportunities to reach more customers, increase bookings, and grow your revenue today.",
  alternates: {
    canonical: "https://www.safarhub.in/safar-partner",
  },
};

export default function SafarPartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

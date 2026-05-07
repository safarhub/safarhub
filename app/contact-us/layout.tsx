import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact us for travel support and assistance at SafarHub",
  description:
    "Need travel help? Contact SafarHub for fast and friendly support to make your booking and travel experience smooth and stress-free.",
  alternates: {
    canonical: "https://www.safarhub.in/contact-us",
  },
};

export default function ContactUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover how SafarHub is transforming the way people travel.",
  description:
    "Discover how SafarHub is transforming travel with fast, easy, and user-friendly booking solutions for every traveler. Book now !",
  alternates: {
    canonical: "https://www.safarhub.in/about-us",
  },
};

export default function AboutUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

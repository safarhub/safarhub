import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check out travel tips and updates on the SafarHub",
  description:
    "Explore simple travel tips, ideas, and updates from SafarHub to help you plan better trips and make smarter travel decisions.",
  alternates: {
    canonical: "https://www.safarhub.in/blogs",
  },
};

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import { Metadata } from "next";
import StaysExplorer from "../../stays/StaysExplorer";

export const metadata: Metadata = {
  title: "Find the Perfect Stay for Every Trip & Budget | SafarHub",
  description:
    "Find the perfect stays that suit your comfort, style, and budget. Book your stay with ease and enjoy a smooth, relaxing travel experience today.",
  alternates: {
    canonical: "https://www.safarhub.in/services/stays",
  },
};

export default function ServicesStaysPage() {
  return <StaysExplorer />;
}

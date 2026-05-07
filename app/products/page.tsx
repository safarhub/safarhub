import ProductsExplorer from "./ProductsExplorer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Travel Products & Accessories Online at SafarHub",
  description:
    "Buy travel accessories on SafarHub to make your journeys simple, comfortable, and well organized with useful essentials for every traveler.",
  alternates: {
    canonical: "https://www.safarhub.in/products",
  },
};

export default function ProductsPage() {
  return <ProductsExplorer />;
}


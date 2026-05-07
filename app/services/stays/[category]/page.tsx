import { Metadata } from "next";
import StaysExplorer from "../../../stays/StaysExplorer";
import { STAY_CATEGORIES } from "../../../stays/categories";

const VALID_CATEGORIES = STAY_CATEGORIES.map((tab) => tab.value);

const SEO_BY_CATEGORY: Record<string, { title: string; description: string; canonical: string }> = {
  all: {
    title: "Find the Perfect Stay for Every Trip & Budget | SafarHub",
    description:
      "Find the perfect stays that suit your comfort, style, and budget. Book your stay with ease and enjoy a smooth, relaxing travel experience today.",
    canonical: "https://www.safarhub.in/services/stays",
  },
  rooms: {
    title: "Book Comfortable Rooms at Affordable Prices | SafarHub",
    description:
      "Looking for the right room SafarHub helps you find comfortable stays at the best prices so you can relax and enjoy your trip without stress.",
    canonical: "https://www.safarhub.in/services/rooms",
  },
  homestays: {
    title: "Book Homestays for a Relaxed & Homely Experience | SafarHub",
    description:
      "Enjoy a relaxed homely stay with SafarHub. Book homestays that offer comfort, privacy, and a warm welcoming experience.",
    canonical: "https://www.safarhub.in/services/homestays",
  },
  bnbs: {
    title: "Book Premium BnBs for Memorable Hospitality & Comfort | SafarHub",
    description:
      "Book premium BnBs with SafarHub and enjoy memorable hospitality, cozy comfort, and unique stays designed for a relaxing travel experience.",
    canonical: "https://www.safarhub.in/services/bnbs",
  },
  hotels: {
    title: "Find The Best And Affordable Hotels With Top Service | Safarhub",
    description:
      "Find the best budget-friendly hotels with excellent service. SafarHub lets you book comfortable stays easily at great prices for a perfect trip experience.",
    canonical: "https://www.safarhub.in/services/hotels",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const category = VALID_CATEGORIES.includes(resolvedParams.category as any) ? resolvedParams.category : "all";
  const seo = SEO_BY_CATEGORY[category] ?? SEO_BY_CATEGORY.all;

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonical,
    },
  };
}

export default async function ServicesStaysCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = await params;
  const category = VALID_CATEGORIES.includes(resolvedParams.category as any) ? resolvedParams.category : "all";
  return <StaysExplorer initialCategory={category} />;
}

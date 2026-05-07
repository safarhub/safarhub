import { Metadata } from "next";
import AdventuresExplorer from "../../../adventures/AdventuresExplorer";
import { ADVENTURE_CATEGORIES } from "../../../adventures/categories";
import type { AdventureCategoryValue } from "../../../adventures/categories";

const VALID_CATEGORIES = ADVENTURE_CATEGORIES.map((tab) => tab.value);

const SEO_BY_CATEGORY: Record<string, { title: string; description: string; canonical: string }> = {
  all: {
    title: "Explore Top Adventure Activities & Experiences | Safarhub",
    description:
      "Plan your next adventure with Safarhub and explore activities like trekking and rafting for a fun and memorable travel experience.",
    canonical: "https://www.safarhub.in/services/adventures",
  },
  trekking: {
    title: "Get the Best Mountain Trekking Tours with Experts | Safarhub",
    description:
      "Explore top mountain trekking tours led by experts. SafarHub offers guided adventures with stunning views, safety, and seamless planning.",
    canonical: "https://www.safarhub.in/services/trekking",
  },
  hiking: {
    title: "Start Your Hiking Adventure into Scenic Mountains | Safarhub",
    description:
      "Discover nature with Safarhub hiking trails and enjoy scenic mountain views, fresh air, and a truly relaxing outdoor experience away from the city hustle.",
    canonical: "https://www.safarhub.in/services/hiking",
  },
  camping: {
    title: "Escape the city with peaceful camping experiences | Safarhub",
    description:
      "Book your outdoor camping adventure with SafarHub and enjoy peaceful nights under the stars, surrounded by nature, with complete comfort, safety, & a memorable experience.",
    canonical: "https://www.safarhub.in/services/camping",
  },
  others: {
    title: "Experience the Thrill of Water Rafting Adventures | Safarhub",
    description:
      "Enjoy exciting water rafting adventures with SafarHub and experience the perfect mix of thrill, fun, and unforgettable outdoor moments.",
    canonical: "https://www.safarhub.in/services/others",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ category: AdventureCategoryValue }> }): Promise<Metadata> {
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

export default async function ServicesAdventuresCategoryPage({ params }: { params: Promise<{ category: AdventureCategoryValue }> }) {
  const resolvedParams = await params;
  const category = VALID_CATEGORIES.includes(resolvedParams.category as any) ? resolvedParams.category : "all";
  return <AdventuresExplorer initialCategory={category} />;
}



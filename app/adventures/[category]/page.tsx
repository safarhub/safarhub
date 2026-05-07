import AdventuresExplorer from "../AdventuresExplorer";
import { ADVENTURE_CATEGORIES } from "../categories";
import type { AdventureCategoryValue } from "../categories";
import { notFound } from "next/navigation";
import { Metadata } from "next";

type CategoryPageProps = {
  params: Promise<{
    category: AdventureCategoryValue;
  }>;
};

const VALID_CATEGORIES = ADVENTURE_CATEGORIES.map(
  (cat) => cat.value
);

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Adventures",
  trekking: "Trekking",
  hiking: "Hiking",
  camping: "Camping",
  others: "Others",
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Explore Top Adventure Activities & Experiences | Safarhub",
    trekking: "Get the Best Mountain Trekking Tours with Experts | Safarhub",
    hiking: "Start Your Hiking Adventure into Scenic Mountains | Safarhub",
    camping: "Escape the city with peaceful camping experiences | Safarhub",
    others: "Others - SafarHub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Plan your next adventure with Safarhub and explore activities like trekking and rafting for a fun and memorable travel experience. ",
    trekking: "Explore top mountain trekking tours led by experts. SafarHub offers guided adventures with stunning views, safety, and seamless planning.",
    hiking: "Discover nature with Safarhub hiking trails and enjoy scenic mountain views, fresh air, and a truly relaxing outdoor experience away from the city hustle.",
    camping: "Book your outdoor camping adventure with SafarHub and enjoy peaceful nights under the stars, surrounded by nature, with complete comfort, safety, & a memorable experience.",
    others: "Discover many other adventure experiences.",
  };
  
  const title = categoryLabels[category] || "Adventures - SafarHub";
  const description = categoryDescriptions[category] || "Experience thrilling adventures.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/adventures/${category}`,
    },
  };
}

function generateBreadcrumbSchema(category: string) {
  if (category === "all") {
    return {
      "@context": "https://schema.org/",
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "Safar Hub",
        "item": "https://www.safarhub.in/"
      },{
        "@type": "ListItem",
        "position": 2,
        "name": "Services",
        "item": "https://www.safarhub.in/services"
      },{
        "@type": "ListItem",
        "position": 3,
        "name": "Adventures",
        "item": "https://www.safarhub.in/adventures"
      }]
    };
  }

  const categoryName = categoryBreadcrumbNames[category] || category;
  return {
    "@context": "https://schema.org/",
    "@type": "BreadcrumbList",
    "itemListElement": [{
      "@type": "ListItem",
      "position": 1,
      "name": "Safar Hub",
      "item": "https://www.safarhub.in/"
    },{
      "@type": "ListItem",
      "position": 2,
      "name": "Services",
      "item": "https://www.safarhub.in/services"
    },{
      "@type": "ListItem",
      "position": 3,
      "name": "Adventures",
      "item": "https://www.safarhub.in/adventures"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/adventures/${category}`
    }]
  };
}

export async function generateStaticParams() {
  return ADVENTURE_CATEGORIES.map((cat) => ({
    category: cat.value,
  }));
}

export default async function AdventureCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  // If it looks like a MongoDB ID (24 hex chars), this route shouldn't match
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(category);
  
  // ❌ If category is invalid → 404
  if (isMongoId || !VALID_CATEGORIES.includes(category)) {
    notFound();
  }

  const breadcrumbSchema = generateBreadcrumbSchema(category);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <AdventuresExplorer initialCategory={category} />
    </>
  );
}

//stays/[category]/page.tsx
import { notFound } from "next/navigation";
import StaysExplorer from "../StaysExplorer";
import { STAY_CATEGORIES } from "../categories";
import { Metadata } from "next";

type StaysCategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Stays",
  rooms: "Rooms",
  hotels: "Hotels",
  homestays: "Homestays",
  bnbs: "BnBs",
};

export async function generateMetadata({ params }: StaysCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Find the Perfect Stay for Every Trip & Budget | SafarHub",
    rooms: "Book Comfortable Rooms at Affordable Prices | SafarHub",
    hotels: "Find The Best And Affordable Hotels With Top Service | Safarhub",
    homestays: "Book Homestays for a Relaxed & Homely Experience | SafarHub",
    bnbs: "Book Premium BnBs for Memorable Hospitality & Comfort | SafarHub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Find the perfect stays that suit your comfort, style, and budget. Book your stay with ease and enjoy a smooth, relaxing travel experience today.",
    rooms: "Looking for the right room SafarHub helps you find comfortable stays at the best prices so you can relax and enjoy your trip without stress.",
    hotels: "Find the best budget-friendly hotels with excellent service. SafarHub lets you book comfortable stays easily at great prices for a perfect trip experience.",
    homestays: "Enjoy a relaxed homely stay with SafarHub. Book homestays that offer comfort, privacy, and a warm welcoming experience.",
    bnbs: "Book premium BnBs with SafarHub and enjoy memorable hospitality, cozy comfort, and unique stays designed for a relaxing travel experience.",
  };
  
  const title = categoryLabels[category] || "Stays - SafarHub";
  const description = categoryDescriptions[category] || "Find the perfect accommodation for your travel.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/stays/${category}`,
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
        "name": "Stays",
        "item": "https://www.safarhub.in/stays"
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
      "name": "Stays",
      "item": "https://www.safarhub.in/stays"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/stays/${category}`
    }]
  };
}

// This prevents Next.js from matching MongoDB ObjectId patterns
export async function generateStaticParams() {
  return STAY_CATEGORIES.map((cat) => ({
    category: cat.value,
  }));
}

export default async function StaysCategoryPage({ params }: StaysCategoryPageProps) {
  const { category } = await params;
  
  // Check if it's a valid category
  const validCategories = STAY_CATEGORIES.map(c => c.value);
  const isValidCategory = validCategories.includes(category as typeof validCategories[number]);
  
  // If it looks like a MongoDB ID (24 hex chars), this route shouldn't match
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(category);
  
  if (isMongoId || !isValidCategory) {
    notFound();
  }
  
  const breadcrumbSchema = generateBreadcrumbSchema(category);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <StaysExplorer initialCategory={category} />
    </>
  );
}

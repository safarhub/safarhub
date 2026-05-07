//tours/[category]/page.tsx
import { notFound } from "next/navigation";
import ToursExplorer from "../ToursExplorer";
import { TOUR_CATEGORIES } from "../categories";
import { Metadata } from "next";

type ToursCategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Tours",
  "group-tours": "Group Tours",
  "tour-packages": "Tour Packages",
};

export async function generateMetadata({ params }: ToursCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Explore Well-Planned Tours for Smooth Travel Experiences | SafarHub",
    "group-tours": "Enjoy Group Tours with Fun & Memorable Journeys | Safarhub",
    "tour-packages": "Get All-In-One Tour Packages with Stays & Tours | Safarhub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Discover well-planned tours designed for hassle-free travel. SafarHub offers smooth itineraries, expert support, and memorable travel experiences.",
    "group-tours": "Explore the world through group tours with SafarHub. Travel in groups, enjoy fun activities, and create unforgettable memories together.",
    "tour-packages": "Find affordable tour packages with SafarHub. Enjoy complete travel experiences with stays, transport, guided tours, and smooth planning for memorable journeys.",
  };
  
  const title = categoryLabels[category] || "Tours - SafarHub";
  const description = categoryDescriptions[category] || "Discover curated tours and travel packages.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/tours/${category}`,
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
        "name": "Tours",
        "item": "https://www.safarhub.in/tours"
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
      "name": "Tours",
      "item": "https://www.safarhub.in/tours"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/tours/${category}`
    }]
  };
}

// Generate static params for all valid categories
export async function generateStaticParams() {
  return TOUR_CATEGORIES.map((cat) => ({
    category: cat.value,
  }));
}

export default async function ToursCategoryPage({ params }: ToursCategoryPageProps) {
  const { category } = await params;
  
  // Check if it's a valid category
  const validCategories = TOUR_CATEGORIES.map(c => c.value);
  const isValidCategory = validCategories.includes(category as typeof validCategories[number]);
  
  // a MongoDB ID If it looks like (24 hex chars), this route shouldn't match
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
      <ToursExplorer initialCategory={category} />
    </>
  );
}

import { notFound } from "next/navigation";
import { Metadata } from "next";
import ToursExplorer from "../../../tours/ToursExplorer";
import { TOUR_CATEGORIES } from "../../../tours/categories";

type ServicesToursCategoryPageProps = {
  params: Promise<{ category: string }>;
};

const SEO_BY_CATEGORY: Record<string, { title: string; description: string; canonical: string }> = {
  all: {
    title: "Explore Well-Planned Tours for Smooth Travel Experiences | SafarHub",
    description:
      "Discover well-planned tours designed for hassle-free travel. SafarHub offers smooth itineraries, expert support, and memorable travel experiences.",
    canonical: "https://www.safarhub.in/services/tours",
  },
  "group-tours": {
    title: "Enjoy Group Tours with Fun & Memorable Journeys | Safarhub",
    description:
      "Explore the world through group tours with SafarHub. Travel in groups, enjoy fun activities, and create unforgettable memories together.",
    canonical: "https://www.safarhub.in/services/group-tours",
  },
  "tour-packages": {
    title: "Get All-In-One Tour Packages with Stays & Tours | Safarhub",
    description:
      "Find affordable tour packages with SafarHub. Enjoy complete travel experiences with stays, transport, guided tours, and smooth planning for memorable journeys.",
    canonical: "https://www.safarhub.in/services/tour-packages",
  },
};

export async function generateMetadata({ params }: ServicesToursCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const seo = SEO_BY_CATEGORY[category] ?? SEO_BY_CATEGORY.all;

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonical,
    },
  };
}

export async function generateStaticParams() {
  return TOUR_CATEGORIES.map((cat) => ({ category: cat.value }));
}

export default async function ServicesToursCategoryPage({ params }: ServicesToursCategoryPageProps) {
  const { category } = await params;

  const isValidCategory = TOUR_CATEGORIES.map((c) => c.value).includes(category as any);
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(category);

  if (isMongoId || !isValidCategory) {
    notFound();
  }

  return <ToursExplorer initialCategory={category} />;
}



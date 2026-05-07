import { Metadata } from "next";
import VehiclerentalExplorer from "../../../vehicle-rental/vehiclerentalExplorer";
import {
  VEHICLE_RENTAL_CATEGORIES,
  VEHICLE_RENTAL_SLUG_TO_VALUE,
} from "../../../vehicle-rental/categories";

const DEFAULT_CATEGORY = VEHICLE_RENTAL_CATEGORIES[0]?.value ?? "all";

const SEO_BY_SLUG: Record<string, { title: string; description: string; canonical: string }> = {
  all: {
    title: "Easy Car and Bike Rentals for Hassle Free Travel | Safarhub",
    description:
      "Enjoy hassle-free travel with SafarHub car and bike rentals designed for easy booking, comfort, and complete travel freedom. Book Now!",
    canonical: "https://www.safarhub.in/services/vehicle-rental",
  },
  cars: {
    title: "Get a Rental car for Smooth City Travel | Safarhub",
    description:
      "Book rental car with SafarHub and enjoy safe, convenient, and comfortable travel with full control over your journey anytime, anywhere. Book Now!",
    canonical: "https://www.safarhub.in/services/rental-car",
  },
  bikes: {
    title: "Get a Rental Bike for Hassle Free City Rides | Safarhub",
    description:
      "Book a rental bike with SafarHub and enjoy smooth, convenient, and hassle-free city rides with complete freedom to explore at your own pace.",
    canonical: "https://www.safarhub.in/services/rental-bike",
  },
  "car-with-driver": {
    title: "Hire Professional Driver for a Comfortable Journey | Safarhub",
    description:
      "Enjoy a smooth and comfortable journey with a professional driver from SafarHub for safe, reliable, and convenient travel every time. Book now !",
    canonical: "https://www.safarhub.in/services/car-with-driver",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const seo = SEO_BY_SLUG[slug] ?? SEO_BY_SLUG.all;

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonical,
    },
  };
}

export function generateStaticParams() {
  return VEHICLE_RENTAL_CATEGORIES.map((item) => ({ category: item.slug }));
}

export default async function ServicesVehicleRentalCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = VEHICLE_RENTAL_SLUG_TO_VALUE[slug] ?? DEFAULT_CATEGORY;
  return <VehiclerentalExplorer key={category} initialCategory={category} />;
}



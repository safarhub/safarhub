import VehiclerentalExplorer from "../vehiclerentalExplorer";
import { VEHICLE_RENTAL_CATEGORIES, VEHICLE_RENTAL_SLUG_TO_VALUE } from "../categories";
import { Metadata } from "next";

type VehicleRentalCategoryPageProps = {
  params: Promise<{ category: string }>;
};

const categoryBreadcrumbNames: Record<string, string> = {
  all: "Vehicle Rental",
  cars: "Cars",
  bikes: "Bikes",
  "car-with-driver": "Car with Driver",
};

export async function generateMetadata({ params }: VehicleRentalCategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  
  const categoryLabels: Record<string, string> = {
    all: "Easy Car and Bike Rentals for Hassle Free Travel | Safarhub",
    cars: "Get a Rental car for Smooth City Travel | Safarhub",
    bikes: "Get a Rental Bike for Hassle Free City Rides | Safarhub",
    "car-with-driver": "Hire Professional Driver for a Comfortable Journey | Safarhub",
  };
  
  const categoryDescriptions: Record<string, string> = {
    all: "Enjoy hassle-free travel with SafarHub car and bike rentals designed for easy booking, comfort, and complete travel freedom. Book Now!",
    cars: "Book rental car with SafarHub and enjoy safe, convenient, and comfortable travel with full control over your journey anytime, anywhere. Book Now!",
    bikes: "Book a rental bike with SafarHub and enjoy smooth, convenient, and hassle-free city rides with complete freedom to explore at your own pace.",
    "car-with-driver": "Enjoy a smooth and comfortable journey with a professional driver from SafarHub for safe, reliable, and convenient travel every time. Book now !",
  };
  
  const title = categoryLabels[slug] || "Vehicle Rental - SafarHub";
  const description = categoryDescriptions[slug] || "Rent vehicles for your travel needs.";
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://www.safarhub.in/vehicle-rental/${slug}`,
    },
  };
}

function generateBreadcrumbSchema(slug: string) {
  if (slug === "all") {
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
        "name": "Vehicle Rental",
        "item": "https://www.safarhub.in/vehicle-rental"
      }]
    };
  }

  const categoryName = categoryBreadcrumbNames[slug] || slug;
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
      "name": "Vehicle Rental",
      "item": "https://www.safarhub.in/vehicle-rental"
    },{
      "@type": "ListItem",
      "position": 4,
      "name": categoryName,
      "item": `https://www.safarhub.in/vehicle-rental/${slug}`
    }]
  };
}

const DEFAULT_CATEGORY = VEHICLE_RENTAL_CATEGORIES[0]?.value ?? "all";

export function generateStaticParams() {
  return VEHICLE_RENTAL_CATEGORIES.map((item) => ({ category: item.slug }));
}

export default async function VehicleRentalCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = VEHICLE_RENTAL_SLUG_TO_VALUE[slug] ?? DEFAULT_CATEGORY;
  
  const breadcrumbSchema = generateBreadcrumbSchema(slug);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <VehiclerentalExplorer key={category} initialCategory={category} />
    </>
  );
}

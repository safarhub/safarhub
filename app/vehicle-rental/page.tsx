// app/vehicle-rental/page.tsx
import VehicleRentalExplorer from "./vehiclerentalExplorer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Easy Car and Bike Rentals for Hassle Free Travel | Safarhub",
  description: "Enjoy hassle-free travel with SafarHub car and bike rentals designed for easy booking, comfort, and complete travel freedom. Book Now!",
  alternates: {
    canonical: "https://www.safarhub.in/vehicle-rental",
  },
};

const breadcrumbSchema = {
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

type VehicleRentalHomePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
  }>;
};

export default async function VehicleRentalHomePage({
  searchParams,
}: VehicleRentalHomePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialCategory =
    typeof resolvedParams?.category === "string" ? resolvedParams.category : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <VehicleRentalExplorer initialCategory={initialCategory} />
    </>
  );
}
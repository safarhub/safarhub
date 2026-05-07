import Image from "next/image";
import HeroSection from "./components/Pages/home/Hero";
import TourCategories from "./components/Pages/home/Categories";
import PopularTour from "./components/Pages/home/PropularTour";
import Opertunity from "./components/Pages/home/Oppertunity";
import Stats from "./components/Pages/home/Stats"
import OffersSection from "./components/Pages/home/OffersSection";
import TestimonialSection from "./components/Pages/home/Testimonial";
import dbConnect from "@/lib/config/database";
import RecentGallerySection from "./components/Pages/home/RecentGallery";
import TravelHeroSection from "./components/Pages/home/TravelHero";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best Travel Website in Kolkata with smart travel solutions | Safarhub",
  description: "Looking for smart travel solutions in Kolkata? Safarhub offers expert guidance, great deals on hotels, and personalized travel packages for a seamless journey.",
  alternates: {
    canonical: "https://www.safarhub.in",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Safar Hub",
  "url": "https://www.safarhub.in/",
  "logo": "https://www.safarhub.in/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.084a26e7.png&w=128&q=75",
  "sameAs": [
    "https://www.instagram.com/safarhub1",
    "https://www.facebook.com/profile.php?id=61583838720082",
    "https://www.linkedin.com/company/safar-hub/"

  ],
  "contactPoint": [{
    "@type": "ContactPoint",
    "telephone": "+91 8240519110",
    "contactType": "customer service",
    "email": "safarhub1@gmail.com",
    "availableLanguage": ["en", "hi", "bn"]
  }]
};

const travelAgencySchema = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "name": "Safar Hub",
  "image": "https://www.safarhub.in/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.084a26e7.png&w=128&q=75",
  "@id": "https://www.safarhub.in/",
  "url": "https://www.safarhub.in/",
  "telephone": "+91 8240519110",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Krishna Chatterjee Lane, Bally",
    "addressLocality": "Howrah, West Bengal",
    "postalCode": "711201",
    "addressCountry": "IN"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "opens": "00:00",
    "closes": "23:59"
  },
  "sameAs": [
    "https://www.instagram.com/safarhub1",
    "https://www.facebook.com/profile.php?id=61583838720082",
    "https://www.linkedin.com/company/safar-hub/"
  ]
};

export default async function Home() {
  // Initialize database connection on page load
  await dbConnect();
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(travelAgencySchema) }}
      />
      <div className="w-full bg-sky-50 overflow-x-hidden ">
     <HeroSection/>
     <TourCategories/>
     <PopularTour/>
     <Opertunity/>
     <Stats/>
     <OffersSection/>
     <TestimonialSection/>

     <RecentGallerySection/>
     <TravelHeroSection/>
    </div>
    </>
  );
}

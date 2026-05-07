//stays/page.tsx
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stays - SafarHub",
  description: "Find the perfect accommodation for your travel - rooms, homestays, BnBs, and hotels.",
  alternates: {
    canonical: "https://www.safarhub.in/stays",
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
    "name": "Stays",
    "item": "https://www.safarhub.in/stays"
  }]
};

type StaysPageProps = {
  searchParams?: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function StaysPage({ searchParams }: StaysPageProps) {
  // Since this page redirects, we'll add the schema in a client component wrapper
  // For now, the breadcrumb is handled by the destination page (/stays/all)
  const resolvedParams = searchParams ? await searchParams : undefined;
  
  // Build query string if there are any search params
  const params = new URLSearchParams();
  if (resolvedParams) {
    Object.entries(resolvedParams).forEach(([key, value]) => {
      if (value !== undefined) {
        const stringValue = Array.isArray(value) ? value[0] : value;
        params.set(key, stringValue);
      }
    });
  }
  
  const queryString = params.toString();
  const redirectPath = queryString ? `/stays/all?${queryString}` : "/stays/all";
  
  redirect(redirectPath);
}

import { Metadata } from "next";
import AdventuresExplorer from "../../adventures/AdventuresExplorer";

export const metadata: Metadata = {
  title: "Explore Top Adventure Activities & Experiences | Safarhub",
  description:
    "Plan your next adventure with Safarhub and explore activities like trekking and rafting for a fun and memorable travel experience.",
  alternates: {
    canonical: "https://www.safarhub.in/services/adventures",
  },
};

export default function ServicesStaysPage() {
  return <AdventuresExplorer />;
}

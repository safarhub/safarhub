import { Metadata } from "next";
import ToursExplorer from "../../tours/ToursExplorer";

export const metadata: Metadata = {
  title: "Explore Well-Planned Tours for Smooth Travel Experiences | SafarHub",
  description:
    "Discover well-planned tours designed for hassle-free travel. SafarHub offers smooth itineraries, expert support, and memorable travel experiences.",
  alternates: {
    canonical: "https://www.safarhub.in/services/tours",
  },
};

export default function ServicesStaysPage() {
  return <ToursExplorer />;
}

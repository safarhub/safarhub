import { Metadata } from "next";
import VehiclerentalExplorer from "../../vehicle-rental/vehiclerentalExplorer";

export const metadata: Metadata = {
  title: "Easy Car and Bike Rentals for Hassle Free Travel | Safarhub",
  description:
    "Enjoy hassle-free travel with SafarHub car and bike rentals designed for easy booking, comfort, and complete travel freedom. Book Now!",
  alternates: {
    canonical: "https://www.safarhub.in/services/vehicle-rental",
  },
};

export default function ServicesStaysPage() {
  return <VehiclerentalExplorer />;
}

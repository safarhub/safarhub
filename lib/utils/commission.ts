export type ListingType = "buy" | "rent";

export type CommissionResult = {
  ratePercent: number;
  amount: number;
  listingPrice: number;
};

const normalizeCategory = (category: string) =>
  String(category || "")
    .toLowerCase()
    .trim();

const isStaySlabCategory = (category: string) => {
  return [
    "hotel",
    "hotels",
    "hostel",
    "hostels",
    "room",
    "rooms",
    "bnb",
    "bnbs",
    "resort",
    "resorts",
    "home-stays",
    "home-stay",
    "homestay",
    "homestays",
  ].includes(category);
};

const round2 = (value: number) => Number(value.toFixed(2));
const roundUpToNearest10 = (value: number) => Math.ceil(value / 10) * 10;

const getSlabRate = (price: number) => {
  if (price >= 500 && price < 2000) return 12;
  if (price >= 2000 && price < 3000) return 8;
  if (price >= 3000) return 2.5;
  return 15;
};

export const getCommissionRatePercent = (
  listingType: ListingType,
  categorySlug: string,
  sellerPrice: number
): number => {
  const normalizedPrice = Number(sellerPrice) || 0;
  if (normalizedPrice <= 0) return 0;

  if (listingType === "rent") {
    return getSlabRate(normalizedPrice);
  }

  const category = normalizeCategory(categorySlug);

  if (isStaySlabCategory(category)) {
    return getSlabRate(normalizedPrice);
  }

  if (category === "package-tour") {
    return normalizedPrice < 5000 ? 22 : 12;
  }

  if (category === "vehicle-rent" || category === "market-place") {
    return 8;
  }

  return 12;
};

export const calculateCommission = (
  listingType: ListingType,
  categorySlug: string,
  sellerPrice: number
): CommissionResult => {
  const normalizedPrice = Number(sellerPrice) || 0;
  if (normalizedPrice <= 0) {
    return { ratePercent: 0, amount: 0, listingPrice: 0 };
  }

  const ratePercent = getCommissionRatePercent(listingType, categorySlug, normalizedPrice);
  const baseCommissionAmount = round2((normalizedPrice * ratePercent) / 100);

  // Platform listing price is rounded up to the next 10 to preserve margin and simplify display pricing.
  const listingPrice = roundUpToNearest10(round2(normalizedPrice + baseCommissionAmount));
  const amount = round2(listingPrice - normalizedPrice);

  return {
    ratePercent,
    amount,
    listingPrice,
  };
};

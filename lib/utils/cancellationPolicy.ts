const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const UNIFIED_CANCELLATION_POLICY_VERSION = "2026-04-unified-v1";

export const UNIFIED_CANCELLATION_POLICY_LINES = [
  "More than 45 days before arrival: Free cancellation (no charges)",
  "45 to 30 days before arrival: 15% of booking amount will be deducted",
  "30 to 7 days before arrival: 35% of booking amount will be deducted",
  "Within 7 days of arrival: 100% of booking amount will be charged (no refund)",
] as const;

export const UNIFIED_CANCELLATION_POLICY_TEXT = UNIFIED_CANCELLATION_POLICY_LINES.join("\n");

export type CancellationPolicyBand =
  | "MORE_THAN_45_DAYS"
  | "FROM_45_TO_30_DAYS"
  | "FROM_30_TO_7_DAYS"
  | "WITHIN_7_DAYS"
  | "ARRIVAL_DATE_UNAVAILABLE";

export type CancellationBreakdown = {
  policyVersion: string;
  policyBand: CancellationPolicyBand;
  policyLabel: string;
  bookingAmount: number;
  arrivalDate: string | null;
  cancelledAt: string;
  daysBeforeArrival: number | null;
  deductionPercent: number;
  deductionAmount: number;
  refundAmount: number;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toStartOfLocalDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const resolveBookingArrivalDate = (booking: {
  checkIn?: Date | string | null;
  startDate?: Date | string | null;
  pickupDate?: Date | string | null;
}) => {
  return toValidDate(booking.checkIn) || toValidDate(booking.startDate) || toValidDate(booking.pickupDate);
};

export const resolveOrderArrivalDate = (order: {
  items?: Array<{
    rentalStartDate?: Date | string | null;
    deliveryDate?: Date | string | null;
  }>;
}) => {
  if (!Array.isArray(order.items)) return null;

  const candidates: Date[] = [];

  for (const item of order.items) {
    const rentalStart = toValidDate(item.rentalStartDate);
    if (rentalStart) {
      candidates.push(rentalStart);
      continue;
    }

    const deliveryDate = toValidDate(item.deliveryDate);
    if (deliveryDate) {
      candidates.push(deliveryDate);
    }
  }

  if (!candidates.length) return null;

  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
};

export const computeUnifiedCancellationBreakdown = (params: {
  bookingAmount: number;
  arrivalDate: Date | null;
  cancelledAt?: Date;
}): CancellationBreakdown => {
  const safeBookingAmount = Math.max(0, Number(params.bookingAmount || 0));
  const cancelledAt = params.cancelledAt ?? new Date();
  const normalizedArrivalDate = params.arrivalDate ? toValidDate(params.arrivalDate) : null;

  if (!normalizedArrivalDate) {
    return {
      policyVersion: UNIFIED_CANCELLATION_POLICY_VERSION,
      policyBand: "ARRIVAL_DATE_UNAVAILABLE",
      policyLabel: "Arrival date unavailable, defaulting to zero deduction",
      bookingAmount: roundMoney(safeBookingAmount),
      arrivalDate: null,
      cancelledAt: cancelledAt.toISOString(),
      daysBeforeArrival: null,
      deductionPercent: 0,
      deductionAmount: 0,
      refundAmount: roundMoney(safeBookingAmount),
    };
  }

  const arrivalDay = toStartOfLocalDay(normalizedArrivalDate);
  const cancellationDay = toStartOfLocalDay(cancelledAt);
  const daysBeforeArrival = Math.floor((arrivalDay.getTime() - cancellationDay.getTime()) / DAY_IN_MS);

  let deductionPercent = 0;
  let policyBand: CancellationPolicyBand = "MORE_THAN_45_DAYS";
  let policyLabel = "Free cancellation";

  if (daysBeforeArrival > 45) {
    deductionPercent = 0;
    policyBand = "MORE_THAN_45_DAYS";
    policyLabel = "More than 45 days before arrival";
  } else if (daysBeforeArrival > 30) {
    deductionPercent = 15;
    policyBand = "FROM_45_TO_30_DAYS";
    policyLabel = "Between 45 and 30 days before arrival";
  } else if (daysBeforeArrival > 7) {
    deductionPercent = 35;
    policyBand = "FROM_30_TO_7_DAYS";
    policyLabel = "Between 30 and 7 days before arrival";
  } else {
    deductionPercent = 100;
    policyBand = "WITHIN_7_DAYS";
    policyLabel = "Within 7 days of arrival";
  }

  const deductionAmount = roundMoney((safeBookingAmount * deductionPercent) / 100);
  const refundAmount = roundMoney(Math.max(0, safeBookingAmount - deductionAmount));

  return {
    policyVersion: UNIFIED_CANCELLATION_POLICY_VERSION,
    policyBand,
    policyLabel,
    bookingAmount: roundMoney(safeBookingAmount),
    arrivalDate: normalizedArrivalDate.toISOString(),
    cancelledAt: cancelledAt.toISOString(),
    daysBeforeArrival,
    deductionPercent,
    deductionAmount,
    refundAmount,
  };
};

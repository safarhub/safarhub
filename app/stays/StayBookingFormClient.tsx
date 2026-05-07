"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaCalendarAlt, FaCheckCircle, FaMapMarkerAlt, FaPhoneAlt, FaTag, FaUsers } from "react-icons/fa";
import type { StayDetailPayload } from "./StayDetailClient";
import { useAvailability } from "../hooks/useAvailability";
import { openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/utils/clientPaymentFlow";

const getDefaultDates = () => {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const toInput = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { checkIn: toInput(today), checkOut: toInput(tomorrow) };
};

const calculateNights = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return 1;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime()) || outDate <= inDate) return 1;
  return Math.max(1, Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));
};

const formatDateDisplay = (value: string) => {
  if (!value) return "";

  // Use deterministic UTC formatting to avoid server/client locale hydration mismatches.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || !month || !day) return value;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value;

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${weekdays[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]}, ${date.getUTCFullYear()}`;
};

// const PLATFORM_FEE = 15;
const PLATFORM_FEE = 0;

type StayBookingFormProps = {
  stay: StayDetailPayload;
  searchParams: Record<string, string | string[] | undefined>;
};

const StayBookingFormClient: React.FC<StayBookingFormProps> = ({ stay, searchParams }) => {
  const router = useRouter();
  const isBnbStay = stay.category === "bnbs" && Boolean(stay.bnb);
  const defaults = useMemo(() => getDefaultDates(), []);

  const checkIn = typeof searchParams.checkIn === "string" ? searchParams.checkIn : defaults.checkIn;
  const checkOut = typeof searchParams.checkOut === "string" ? searchParams.checkOut : defaults.checkOut;

  const adults = Number(searchParams.adults ?? 2) || 2;
  const children = Number(searchParams.children ?? 0) || 0;
  const infants = Number(searchParams.infants ?? 0) || 0;

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut]);

  const parsedRoomParams = useMemo(() => {
    const raw = searchParams.rooms;
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return entries
      .map((entry) => {
        if (typeof entry !== "string") return null;
        const [encodedKey, qty = "1"] = entry.split(":");
        const key = decodeURIComponent(encodedKey);
        const quantity = Number(qty);
        if (!key || !Number.isFinite(quantity) || quantity <= 0) return null;
        return { key, quantity };
      })
      .filter(Boolean) as Array<{ key: string; quantity: number }>;
  }, [searchParams.rooms]);

  const isBnbBooking = isBnbStay && searchParams.bnb === "1";

  const selection = useMemo(() => {
    if (isBnbBooking && stay.bnb) {
      const pseudoRoom: StayDetailPayload["rooms"][number] = {
        _id: undefined,
        name: stay.bnb.unitType || stay.name,
        description: stay.bnb.unitType || "",
        bedType: "BnB Unit",
        beds: stay.bnb.beds || 1,
        capacity: stay.bnb.capacity || adults + children + infants,
        price: stay.bnb.price,
        taxes: 0,
        currency: "INR",
        size: "",
        features: stay.bnb.features || [],
        amenities: stay.bnb.features || [],
        available: 1,
        images: [],
      };
      const subtotal = pseudoRoom.price * nights;
      return {
        mode: "bnb" as const,
        items: [
          {
            key: pseudoRoom.name,
            room: pseudoRoom,
            quantity: 1,
            subtotal,
            taxes: 0,
            index: 0,
          },
        ],
        subtotal,
        taxes: 0,
        totalBeforeFees: subtotal,
        platformFee: 0,
        total: subtotal,
        totalRooms: 1,
      };
    }

    const items = parsedRoomParams
      .map(({ key, quantity }) => {
        const roomIndex = stay.rooms.findIndex(
          (room) => (room._id?.toString() || room.name) === key || room.name === key
        );
        if (roomIndex === -1) return null;
        const room = stay.rooms[roomIndex];
        const safeQuantity = Math.min(quantity, Math.max(1, room.available ?? quantity));
        const subtotal = room.price * safeQuantity * nights;
        const taxes = (room.taxes ?? 0) * safeQuantity * nights;
        return {
          key: room._id?.toString() || room.name,
          room,
          quantity: safeQuantity,
          subtotal,
          taxes,
          index: roomIndex,
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        room: StayDetailPayload["rooms"][number];
        quantity: number;
        subtotal: number;
        taxes: number;
        index: number;
      }>;

    const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
    const taxes = items.reduce((acc, item) => acc + item.taxes, 0);
    const totalRooms = items.reduce((acc, item) => acc + item.quantity, 0);

    const platformFee = items.length ? PLATFORM_FEE : 0;
    const totalBeforeFees = subtotal + taxes;

    return {
      mode: "rooms" as const,
      items,
      subtotal,
      taxes,
      totalBeforeFees,
      platformFee,
      total: totalBeforeFees + platformFee,
      totalRooms,
    };
  }, [isBnbBooking, stay.bnb, stay.rooms, parsedRoomParams, nights, adults, children, infants]);

  const availability = useAvailability("stay", stay._id, checkIn, checkOut);
  const totalGuests = adults + children + infants;
  const availableRoomKeys = availability.availableOptionKeys ?? [];
  const availableRoomQuantities = availability.availableOptionQuantities ?? {};
  const soldOutForDates =
    !isBnbBooking && !availability.loading && stay.rooms.length > 0 && availableRoomKeys.length === 0;
  const unavailableSelections = isBnbBooking
    ? []
    : selection.items.filter(({ room }) => {
      if (availability.loading) return false;
      const key = room._id?.toString() || room.name;
      if (soldOutForDates) return true;
      if (!availableRoomKeys.length) return false;
      return !availableRoomKeys.includes(key);
    });
  const overQuantitySelections = isBnbBooking
    ? []
    : selection.items.filter((item) => {
      if (availability.loading) return false;
      const maxAvailable = Number(availableRoomQuantities[item.key] ?? 0);
      return item.quantity > maxAvailable;
    });
  const hasUnavailableSelections = unavailableSelections.length > 0 || overQuantitySelections.length > 0;
  const selectedCapacity = selection.items.reduce(
    (sum, item) => sum + Number(item.room.capacity || 0) * item.quantity,
    0
  );
  const hasCapacityMismatch = totalGuests > selectedCapacity;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    specialRequests: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [loyaltyDiscountPercent, setLoyaltyDiscountPercent] = useState(0);


  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/verify", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const verifiedUser = data?.user;
        if (!verifiedUser) return;
        setCurrentUser(verifiedUser);
        setFormData((prev) => ({
          ...prev,
          fullName: prev.fullName || verifiedUser.fullName || "",
          email: prev.email || verifiedUser.email || "",
          phone: prev.phone || verifiedUser.contactNumber || "",
        }));
      } catch (error) {
        console.warn("Unable to prefill guest details", error);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadLoyalty = async () => {
      try {
        const res = await fetch("/api/loyalty/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.success && data?.loyalty?.accountType === "user") {
          const percent = Math.max(0, Number(data.loyalty.currentDiscount || 0));
          setLoyaltyDiscountPercent(percent);
        }
      } catch {
        // Keep checkout functional even if loyalty fetch fails.
      }
    };

    loadLoyalty();
  }, []);

  const baseTotal = selection.total;
  const couponDiscountAmount = Math.max(0, Number(appliedCoupon?.appliedDiscount || 0));
  const loyaltyDiscountAmount =
    loyaltyDiscountPercent > 0 && baseTotal >= 4000
      ? Math.min(baseTotal, (baseTotal * loyaltyDiscountPercent) / 100)
      : 0;
  const totalDiscountAmount = Math.min(baseTotal, couponDiscountAmount + loyaltyDiscountAmount);
  const payableTotal = Math.max(0, baseTotal - totalDiscountAmount);

  useEffect(() => {
    if (!bookingSuccess) return;
    const timer = setTimeout(() => {
      router.push("/bookings");
    }, 2500);
    return () => clearTimeout(timer);
  }, [bookingSuccess, router]);

  const handleFieldChange = (key: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          subtotal: selection.subtotal + selection.taxes,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid coupon");
      }

      setAppliedCoupon(data.coupon);
      setCouponCode("");
    } catch (err: any) {
      setCouponError(err.message);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!selection.totalRooms) {
      setSubmitError("Please select at least one room from the stay details page before completing the booking.");
      return;
    }

    if (soldOutForDates || hasUnavailableSelections) {
      setSubmitError(
        unavailableSelections.length > 0
          ? "One or more selected rooms are no longer available for these dates."
          : overQuantitySelections.length > 0
            ? "Selected room quantity exceeds current availability. Please reduce quantity and retry."
          : "These dates are sold out. Please choose different dates to continue."
      );
      return;
    }

    if (hasCapacityMismatch) {
      setSubmitError(
        `Booking for ${selectedCapacity} guest${selectedCapacity === 1 ? "" : "s"} only is available with selected rooms. Please add more rooms or reduce guests.`
      );
      return;
    }

    const sanitizedForm = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      addressLine: formData.addressLine.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      postalCode: formData.postalCode.trim(),
      country: formData.country.trim(),
      specialRequests: formData.specialRequests.trim(),
    };

    if (
      !sanitizedForm.fullName ||
      !sanitizedForm.email ||
      !sanitizedForm.phone ||
      !sanitizedForm.addressLine ||
      !sanitizedForm.city ||
      !sanitizedForm.state ||
      !sanitizedForm.postalCode ||
      !sanitizedForm.country
    ) {
      setSubmitError("Please complete all required guest, contact, and address details.");
      return;
    }

    const formattedAddress = [sanitizedForm.addressLine, sanitizedForm.city, sanitizedForm.state, sanitizedForm.postalCode, sanitizedForm.country]
      .filter(Boolean)
      .join(", ");

    setSubmitting(true);
    try {
      const payload = {
        serviceType: "stay" as const,
        stayId: stay._id,
        checkIn,
        checkOut,
        guests: { adults, children, infants },
        customer: {
          fullName: sanitizedForm.fullName,
          email: sanitizedForm.email,
          phone: sanitizedForm.phone,
          notes: sanitizedForm.specialRequests ? sanitizedForm.specialRequests : undefined,
        },
        currency: selection.items[0]?.room.currency || "INR",
        rooms: selection.items.map(({ room, quantity }) => ({
          roomId: room._id,
          roomName: room.name,
          quantity,
          pricePerNight: room.price,
          taxes: room.taxes ?? 0,
        })),
        fees: selection.platformFee,
        customerId: currentUser?._id || currentUser?.id,
        notes: [
          formattedAddress ? `Guest address: ${formattedAddress}` : "",
          sanitizedForm.specialRequests ? `Special requests: ${sanitizedForm.specialRequests}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        couponCode: appliedCoupon?.code,
      };

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: [
            {
              itemId: stay._id,
              itemType: "Stay",
              quantity: 1,
            },
          ],
          address: {
            name: sanitizedForm.fullName,
            phone: sanitizedForm.phone,
            pincode: sanitizedForm.postalCode,
            address: sanitizedForm.addressLine,
            city: sanitizedForm.city,
            state: sanitizedForm.state,
            landmark: "",
          },
          deliveryCharge: 0,
          totalAmount: payableTotal,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData?.success) {
        throw new Error(orderData?.message || "Failed to create order");
      }

      const localOrderId = orderData?.order?._id;
      if (!localOrderId) {
        throw new Error("Order ID not found");
      }

      const paymentOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: localOrderId }),
      });
      const paymentOrderData = await paymentOrderRes.json();
      if (!paymentOrderRes.ok || !paymentOrderData?.success) {
        throw new Error(paymentOrderData?.message || "Failed to create payment order");
      }

      const paymentResponse = await openRazorpayCheckout({
        key: paymentOrderData.key,
        amount: paymentOrderData.amount,
        currency: paymentOrderData.currency,
        orderId: paymentOrderData.razorpayOrderId,
        description: `Stay Booking #${localOrderId}`,
        localOrderId,
        prefillName: sanitizedForm.fullName,
        prefillContact: sanitizedForm.phone,
      });

      await verifyRazorpayPayment(localOrderId, paymentResponse);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...payload, orderId: localOrderId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || "We couldn't complete your booking. Please try again.");
      }

      setBookingSuccess(data.booking);
      router.push("/bookings");
    } catch (error: any) {
      setSubmitError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const stayLocation = useMemo(
    () =>
      [stay.location.address, stay.location.city, stay.location.state, stay.location.country]
        .filter(Boolean)
        .join(", "),
    [stay.location.address, stay.location.city, stay.location.state, stay.location.country]
  );

  if (!selection.items.length) {
    return (
      <div className="min-h-screen bg-sky-50">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-3xl bg-white p-10 shadow-xl">
            <h1 className="text-2xl font-semibold text-gray-900">Let's pick a room first</h1>
            <p className="mt-3 text-sm text-gray-600">
              It looks like your booking session expired or no rooms were selected. Head back to the stay page to choose the spaces you love.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/stays/details/${stay._id}`)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-green-700"
            >
              <FaArrowLeft /> Back to stay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-sky-50">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
            <FaCheckCircle className="mx-auto text-4xl text-green-500" />
            <h1 className="mt-4 text-2xl font-semibold text-gray-900">Booking confirmed!</h1>
            <p className="mt-3 text-sm text-gray-600">
              We've emailed {bookingSuccess.customer?.email} with the reservation details. Your reference number is{" "}
              <span className="font-semibold text-gray-900">{bookingSuccess._id}</span>. Redirecting you to your bookings dashboard.
            </p>
            <div className="mt-6 space-y-2 text-sm text-gray-600">
              <p>
                <FaCalendarAlt className="mr-2 inline text-green-500" />
                {formatDateDisplay(checkIn)} — {formatDateDisplay(checkOut)} ({nights} night{nights === 1 ? "" : "s"})
              </p>
              <p>
                <FaUsers className="mr-2 inline text-green-500" />
                {adults} adult{adults === 1 ? "" : "s"}
                {children > 0 && ` · ${children} child${children === 1 ? "" : "ren"}`}
                {infants > 0 && ` · ${infants} infant${infants === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/bookings")}
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-green-700"
              >
                Go to my bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-20 pt-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white/80 p-6 text-gray-900 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                onClick={() => router.push(`/stays/${stay._id}`)}
                className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-100"
              >
                <FaArrowLeft /> Back to stay overview
              </button>
              <h1 className="mt-3 text-2xl font-semibold text-gray-900">Complete your booking</h1>
              <p className="mt-1 text-sm text-gray-600">
                You're just one step away from confirming your stay at {stay.name}. Share guest and contact details to lock in your reservation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                <FaCalendarAlt className="text-green-500" />
                {formatDateDisplay(checkIn)} · {formatDateDisplay(checkOut)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                <FaUsers className="text-green-500" /> {adults} adult{adults === 1 ? "" : "s"}
                {children > 0 && ` · ${children} child${children === 1 ? "" : "ren"}`}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white p-6 shadow-lg">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Guest details</h2>
              <p className="mt-1 text-sm text-gray-600">We'll use this information to share your confirmation and stay updates.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Full name <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleFieldChange("fullName")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                  placeholder="Primary guest name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Email address <span className="text-xs text-rose-500">*</span>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleFieldChange("email")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                  placeholder="Enter Your Email"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Mobile number <span className="text-xs text-rose-500">*</span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-green-500">
                  <FaPhoneAlt className="text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleFieldChange("phone")}
                    className="w-full border-none bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                    placeholder="Enter Your Number"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Address line <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.addressLine}
                  onChange={handleFieldChange("addressLine")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                  placeholder="Street address, apartment, suite, etc."
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                City <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={handleFieldChange("city")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                State / Province <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={handleFieldChange("state")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Postal code <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.postalCode}
                  onChange={handleFieldChange("postalCode")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Country / Region <span className="text-xs text-rose-500">*</span>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={handleFieldChange("country")}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Special requests
              <textarea
                rows={4}
                value={formData.specialRequests}
                onChange={handleFieldChange("specialRequests")}
                className="rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:outline-none"
                placeholder="Arrival time, dietary needs, additional guests, etc."
              />
            </label>

            <div
              className={`rounded-xl border px-4 py-3 text-sm ${soldOutForDates
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
            >
              {availability.loading && "Checking availability…"}
              {!availability.loading && !availability.error && (
                <span>
                  {soldOutForDates
                    ? "These dates are sold out. Please adjust your dates."
                    : "These dates are available."}
                </span>
              )}
              {availability.error && (
                <span className="text-rose-600">Unable to check availability. Please refresh.</span>
              )}
              {!availability.loading && hasUnavailableSelections && (
                <span className="mt-2 block text-xs text-rose-600">
                  Unavailable: {unavailableSelections.map(({ room }) => room.name).join(", ")}
                </span>
              )}
              {!availability.loading && !soldOutForDates && hasCapacityMismatch && (
                <span className="mt-2 block text-xs text-rose-600">
                  Capacity mismatch: selected rooms support {selectedCapacity} guest{selectedCapacity === 1 ? "" : "s"}, but {totalGuests} guest{totalGuests === 1 ? "" : "s"} entered.
                </span>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || soldOutForDates || hasUnavailableSelections || hasCapacityMismatch}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {soldOutForDates
                ? "Unavailable for these dates"
                : hasCapacityMismatch
                  ? `Capacity for ${selectedCapacity} guests only`
                : hasUnavailableSelections
                  ? "Selected room unavailable"
                  : submitting
                    ? "Processing booking…"
                    : "Confirm booking"}
            </button>
          </form>

          <aside className="space-y-4 rounded-3xl bg-white p-6 shadow-lg">
            <div className="relative h-40 w-full overflow-hidden rounded-2xl">
              {stay.images?.length ? (
                <Image src={stay.images[0]} alt={stay.name} fill sizes="(max-width: 1024px) 100vw, 32vw" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-500">Image coming soon</div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-xs uppercase tracking-wide text-white/80">{stay.category}</p>
                <h3 className="text-lg font-semibold">{stay.name}</h3>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="flex items-center gap-2 text-gray-900">
                <FaMapMarkerAlt className="text-green-600" /> {stayLocation}
              </p>
              <p className="mt-2 flex items-center gap-2">
                <FaCalendarAlt className="text-green-600" />
                {formatDateDisplay(checkIn)} → {formatDateDisplay(checkOut)} ({nights} night{nights === 1 ? "" : "s"})
              </p>
              <p className="mt-2 flex items-center gap-2">
                <FaUsers className="text-green-600" /> {adults} adult{adults === 1 ? "" : "s"}
                {children > 0 && ` · ${children} child${children === 1 ? "" : "ren"}`}
                {infants > 0 && ` · ${infants} infant${infants === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your rooms</p>
              <ul className="space-y-3">
                {selection.items.map(({ room, quantity }) => (
                  <li key={(room._id as string) || room.name} className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{room.name}</p>
                        <p className="text-xs text-gray-500">
                          {quantity} room{quantity === 1 ? "" : "s"} · Sleeps {room.capacity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">₹{(room.price * quantity * nights).toLocaleString()}</span>
                    </div>
                    {room.amenities?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {room.amenities.slice(0, 4).map((amenity) => (
                          <span key={amenity} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow">
                            <FaTag className="text-gray-400" />
                            {amenity}
                          </span>
                        ))}
                        {room.amenities.length > 4 && <span>+{room.amenities.length - 4} more</span>}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-900">HAVE A COUPON?</p>
              <div className="flex gap-2">                <input
                type="text"
                placeholder="COUPON CODE"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase font-bold text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none"
              />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={validatingCoupon || !couponCode}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {validatingCoupon ? "..." : "Apply"}
                </button>
              </div>
              {couponError && <p className="text-xs text-rose-500">{couponError}</p>}
              {appliedCoupon && (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 border border-green-100">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-bold text-xs">{appliedCoupon.code}</span>
                    <span className="text-[10px] text-green-600">Applied!</span>
                  </div>
                  <button onClick={handleRemoveCoupon} type="button" className="text-[10px] font-bold text-rose-500 hover:underline">
                    REMOVE
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-2xl bg-gray-900 px-5 py-4 text-sm text-white">
              <div className="flex justify-between text-gray-200">
                <span>Subtotal</span>
                <span>₹{selection.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-200">
                <span>Taxes & fees</span>
                <span>₹{selection.taxes.toLocaleString()}</span>
              </div>
              {selection.platformFee > 0 && (
                <div className="flex justify-between text-gray-200">
                  <span>Platform fee</span>
                  <span>₹{selection.platformFee.toLocaleString()}</span>
                </div>
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-green-400 font-medium italic">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>-₹{appliedCoupon.appliedDiscount.toLocaleString()}</span>
                </div>
              )}
              {loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-cyan-300 font-medium italic">
                  <span>Loyalty discount ({loyaltyDiscountPercent}%)</span>
                  <span>-₹{loyaltyDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/20 pt-2 text-base font-semibold">
                <span>Total</span>
                <span>₹{payableTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-white/70">You will confirm payment details with the property. No charges processed on this page.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default StayBookingFormClient;


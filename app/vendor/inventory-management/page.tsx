"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCcw, Trash2 } from "lucide-react";
import { useVendorLayout } from "../VendorLayoutContext";

type StayRoom = {
  _id?: string;
  name: string;
  available: number;
};

type StayRecord = {
  _id: string;
  name: string;
  category: string;
  location?: {
    city?: string;
    state?: string;
  };
  rooms: StayRoom[];
};

type StayBlock = {
  _id: string;
  roomName: string;
  blockedCount: number;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt?: string;
};

type ServiceOptionBlock = {
  _id: string;
  optionId?: string;
  optionName: string;
  blockedCount: number;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt?: string;
};

type TourOption = {
  _id?: string;
  name: string;
  capacity?: number;
  available?: number;
};

type TourRecord = {
  _id: string;
  name: string;
  category: "group-tours" | "tour-packages";
  options: TourOption[];
};

type AdventureOption = {
  _id?: string;
  name: string;
  capacity?: number;
  available?: number;
};

type AdventureRecord = {
  _id: string;
  name: string;
  category: string;
  options: AdventureOption[];
};

type VehicleOption = {
  _id?: string;
  model: string;
  type?: string;
  available?: number;
};

type VehicleRecord = {
  _id: string;
  name: string;
  category: string;
  options: VehicleOption[];
};

type ProductVariant = {
  _id?: string;
  color?: string;
  size?: string;
  stock?: number;
};

type ProductRecord = {
  _id: string;
  name: string;
  category: string;
  listingType: "buy" | "rent";
  stock?: number;
  rentalQuantity?: number;
  rentPriceDay?: number;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  variants: ProductVariant[];
};

type AvailabilitySnapshot = {
  availableOptionKeys: string[];
  availableOptionQuantities: Record<string, number>;
};

type ServiceTab = "stays" | "tours" | "adventures" | "vehicles" | "products";

const toDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const InventoryManagementPage = () => {
  const { user } = useVendorLayout();

  const [activeTab, setActiveTab] = useState<ServiceTab>("stays");

  const [stays, setStays] = useState<StayRecord[]>([]);
  const [blocks, setBlocks] = useState<StayBlock[]>([]);
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [adventures, setAdventures] = useState<AdventureRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [tourBlocks, setTourBlocks] = useState<ServiceOptionBlock[]>([]);
  const [adventureBlocks, setAdventureBlocks] = useState<ServiceOptionBlock[]>([]);
  const [vehicleBlocks, setVehicleBlocks] = useState<ServiceOptionBlock[]>([]);

  const [loadingStays, setLoadingStays] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingTours, setLoadingTours] = useState(false);
  const [loadingAdventures, setLoadingAdventures] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingTourAvailability, setLoadingTourAvailability] = useState(false);
  const [loadingAdventureAvailability, setLoadingAdventureAvailability] = useState(false);
  const [loadingVehicleAvailability, setLoadingVehicleAvailability] = useState(false);
  const [loadingTourBlocks, setLoadingTourBlocks] = useState(false);
  const [loadingAdventureBlocks, setLoadingAdventureBlocks] = useState(false);
  const [loadingVehicleBlocks, setLoadingVehicleBlocks] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [savingServiceBlock, setSavingServiceBlock] = useState(false);
  const [savingProductKey, setSavingProductKey] = useState<string | null>(null);
  const [deletingServiceBlockId, setDeletingServiceBlockId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedStayId, setSelectedStayId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedTourId, setSelectedTourId] = useState("");
  const [selectedAdventureId, setSelectedAdventureId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedTourOptionId, setSelectedTourOptionId] = useState("");
  const [selectedAdventureOptionId, setSelectedAdventureOptionId] = useState("");
  const [selectedVehicleOptionId, setSelectedVehicleOptionId] = useState("");
  const [blockedCount, setBlockedCount] = useState(1);
  const [reason, setReason] = useState("");
  const [serviceBlockedCount, setServiceBlockedCount] = useState(1);
  const [serviceReason, setServiceReason] = useState("");
  const [productEdits, setProductEdits] = useState<Record<string, number>>({});
  const [variantEdits, setVariantEdits] = useState<Record<string, number>>({});

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(toDateInput(today));
  const [endDate, setEndDate] = useState(toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000)));
  const [serviceStartDate, setServiceStartDate] = useState(toDateInput(today));
  const [serviceEndDate, setServiceEndDate] = useState(
    toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000))
  );
  const [inspectStartDate, setInspectStartDate] = useState(toDateInput(today));
  const [inspectEndDate, setInspectEndDate] = useState(
    toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000))
  );
  const [tourAvailability, setTourAvailability] = useState<AvailabilitySnapshot | null>(null);
  const [adventureAvailability, setAdventureAvailability] = useState<AvailabilitySnapshot | null>(null);
  const [vehicleAvailability, setVehicleAvailability] = useState<AvailabilitySnapshot | null>(null);

  const selectedStay = useMemo(
    () => stays.find((stay) => stay._id === selectedStayId) || null,
    [stays, selectedStayId]
  );

  const selectedRoom = useMemo(
    () => selectedStay?.rooms?.find((room) => String(room._id) === selectedRoomId) || null,
    [selectedStay, selectedRoomId]
  );

  const selectedTour = useMemo(
    () => tours.find((tour) => tour._id === selectedTourId) || null,
    [tours, selectedTourId]
  );

  const selectedAdventure = useMemo(
    () => adventures.find((adventure) => adventure._id === selectedAdventureId) || null,
    [adventures, selectedAdventureId]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle._id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const selectedTourOption = useMemo(
    () => selectedTour?.options?.find((option) => String(option._id) === selectedTourOptionId) || null,
    [selectedTour, selectedTourOptionId]
  );

  const selectedAdventureOption = useMemo(
    () =>
      selectedAdventure?.options?.find((option) => String(option._id) === selectedAdventureOptionId) || null,
    [selectedAdventure, selectedAdventureOptionId]
  );

  const selectedVehicleOption = useMemo(
    () => selectedVehicle?.options?.find((option) => String(option._id) === selectedVehicleOptionId) || null,
    [selectedVehicle, selectedVehicleOptionId]
  );

  const activeServiceBlocks = useMemo(() => {
    if (activeTab === "tours") return tourBlocks;
    if (activeTab === "adventures") return adventureBlocks;
    if (activeTab === "vehicles") return vehicleBlocks;
    return [];
  }, [activeTab, tourBlocks, adventureBlocks, vehicleBlocks]);

  const activeServiceMaxBlock = useMemo(() => {
    if (activeTab === "tours") {
      if (!selectedTourOption) return 1;
      if (selectedTour?.category === "tour-packages") return 1;
      return Math.max(1, Number(selectedTourOption.capacity || 0));
    }

    if (activeTab === "adventures") {
      return Math.max(1, Number(selectedAdventureOption?.available || 0));
    }

    if (activeTab === "vehicles") {
      return Math.max(1, Number(selectedVehicleOption?.available || 0));
    }

    return 1;
  }, [
    activeTab,
    selectedTour,
    selectedTourOption,
    selectedAdventureOption,
    selectedVehicleOption,
  ]);

  const vendorId = useMemo(() => user?._id || user?.id || null, [user?._id, user?.id]);

  const loadStays = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoadingStays(true);
      setError(null);

      const params = new URLSearchParams({
        vendorId: String(vendorId),
        all: "true",
      });

      const res = await fetch(`/api/vendor/stays?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load stays");
      }

      const mappedStays: StayRecord[] = Array.isArray(data?.stays)
        ? data.stays.map((stay: any) => ({
            _id: String(stay._id),
            name: stay.name,
            category: stay.category,
            location: stay.location,
            rooms: Array.isArray(stay.rooms)
              ? stay.rooms.map((room: any) => ({
                  _id: room?._id ? String(room._id) : undefined,
                  name: room?.name || "Room",
                  available: Number(room?.available || 0),
                }))
              : [],
          }))
        : [];

      setStays(mappedStays);

      if (!selectedStayId && mappedStays.length > 0) {
        setSelectedStayId(mappedStays[0]._id);
      }
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load stays");
    } finally {
      setLoadingStays(false);
    }
  }, [vendorId, selectedStayId]);

  const loadTours = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoadingTours(true);
      const params = new URLSearchParams({ vendorId: String(vendorId), all: "true" });
      const res = await fetch(`/api/vendor/tours?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load tours");
      }

      const mapped: TourRecord[] = Array.isArray(data?.tours)
        ? data.tours.map((tour: any) => ({
            _id: String(tour._id),
            name: tour.name,
            category: tour.category,
            options: Array.isArray(tour.options)
              ? tour.options.map((option: any) => ({
                  _id: option?._id ? String(option._id) : undefined,
                  name: option?.name || "Option",
                  capacity: Number(option?.capacity || 0),
                  available: Number(option?.available || 0),
                }))
              : [],
          }))
        : [];

      setTours(mapped);
      if (!selectedTourId && mapped.length > 0) {
        setSelectedTourId(mapped[0]._id);
      }
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load tours");
    } finally {
      setLoadingTours(false);
    }
  }, [vendorId, selectedTourId]);

  const loadAdventures = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoadingAdventures(true);
      const params = new URLSearchParams({ vendorId: String(vendorId), all: "true" });
      const res = await fetch(`/api/vendor/adventures?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load adventures");
      }

      const mapped: AdventureRecord[] = Array.isArray(data?.adventures)
        ? data.adventures.map((adventure: any) => ({
            _id: String(adventure._id),
            name: adventure.name,
            category: adventure.category,
            options: Array.isArray(adventure.options)
              ? adventure.options.map((option: any) => ({
                  _id: option?._id ? String(option._id) : undefined,
                  name: option?.name || "Option",
                  capacity: Number(option?.capacity || 0),
                  available: Number(option?.available || 0),
                }))
              : [],
          }))
        : [];

      setAdventures(mapped);
      if (!selectedAdventureId && mapped.length > 0) {
        setSelectedAdventureId(mapped[0]._id);
      }
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load adventures");
    } finally {
      setLoadingAdventures(false);
    }
  }, [vendorId, selectedAdventureId]);

  const loadVehicles = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoadingVehicles(true);
      const params = new URLSearchParams({ vendorId: String(vendorId), all: "true" });
      const res = await fetch(`/api/vendor/vehicle-rental?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load vehicles");
      }

      const mapped: VehicleRecord[] = Array.isArray(data?.rentals)
        ? data.rentals.map((rental: any) => ({
            _id: String(rental._id),
            name: rental.name,
            category: rental.category,
            options: Array.isArray(rental.options)
              ? rental.options.map((option: any) => ({
                  _id: option?._id ? String(option._id) : undefined,
                  model: option?.model || "Vehicle",
                  type: option?.type || "",
                  available: Number(option?.available || 0),
                }))
              : [],
          }))
        : [];

      setVehicles(mapped);
      if (!selectedVehicleId && mapped.length > 0) {
        setSelectedVehicleId(mapped[0]._id);
      }
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load vehicles");
    } finally {
      setLoadingVehicles(false);
    }
  }, [vendorId, selectedVehicleId]);

  const loadProducts = useCallback(async () => {
    if (!user?.isSeller) {
      setProducts([]);
      return;
    }

    try {
      setLoadingProducts(true);
      const res = await fetch(`/api/products?mine=true&t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load products");
      }

      const mapped: ProductRecord[] = Array.isArray(data?.products)
        ? data.products.map((product: any) => ({
            _id: String(product._id),
            name: product.name,
            category: product.category,
            listingType: product.listingType === "rent" ? "rent" : "buy",
            stock: typeof product.stock === "number" ? product.stock : 0,
            rentalQuantity:
              typeof product.rentalQuantity === "number" ? product.rentalQuantity : undefined,
            rentPriceDay:
              typeof product.rentPriceDay === "number" ? product.rentPriceDay : undefined,
            rentalStartDate: product.rentalStartDate || null,
            rentalEndDate: product.rentalEndDate || null,
            variants: Array.isArray(product.variants)
              ? product.variants.map((variant: any) => ({
                  _id: variant?._id ? String(variant._id) : undefined,
                  color: variant?.color,
                  size: variant?.size,
                  stock: Number(variant?.stock || 0),
                }))
              : [],
          }))
        : [];

      setProducts(mapped);

      const nextProductEdits: Record<string, number> = {};
      const nextVariantEdits: Record<string, number> = {};
      mapped.forEach((product) => {
        const baseQty =
          product.listingType === "rent"
            ? Number(product.rentalQuantity ?? product.stock ?? 0)
            : Number(product.stock ?? 0);
        nextProductEdits[product._id] = Math.max(0, baseQty);
        product.variants.forEach((variant) => {
          if (!variant._id) return;
          nextVariantEdits[`${product._id}:${variant._id}`] = Math.max(0, Number(variant.stock || 0));
        });
      });

      setProductEdits(nextProductEdits);
      setVariantEdits(nextVariantEdits);
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  }, [user?.isSeller]);

  const loadAvailability = useCallback(
    async (serviceType: "tour" | "adventure" | "vehicle", id: string) => {
      if (!id || !inspectStartDate || !inspectEndDate) return;
      if (new Date(inspectEndDate) <= new Date(inspectStartDate)) {
        setError("End date must be after start date.");
        return;
      }

      try {
        if (serviceType === "tour") setLoadingTourAvailability(true);
        if (serviceType === "adventure") setLoadingAdventureAvailability(true);
        if (serviceType === "vehicle") setLoadingVehicleAvailability(true);

        const params = new URLSearchParams({
          serviceType,
          id,
          start: inspectStartDate,
          end: inspectEndDate,
        });
        const res = await fetch(`/api/availability?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || `Unable to load ${serviceType} availability`);
        }

        const snapshot: AvailabilitySnapshot = {
          availableOptionKeys: Array.isArray(data?.availableOptionKeys) ? data.availableOptionKeys : [],
          availableOptionQuantities:
            data?.availableOptionQuantities && typeof data.availableOptionQuantities === "object"
              ? data.availableOptionQuantities
              : {},
        };

        if (serviceType === "tour") setTourAvailability(snapshot);
        if (serviceType === "adventure") setAdventureAvailability(snapshot);
        if (serviceType === "vehicle") setVehicleAvailability(snapshot);
      } catch (fetchError: any) {
        setError(fetchError?.message || `Failed to load ${serviceType} availability`);
      } finally {
        if (serviceType === "tour") setLoadingTourAvailability(false);
        if (serviceType === "adventure") setLoadingAdventureAvailability(false);
        if (serviceType === "vehicle") setLoadingVehicleAvailability(false);
      }
    },
    [inspectStartDate, inspectEndDate]
  );

  const loadBlocks = useCallback(async () => {
    if (!selectedStayId) {
      setBlocks([]);
      return;
    }

    try {
      setLoadingBlocks(true);
      setError(null);

      const res = await fetch(`/api/vendor/stays/${selectedStayId}/blocks`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to load room blocks");
      }

      setBlocks(Array.isArray(data?.blocks) ? data.blocks : []);
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load room blocks");
    } finally {
      setLoadingBlocks(false);
    }
  }, [selectedStayId]);

  const loadServiceBlocks = useCallback(
    async (service: "tour" | "adventure" | "vehicle", id: string) => {
      if (!id) {
        if (service === "tour") setTourBlocks([]);
        if (service === "adventure") setAdventureBlocks([]);
        if (service === "vehicle") setVehicleBlocks([]);
        return;
      }

      try {
        if (service === "tour") setLoadingTourBlocks(true);
        if (service === "adventure") setLoadingAdventureBlocks(true);
        if (service === "vehicle") setLoadingVehicleBlocks(true);

        const endpoint =
          service === "tour"
            ? `/api/vendor/tours/${id}/blocks`
            : service === "adventure"
              ? `/api/vendor/adventures/${id}/blocks`
              : `/api/vendor/vehicle-rental/${id}/blocks`;

        const res = await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || `Unable to load ${service} blocks`);
        }

        const nextBlocks = Array.isArray(data?.blocks) ? data.blocks : [];
        if (service === "tour") setTourBlocks(nextBlocks);
        if (service === "adventure") setAdventureBlocks(nextBlocks);
        if (service === "vehicle") setVehicleBlocks(nextBlocks);
      } catch (fetchError: any) {
        setError(fetchError?.message || `Failed to load ${service} blocks`);
      } finally {
        if (service === "tour") setLoadingTourBlocks(false);
        if (service === "adventure") setLoadingAdventureBlocks(false);
        if (service === "vehicle") setLoadingVehicleBlocks(false);
      }
    },
    []
  );

  useEffect(() => {
    loadStays();
    loadTours();
    loadAdventures();
    loadVehicles();
    loadProducts();
  }, [loadStays, loadTours, loadAdventures, loadVehicles, loadProducts]);

  useEffect(() => {
    if (!selectedStay) {
      setSelectedRoomId("");
      return;
    }

    if (!selectedRoomId || !selectedStay.rooms.some((room) => String(room._id) === selectedRoomId)) {
      const firstRoom = selectedStay.rooms.find((room) => Boolean(room._id));
      setSelectedRoomId(firstRoom?._id ? String(firstRoom._id) : "");
    }
  }, [selectedStay, selectedRoomId]);

  useEffect(() => {
    if (!selectedTour || selectedTour.options.length === 0) {
      setSelectedTourOptionId("");
      return;
    }

    if (!selectedTourOptionId || !selectedTour.options.some((option) => String(option._id) === selectedTourOptionId)) {
      const firstOption = selectedTour.options.find((option) => Boolean(option._id));
      setSelectedTourOptionId(firstOption?._id ? String(firstOption._id) : "");
    }
  }, [selectedTour, selectedTourOptionId]);

  useEffect(() => {
    if (!selectedAdventure || selectedAdventure.options.length === 0) {
      setSelectedAdventureOptionId("");
      return;
    }

    if (
      !selectedAdventureOptionId ||
      !selectedAdventure.options.some((option) => String(option._id) === selectedAdventureOptionId)
    ) {
      const firstOption = selectedAdventure.options.find((option) => Boolean(option._id));
      setSelectedAdventureOptionId(firstOption?._id ? String(firstOption._id) : "");
    }
  }, [selectedAdventure, selectedAdventureOptionId]);

  useEffect(() => {
    if (!selectedVehicle || selectedVehicle.options.length === 0) {
      setSelectedVehicleOptionId("");
      return;
    }

    if (!selectedVehicleOptionId || !selectedVehicle.options.some((option) => String(option._id) === selectedVehicleOptionId)) {
      const firstOption = selectedVehicle.options.find((option) => Boolean(option._id));
      setSelectedVehicleOptionId(firstOption?._id ? String(firstOption._id) : "");
    }
  }, [selectedVehicle, selectedVehicleOptionId]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  useEffect(() => {
    if (selectedTourId) {
      loadAvailability("tour", selectedTourId);
      loadServiceBlocks("tour", selectedTourId);
    }
  }, [selectedTourId, inspectStartDate, inspectEndDate, loadAvailability, loadServiceBlocks]);

  useEffect(() => {
    if (selectedAdventureId) {
      loadAvailability("adventure", selectedAdventureId);
      loadServiceBlocks("adventure", selectedAdventureId);
    }
  }, [selectedAdventureId, inspectStartDate, inspectEndDate, loadAvailability, loadServiceBlocks]);

  useEffect(() => {
    if (selectedVehicleId) {
      loadAvailability("vehicle", selectedVehicleId);
      loadServiceBlocks("vehicle", selectedVehicleId);
    }
  }, [selectedVehicleId, inspectStartDate, inspectEndDate, loadAvailability, loadServiceBlocks]);

  const handleCreateBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedStayId || !selectedRoom) {
      setError("Please choose a stay and room first.");
      return;
    }

    if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date.");
      return;
    }

    if (!Number.isFinite(blockedCount) || blockedCount < 1) {
      setError("Blocked room count must be at least 1.");
      return;
    }

    try {
      setSavingBlock(true);
      const res = await fetch(`/api/vendor/stays/${selectedStayId}/blocks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom._id,
          startDate,
          endDate,
          blockedCount,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to create block");
      }

      setReason("");
      setSuccessMessage("Room inventory block added successfully.");
      await loadBlocks();
    } catch (saveError: any) {
      setError(saveError?.message || "Failed to create room block");
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    setError(null);
    setSuccessMessage(null);

    try {
      setDeletingBlockId(blockId);
      const res = await fetch(
        `/api/vendor/stays/${selectedStayId}/blocks?blockId=${encodeURIComponent(blockId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to delete block");
      }

      setSuccessMessage("Room inventory block removed.");
      await loadBlocks();
    } catch (deleteError: any) {
      setError(deleteError?.message || "Failed to delete block");
    } finally {
      setDeletingBlockId(null);
    }
  };

  const handleCreateServiceBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (activeTab === "stays") return;

    const service =
      activeTab === "tours" ? "tour" : activeTab === "adventures" ? "adventure" : "vehicle";
    const selectedServiceId =
      service === "tour" ? selectedTourId : service === "adventure" ? selectedAdventureId : selectedVehicleId;
    const selectedOption =
      service === "tour"
        ? selectedTourOption
        : service === "adventure"
          ? selectedAdventureOption
          : selectedVehicleOption;

    if (!selectedServiceId || !selectedOption?._id) {
      setError("Please choose a listing and option first.");
      return;
    }

    if (!serviceStartDate || !serviceEndDate || new Date(serviceEndDate) <= new Date(serviceStartDate)) {
      setError("End date must be after start date.");
      return;
    }

    if (!Number.isFinite(serviceBlockedCount) || serviceBlockedCount < 1) {
      setError("Blocked capacity must be at least 1.");
      return;
    }

    if (serviceBlockedCount > activeServiceMaxBlock) {
      setError(`Blocked capacity cannot exceed ${activeServiceMaxBlock}.`);
      return;
    }

    try {
      setSavingServiceBlock(true);

      const endpoint =
        service === "tour"
          ? `/api/vendor/tours/${selectedServiceId}/blocks`
          : service === "adventure"
            ? `/api/vendor/adventures/${selectedServiceId}/blocks`
            : `/api/vendor/vehicle-rental/${selectedServiceId}/blocks`;

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId: selectedOption._id,
          optionName:
            service === "tour"
              ? (selectedOption as TourOption).name
              : service === "adventure"
                ? (selectedOption as AdventureOption).name
                : (selectedOption as VehicleOption).model,
          startDate: serviceStartDate,
          endDate: serviceEndDate,
          blockedCount: serviceBlockedCount,
          reason: serviceReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to create block");
      }

      setServiceReason("");
      setSuccessMessage("Inventory block added successfully.");
      await loadServiceBlocks(service, selectedServiceId);
      await loadAvailability(service, selectedServiceId);
    } catch (saveError: any) {
      setError(saveError?.message || "Failed to create block");
    } finally {
      setSavingServiceBlock(false);
    }
  };

  const handleDeleteServiceBlock = async (blockId: string) => {
    setError(null);
    setSuccessMessage(null);

    if (activeTab === "stays") return;

    const service =
      activeTab === "tours" ? "tour" : activeTab === "adventures" ? "adventure" : "vehicle";
    const selectedServiceId =
      service === "tour" ? selectedTourId : service === "adventure" ? selectedAdventureId : selectedVehicleId;

    if (!selectedServiceId) {
      setError("Please choose a listing first.");
      return;
    }

    try {
      setDeletingServiceBlockId(blockId);

      const endpoint =
        service === "tour"
          ? `/api/vendor/tours/${selectedServiceId}/blocks?blockId=${encodeURIComponent(blockId)}`
          : service === "adventure"
            ? `/api/vendor/adventures/${selectedServiceId}/blocks?blockId=${encodeURIComponent(blockId)}`
            : `/api/vendor/vehicle-rental/${selectedServiceId}/blocks?blockId=${encodeURIComponent(blockId)}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to delete block");
      }

      setSuccessMessage("Inventory block removed.");
      await loadServiceBlocks(service, selectedServiceId);
      await loadAvailability(service, selectedServiceId);
    } catch (deleteError: any) {
      setError(deleteError?.message || "Failed to delete block");
    } finally {
      setDeletingServiceBlockId(null);
    }
  };

  const handleSaveProductInventory = async (product: ProductRecord, variantId?: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      const saveKey = variantId ? `${product._id}:${variantId}` : product._id;
      setSavingProductKey(saveKey);

      const detailRes = await fetch(`/api/products/${product._id}`, {
        credentials: "include",
        cache: "no-store",
      });
      const detailData = await detailRes.json();
      if (!detailRes.ok || !detailData?.success || !detailData?.product) {
        throw new Error(detailData?.message || "Unable to load product details");
      }

      const liveProduct = detailData.product;
      const hasVariants = Array.isArray(liveProduct.variants) && liveProduct.variants.length > 0;

      const nextVariants = hasVariants
        ? (liveProduct.variants as any[]).map((variant) => {
            const currentVariantId = String(variant._id);
            if (!variantId || currentVariantId !== variantId) {
              return variant;
            }
            const edited = Math.max(0, Number(variantEdits[`${product._id}:${variantId}`] ?? variant.stock ?? 0));
            return {
              ...variant,
              stock: edited,
            };
          })
        : [];

      const editedBaseQty = Math.max(0, Number(productEdits[product._id] ?? 0));

      const payload = {
        name: liveProduct.name,
        category: liveProduct.category,
        description: liveProduct.description,
        basePrice: liveProduct.basePrice,
        images: Array.isArray(liveProduct.images) ? liveProduct.images : [],
        variants: nextVariants,
        tags: Array.isArray(liveProduct.tags) ? liveProduct.tags : [],
        isActive: Boolean(liveProduct.isActive),
        stock: hasVariants
          ? undefined
          : liveProduct.listingType === "rent"
            ? editedBaseQty
            : editedBaseQty,
        listingType: liveProduct.listingType,
        rentPriceDay: liveProduct.listingType === "rent" ? liveProduct.rentPriceDay : undefined,
        rentalQuantity: liveProduct.listingType === "rent" && !hasVariants ? editedBaseQty : liveProduct.rentalQuantity,
        rentalStartDate: liveProduct.listingType === "rent" ? liveProduct.rentalStartDate : undefined,
        rentalEndDate: liveProduct.listingType === "rent" ? liveProduct.rentalEndDate : undefined,
      };

      const updateRes = await fetch(`/api/products/${product._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok || !updateData?.success) {
        throw new Error(updateData?.message || "Failed to update product inventory");
      }

      setSuccessMessage("Product inventory updated successfully.");
      await loadProducts();
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to save product inventory");
    } finally {
      setSavingProductKey(null);
    }
  };

  return (
    <div className="space-y-8 lg:pt-15 pt-0">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-green-600 font-semibold">Vendor Controls</p>
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-sm text-gray-600">
          Manage inventory in separate sections for stays, tours, adventures, vehicle rentals, and products.
        </p>
      </header>

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "stays", label: "Stays" },
            { id: "tours", label: "Tours" },
            { id: "adventures", label: "Adventures" },
            { id: "vehicles", label: "Vehicle Rental" },
            { id: "products", label: "Products" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ServiceTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-green-600 text-white"
                  : "border border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {activeTab === "stays" && (
        <>
          <section className="rounded-3xl bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Create Room Block</h2>
          <button
            type="button"
            onClick={() => {
              loadStays();
              loadBlocks();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:border-gray-300"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {loadingStays ? (
          <p className="text-sm text-gray-500">Loading stays...</p>
        ) : stays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            No stays found yet. Add a stay first, then use inventory management.
          </div>
        ) : (
          <form onSubmit={handleCreateBlock} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Stay</span>
              <select
                value={selectedStayId}
                onChange={(e) => setSelectedStayId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {stays.map((stay) => (
                  <option key={stay._id} value={stay._id}>
                    {stay.name} ({stay.location?.city || "Unknown city"})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Room</span>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={!selectedStay || selectedStay.rooms.length === 0}
              >
                {selectedStay?.rooms.map((room) => (
                  <option key={room._id || room.name} value={String(room._id)}>
                    {room.name} (Total inventory: {room.available})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Blocked Rooms</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, Number(selectedRoom?.available || 1))}
                value={blockedCount}
                onChange={(e) => setBlockedCount(Number(e.target.value || 1))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1 md:col-span-2">
              <span className="font-medium">Reason (optional)</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Example: Maintenance"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={savingBlock || !selectedRoom}
                className="inline-flex items-center rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60"
              >
                {savingBlock ? "Saving..." : "Add Block"}
              </button>
            </div>
          </form>
        )}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Current Blocks</h2>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <CalendarDays size={14} /> Date-based room restrictions
          </p>
        </div>

        {loadingBlocks ? (
          <p className="text-sm text-gray-500">Loading room blocks...</p>
        ) : !selectedStayId ? (
          <p className="text-sm text-gray-500">Choose a stay to view blocks.</p>
        ) : blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            No blocks created for this stay yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Room</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Date Range</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Blocked</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Reason</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {blocks.map((block) => (
                  <tr key={block._id}>
                    <td className="px-4 py-3 text-gray-700">{block.roomName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(block.startDate).toLocaleDateString()} - {new Date(block.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{block.blockedCount}</td>
                    <td className="px-4 py-3 text-gray-600">{block.reason || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block._id)}
                        disabled={deletingBlockId === block._id}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deletingBlockId === block._id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </section>
        </>
      )}

      {activeTab === "products" && (
        <section className="rounded-3xl bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Products Inventory</h2>
            <button
              type="button"
              onClick={() => {
                setError(null);
                loadProducts();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:border-gray-300"
            >
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          {!user?.isSeller ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
              Product inventory controls are available only for seller-enabled vendor accounts.
            </div>
          ) : loadingProducts ? (
            <p className="text-sm text-gray-500">Loading products...</p>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
              No products found yet. Add products first, then manage stock here.
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
                const productKey = product._id;
                const baseQty = Number(productEdits[productKey] ?? 0);
                const isSavingBase = savingProductKey === productKey;

                return (
                  <div key={product._id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-xs text-gray-500">
                          {product.listingType === "rent" ? "Rental" : "Sale"} • {product.category}
                        </p>
                        {product.listingType === "rent" && (
                          <p className="text-xs text-gray-500">
                            Rate: ₹{Number(product.rentPriceDay ?? 0).toLocaleString()} / day
                          </p>
                        )}
                      </div>
                    </div>

                    {hasVariants ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">Variant</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600">Stock</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {product.variants.map((variant) => {
                              const variantId = String(variant._id || "");
                              const variantKey = `${product._id}:${variantId}`;
                              const variantStock = Number(variantEdits[variantKey] ?? 0);
                              const isSavingVariant = savingProductKey === variantKey;

                              return (
                                <tr key={variantKey}>
                                  <td className="px-4 py-2 text-gray-700">
                                    {(variant.color || "-") + " / " + (variant.size || "-")}
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={variantStock}
                                      onChange={(e) =>
                                        setVariantEdits((prev) => ({
                                          ...prev,
                                          [variantKey]: Math.max(0, Number(e.target.value) || 0),
                                        }))
                                      }
                                      className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveProductInventory(product, variantId)}
                                      disabled={isSavingVariant}
                                      className="inline-flex items-center rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                    >
                                      {isSavingVariant ? "Saving..." : "Save"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-sm text-gray-700 space-y-1">
                          <span className="font-medium">
                            {product.listingType === "rent" ? "Rental Quantity" : "Stock"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={baseQty}
                            onChange={(e) =>
                              setProductEdits((prev) => ({
                                ...prev,
                                [productKey]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleSaveProductInventory(product)}
                          disabled={isSavingBase}
                          className="inline-flex items-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {isSavingBase ? "Saving..." : "Save Inventory"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab !== "stays" && activeTab !== "products" && (
        <section className="rounded-3xl bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {activeTab === "tours"
                ? "Tours Inventory"
                : activeTab === "adventures"
                  ? "Adventures Inventory"
                  : "Vehicle Rental Inventory"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (activeTab === "tours") {
                  loadTours();
                  if (selectedTourId) {
                    loadAvailability("tour", selectedTourId);
                    loadServiceBlocks("tour", selectedTourId);
                  }
                }
                if (activeTab === "adventures") {
                  loadAdventures();
                  if (selectedAdventureId) {
                    loadAvailability("adventure", selectedAdventureId);
                    loadServiceBlocks("adventure", selectedAdventureId);
                  }
                }
                if (activeTab === "vehicles") {
                  loadVehicles();
                  if (selectedVehicleId) {
                    loadAvailability("vehicle", selectedVehicleId);
                    loadServiceBlocks("vehicle", selectedVehicleId);
                  }
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:border-gray-300"
            >
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">
                {activeTab === "tours" ? "Tour" : activeTab === "adventures" ? "Adventure" : "Vehicle Listing"}
              </span>
              <select
                value={
                  activeTab === "tours"
                    ? selectedTourId
                    : activeTab === "adventures"
                      ? selectedAdventureId
                      : selectedVehicleId
                }
                onChange={(e) => {
                  if (activeTab === "tours") setSelectedTourId(e.target.value);
                  if (activeTab === "adventures") setSelectedAdventureId(e.target.value);
                  if (activeTab === "vehicles") setSelectedVehicleId(e.target.value);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {(activeTab === "tours" ? tours : activeTab === "adventures" ? adventures : vehicles).map(
                  (record: any) => (
                    <option key={record._id} value={record._id}>
                      {record.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Start Date</span>
              <input
                type="date"
                value={inspectStartDate}
                onChange={(e) => setInspectStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">End Date</span>
              <input
                type="date"
                value={inspectEndDate}
                onChange={(e) => setInspectEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
          </div>

          {((activeTab === "tours" && loadingTours) ||
            (activeTab === "adventures" && loadingAdventures) ||
            (activeTab === "vehicles" && loadingVehicles)) && (
            <p className="text-sm text-gray-500">Loading listings...</p>
          )}

          <form onSubmit={handleCreateServiceBlock} className="grid gap-4 rounded-2xl border border-gray-200 p-4 md:grid-cols-3">
            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Option</span>
              <select
                value={
                  activeTab === "tours"
                    ? selectedTourOptionId
                    : activeTab === "adventures"
                      ? selectedAdventureOptionId
                      : selectedVehicleOptionId
                }
                onChange={(e) => {
                  if (activeTab === "tours") setSelectedTourOptionId(e.target.value);
                  if (activeTab === "adventures") setSelectedAdventureOptionId(e.target.value);
                  if (activeTab === "vehicles") setSelectedVehicleOptionId(e.target.value);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {(activeTab === "tours"
                  ? selectedTour?.options || []
                  : activeTab === "adventures"
                    ? selectedAdventure?.options || []
                    : selectedVehicle?.options || []
                ).map((option: any) => (
                  <option key={String(option?._id || option?.name || option?.model)} value={String(option?._id || "")}>
                    {activeTab === "vehicles" ? option?.model : option?.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Block Start Date</span>
              <input
                type="date"
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Block End Date</span>
              <input
                type="date"
                value={serviceEndDate}
                onChange={(e) => setServiceEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1">
              <span className="font-medium">Blocked Capacity</span>
              <input
                type="number"
                min={1}
                max={activeServiceMaxBlock}
                value={serviceBlockedCount}
                onChange={(e) => setServiceBlockedCount(Number(e.target.value || 1))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="text-sm text-gray-700 space-y-1 md:col-span-2">
              <span className="font-medium">Reason (optional)</span>
              <input
                type="text"
                value={serviceReason}
                onChange={(e) => setServiceReason(e.target.value)}
                placeholder="Example: Vendor hold / operational maintenance"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingServiceBlock}
                className="inline-flex items-center rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60"
              >
                {savingServiceBlock ? "Saving..." : "Add Block"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Option</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Base Inventory</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Remaining</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {(activeTab === "tours"
                  ? selectedTour?.options || []
                  : activeTab === "adventures"
                    ? selectedAdventure?.options || []
                    : selectedVehicle?.options || []
                ).map((option: any) => {
                  const optionKey = option?._id || option?.name || option?.model;
                  const sourceAvailability =
                    activeTab === "tours"
                      ? tourAvailability
                      : activeTab === "adventures"
                        ? adventureAvailability
                        : vehicleAvailability;
                  const remaining = Number(
                    sourceAvailability?.availableOptionQuantities?.[optionKey] ??
                      option?.available ??
                      (activeTab === "tours" ? option?.capacity ?? 0 : 0)
                  );
                  const isPackageTour =
                    activeTab === "tours" && selectedTour?.category === "tour-packages";

                  return (
                    <tr key={optionKey}>
                      <td className="px-4 py-3 text-gray-700">
                        {activeTab === "vehicles" ? option.model : option.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {activeTab === "tours"
                          ? isPackageTour
                            ? "Exclusive package"
                            : Number(option?.capacity || 0)
                          : Number(option?.available || 0)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{remaining}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            remaining > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {remaining > 0 ? "Available" : "Sold out"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="rounded-2xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">Current Blocks</h3>
              {(activeTab === "tours" && loadingTourBlocks) ||
              (activeTab === "adventures" && loadingAdventureBlocks) ||
              (activeTab === "vehicles" && loadingVehicleBlocks) ? (
                <p className="text-xs text-gray-500">Loading blocks...</p>
              ) : null}
            </div>

            {activeServiceBlocks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                No blocks created for this listing yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Option</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Date Range</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Blocked</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Reason</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {activeServiceBlocks.map((block) => (
                      <tr key={block._id}>
                        <td className="px-4 py-3 text-gray-700">{block.optionName}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(block.startDate).toLocaleDateString()} - {new Date(block.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{block.blockedCount}</td>
                        <td className="px-4 py-3 text-gray-600">{block.reason || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteServiceBlock(block._id)}
                            disabled={deletingServiceBlockId === block._id}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {deletingServiceBlockId === block._id ? "Removing..." : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(activeTab === "tours" && loadingTourAvailability) ||
          (activeTab === "adventures" && loadingAdventureAvailability) ||
          (activeTab === "vehicles" && loadingVehicleAvailability) ? (
            <p className="text-xs text-gray-500">Checking remaining inventory for selected dates...</p>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default InventoryManagementPage;

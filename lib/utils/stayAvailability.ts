import Booking from "@/models/Booking";
import StayRoomBlock from "@/models/StayRoomBlock";

type StayRoomSnapshot = {
  _id?: { toString(): string } | string;
  name: string;
  available: number;
};

type ComputeStayRoomAvailabilityParams = {
  stayId: string;
  rooms: StayRoomSnapshot[];
  startDate: Date;
  endDate: Date;
};

export type StayRoomAvailabilityResult = {
  availableOptionKeys: string[];
  availableOptionQuantities: Record<string, number>;
};

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "completed"];

const toDateOnlyKey = (value: Date) => value.toISOString().slice(0, 10);

const clampToRange = (date: Date, minDate: Date, maxDate: Date) => {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
};

const enumerateDateKeys = (startDate: Date, endDate: Date) => {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (cursor < end) {
    keys.push(toDateOnlyKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const getOrCreateNestedMap = (
  root: Map<string, Map<string, number>>,
  key: string
): Map<string, number> => {
  const existing = root.get(key);
  if (existing) return existing;
  const map = new Map<string, number>();
  root.set(key, map);
  return map;
};

const addCountByDate = (
  accumulator: Map<string, Map<string, number>>,
  roomKey: string,
  startDate: Date,
  endDate: Date,
  amount: number,
  rangeStart: Date,
  rangeEnd: Date
) => {
  if (!roomKey || amount <= 0) return;

  const overlapStart = clampToRange(startDate, rangeStart, rangeEnd);
  const overlapEnd = clampToRange(endDate, rangeStart, rangeEnd);
  if (overlapStart >= overlapEnd) return;

  const keys = enumerateDateKeys(overlapStart, overlapEnd);
  const roomMap = getOrCreateNestedMap(accumulator, roomKey);

  keys.forEach((key) => {
    roomMap.set(key, (roomMap.get(key) || 0) + amount);
  });
};

export async function computeStayRoomAvailability(
  params: ComputeStayRoomAvailabilityParams
): Promise<StayRoomAvailabilityResult> {
  const { stayId, rooms, startDate, endDate } = params;

  const [overlappingBookings, overlappingBlocks] = await Promise.all([
    Booking.find(
      {
        stayId,
        status: { $in: ACTIVE_BOOKING_STATUSES },
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate },
      },
      "checkIn checkOut rooms.roomId rooms.roomName rooms.quantity"
    ).lean(),
    StayRoomBlock.find(
      {
        stayId,
        isActive: true,
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      },
      "roomId roomName blockedCount startDate endDate"
    ).lean(),
  ]);

  const bookedByRoomDate = new Map<string, Map<string, number>>();
  const blockedByRoomDate = new Map<string, Map<string, number>>();

  overlappingBookings.forEach((booking: any) => {
    if (!booking?.checkIn || !booking?.checkOut || !Array.isArray(booking.rooms)) return;

    booking.rooms.forEach((room: any) => {
      const quantity = Number(room?.quantity || 1);
      const roomIdKey = room?.roomId?.toString?.();
      const roomNameKey = typeof room?.roomName === "string" ? room.roomName : "";

      if (roomIdKey) {
        addCountByDate(
          bookedByRoomDate,
          roomIdKey,
          new Date(booking.checkIn),
          new Date(booking.checkOut),
          quantity,
          startDate,
          endDate
        );
      }

      if (roomNameKey && roomNameKey !== roomIdKey) {
        addCountByDate(
          bookedByRoomDate,
          roomNameKey,
          new Date(booking.checkIn),
          new Date(booking.checkOut),
          quantity,
          startDate,
          endDate
        );
      }
    });
  });

  overlappingBlocks.forEach((block: any) => {
    const blockedCount = Number(block?.blockedCount || 1);
    const roomIdKey = block?.roomId?.toString?.();
    const roomNameKey = typeof block?.roomName === "string" ? block.roomName : "";

    if (roomIdKey) {
      addCountByDate(
        blockedByRoomDate,
        roomIdKey,
        new Date(block.startDate),
        new Date(block.endDate),
        blockedCount,
        startDate,
        endDate
      );
    }

    if (roomNameKey && roomNameKey !== roomIdKey) {
      addCountByDate(
        blockedByRoomDate,
        roomNameKey,
        new Date(block.startDate),
        new Date(block.endDate),
        blockedCount,
        startDate,
        endDate
      );
    }
  });

  const dateKeys = enumerateDateKeys(startDate, endDate);
  const availableOptionKeys: string[] = [];
  const availableOptionQuantities: Record<string, number> = {};

  rooms.forEach((room) => {
    const roomKey = room?._id?.toString?.() || room?.name;
    const totalInventory = Math.max(0, Number(room?.available || 0));
    if (!roomKey) return;

    let minRemaining = totalInventory;

    dateKeys.forEach((dateKey) => {
      const booked = bookedByRoomDate.get(roomKey)?.get(dateKey) || 0;
      const blocked = blockedByRoomDate.get(roomKey)?.get(dateKey) || 0;
      const remaining = Math.max(0, totalInventory - booked - blocked);
      if (remaining < minRemaining) {
        minRemaining = remaining;
      }
    });

    availableOptionQuantities[roomKey] = minRemaining;
    if (minRemaining > 0) {
      availableOptionKeys.push(roomKey);
    }
  });

  return {
    availableOptionKeys,
    availableOptionQuantities,
  };
}

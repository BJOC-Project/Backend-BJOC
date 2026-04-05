import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../database/db";
import { passengerTrips, stops } from "../../database/schema";

const pickupStops = alias(stops, "lifecycle_pickup_stop");
const dropoffStops = alias(stops, "lifecycle_dropoff_stop");

const PENDING_PASSENGER_STATUSES = ["booked", "waiting"] as const;

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PassengerLifecycleStatus = "booked" | "waiting" | "onboard" | "completed" | "cancelled";

export interface PassengerLifecycleBooking {
  createdAt: Date;
  dropoffStopOrder: number | null;
  id: string;
  pickupStopOrder: number | null;
  status: PassengerLifecycleStatus;
}

function compareLifecycleBookings(
  left: PassengerLifecycleBooking,
  right: PassengerLifecycleBooking,
) {
  const leftPickupOrder = left.pickupStopOrder ?? Number.MAX_SAFE_INTEGER;
  const rightPickupOrder = right.pickupStopOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftPickupOrder !== rightPickupOrder) {
    return leftPickupOrder - rightPickupOrder;
  }

  const leftDropoffOrder = left.dropoffStopOrder ?? Number.MAX_SAFE_INTEGER;
  const rightDropoffOrder = right.dropoffStopOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftDropoffOrder !== rightDropoffOrder) {
    return leftDropoffOrder - rightDropoffOrder;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

function cloneLifecycleBookings(bookings: PassengerLifecycleBooking[]) {
  return bookings
    .map((booking) => ({
      ...booking,
      createdAt: new Date(booking.createdAt),
    }))
    .sort(compareLifecycleBookings);
}

function isPendingPassengerStatus(status: PassengerLifecycleStatus): status is typeof PENDING_PASSENGER_STATUSES[number] {
  return status === "booked" || status === "waiting";
}

function clampPassengerCount(input: number | null | undefined) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return null;
  }

  return Math.max(0, Math.floor(input));
}

export function reconcileOngoingPassengerLifecycle(
  bookings: PassengerLifecycleBooking[],
  currentStopOrder: number,
  options?: {
    currentPassengerCount?: number | null;
  },
) {
  const resolvedBookings = cloneLifecycleBookings(bookings);
  const currentPassengerCount = clampPassengerCount(options?.currentPassengerCount);

  for (const booking of resolvedBookings) {
    if (
      booking.status === "onboard" &&
      typeof booking.dropoffStopOrder === "number" &&
      booking.dropoffStopOrder <= currentStopOrder
    ) {
      booking.status = "completed";
    }
  }

  if (currentPassengerCount !== null) {
    const activeOnboardBookings = resolvedBookings.filter((booking) =>
      booking.status === "onboard" &&
      typeof booking.pickupStopOrder === "number" &&
      booking.pickupStopOrder <= currentStopOrder &&
      (booking.dropoffStopOrder === null || booking.dropoffStopOrder > currentStopOrder)
    );
    const currentOnboardCount = activeOnboardBookings.length;

    if (currentOnboardCount > currentPassengerCount) {
      const bookingsToDemote = [...activeOnboardBookings]
        .sort((left, right) => compareLifecycleBookings(right, left))
        .slice(0, currentOnboardCount - currentPassengerCount);

      for (const booking of bookingsToDemote) {
        booking.status = "waiting";
      }
    }

    if (currentOnboardCount < currentPassengerCount) {
      const onboardingCandidates = resolvedBookings.filter((booking) =>
        isPendingPassengerStatus(booking.status) &&
        typeof booking.pickupStopOrder === "number" &&
        booking.pickupStopOrder <= currentStopOrder &&
        (booking.dropoffStopOrder === null || booking.dropoffStopOrder > currentStopOrder)
      );

      for (const booking of onboardingCandidates.slice(0, currentPassengerCount - currentOnboardCount)) {
        booking.status = "onboard";
      }
    }
  }

  for (const booking of resolvedBookings) {
    if (!isPendingPassengerStatus(booking.status)) {
      continue;
    }

    if (typeof booking.pickupStopOrder !== "number") {
      booking.status = "booked";
      continue;
    }

    if (booking.pickupStopOrder > currentStopOrder) {
      booking.status = "booked";
      continue;
    }

    if (booking.pickupStopOrder === currentStopOrder) {
      booking.status = "waiting";
      continue;
    }

    booking.status = currentPassengerCount !== null
      ? "cancelled"
      : "waiting";
  }

  return resolvedBookings;
}

export function finalizeCompletedTripPassengerLifecycle(
  bookings: PassengerLifecycleBooking[],
  totalPassengerCount: number,
) {
  const resolvedBookings = cloneLifecycleBookings(bookings);

  for (const booking of resolvedBookings) {
    if (booking.status === "onboard") {
      booking.status = "completed";
    }
  }

  let completedBookedPassengerCount = resolvedBookings.filter((booking) => booking.status === "completed").length;
  const desiredCompletedBookedCount = Math.min(
    Math.max(0, Math.floor(totalPassengerCount)),
    resolvedBookings.length,
  );

  if (completedBookedPassengerCount < desiredCompletedBookedCount) {
    const fallbackCandidates = resolvedBookings.filter((booking) => isPendingPassengerStatus(booking.status));

    for (const booking of fallbackCandidates.slice(0, desiredCompletedBookedCount - completedBookedPassengerCount)) {
      booking.status = "completed";
    }

    completedBookedPassengerCount = resolvedBookings.filter((booking) => booking.status === "completed").length;
  }

  for (const booking of resolvedBookings) {
    if (isPendingPassengerStatus(booking.status)) {
      booking.status = "cancelled";
    }
  }

  return {
    completedBookedPassengerCount,
    resolvedBookings,
    resolvedPassengerCount: Math.max(totalPassengerCount, completedBookedPassengerCount),
  };
}

export function finalizeCancelledTripPassengerLifecycle(
  bookings: PassengerLifecycleBooking[],
  currentPassengerCount: number,
) {
  const resolvedBookings = cloneLifecycleBookings(bookings);
  const boardedPassengerCount = resolvedBookings.filter((booking) =>
    booking.status === "completed" || booking.status === "onboard"
  ).length;

  for (const booking of resolvedBookings) {
    if (booking.status === "onboard" || isPendingPassengerStatus(booking.status)) {
      booking.status = "cancelled";
    }
  }

  return {
    boardedPassengerCount,
    resolvedBookings,
    resolvedPassengerCount: Math.max(currentPassengerCount, boardedPassengerCount),
  };
}

async function getCurrentStopOrder(
  executor: DbExecutor,
  currentStopId: string,
) {
  const [currentStopRow] = await executor
    .select({
      stopOrder: stops.stopOrder,
    })
    .from(stops)
    .where(eq(stops.id, currentStopId))
    .limit(1);

  return currentStopRow?.stopOrder ?? null;
}

async function loadTripPassengerLifecycleBookings(
  executor: DbExecutor,
  tripId: string,
) {
  return executor
    .select({
      createdAt: passengerTrips.createdAt,
      dropoffStopOrder: dropoffStops.stopOrder,
      id: passengerTrips.id,
      pickupStopOrder: pickupStops.stopOrder,
      status: passengerTrips.status,
    })
    .from(passengerTrips)
    .leftJoin(pickupStops, eq(passengerTrips.pickupStopId, pickupStops.id))
    .leftJoin(dropoffStops, eq(passengerTrips.dropoffStopId, dropoffStops.id))
    .where(eq(passengerTrips.tripId, tripId));
}

async function applyPassengerLifecycleUpdates(
  executor: DbExecutor,
  originalBookings: PassengerLifecycleBooking[],
  resolvedBookings: PassengerLifecycleBooking[],
) {
  const originalStatusById = new Map(
    originalBookings.map((booking) => [
      booking.id,
      booking.status,
    ]),
  );

  for (const booking of resolvedBookings) {
    if (originalStatusById.get(booking.id) === booking.status) {
      continue;
    }

    await executor
      .update(passengerTrips)
      .set({
        status: booking.status,
      })
      .where(eq(passengerTrips.id, booking.id));
  }
}

export async function syncTripPassengerLifecycle(
  executor: DbExecutor,
  input: {
    currentPassengerCount?: number | null;
    currentStopId: string | null;
    tripId: string;
  },
) {
  if (!input.currentStopId) {
    return;
  }

  const currentStopOrder = await getCurrentStopOrder(executor, input.currentStopId);

  if (currentStopOrder === null) {
    return;
  }

  const originalBookings = await loadTripPassengerLifecycleBookings(executor, input.tripId);
  const resolvedBookings = reconcileOngoingPassengerLifecycle(
    originalBookings,
    currentStopOrder,
    {
      currentPassengerCount: input.currentPassengerCount ?? null,
    },
  );

  await applyPassengerLifecycleUpdates(executor, originalBookings, resolvedBookings);
}

export async function finalizeCompletedTripPassengers(
  executor: DbExecutor,
  input: {
    totalPassengerCount: number;
    tripId: string;
  },
) {
  const originalBookings = await loadTripPassengerLifecycleBookings(executor, input.tripId);
  const resolvedState = finalizeCompletedTripPassengerLifecycle(
    originalBookings,
    Math.max(0, Math.floor(input.totalPassengerCount)),
  );

  await applyPassengerLifecycleUpdates(executor, originalBookings, resolvedState.resolvedBookings);

  return resolvedState;
}

export async function finalizeCancelledTripPassengers(
  executor: DbExecutor,
  input: {
    currentPassengerCount: number;
    tripId: string;
  },
) {
  const originalBookings = await loadTripPassengerLifecycleBookings(executor, input.tripId);
  const resolvedState = finalizeCancelledTripPassengerLifecycle(
    originalBookings,
    Math.max(0, Math.floor(input.currentPassengerCount)),
  );

  await applyPassengerLifecycleUpdates(executor, originalBookings, resolvedState.resolvedBookings);

  return resolvedState;
}

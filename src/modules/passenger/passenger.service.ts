import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import {
  passengerTrips,
  stops,
  transitRoutes,
  trips,
  users,
  vehicles,
} from "../../database/schema";
import { NotFoundError } from "../../errors/app-error";
import { usersFindUserProfileById } from "../users/users.service";

const pickupStops = alias(stops, "pickup_stop");
const dropoffStops = alias(stops, "dropoff_stop");
const driverUsers = alias(users, "driver_user");

type PassengerBookingStatus = "booked" | "waiting" | "onboard" | "completed" | "cancelled";
type BackendTripStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
type PassengerTripStatus = "active" | "booked" | "cancelled" | "completed" | "onboard" | "waiting";

interface PassengerTripRow {
  bookingCreatedAt: Date;
  bookingId: string;
  bookingStatus: PassengerBookingStatus;
  driverFirstName: string | null;
  driverLastName: string | null;
  dropoffName: string | null;
  fare: number | null;
  pickupName: string | null;
  routeEnd: string | null;
  routeId: string;
  routeStart: string | null;
  scheduledDepartureTime: Date;
  tripId: string;
  tripStatus: BackendTripStatus;
  vehiclePlateNumber: string | null;
}

interface PassengerTripSummary {
  bookingId: string;
  driverName?: string;
  fare: number;
  id: string;
  isFavorite?: boolean;
  pickup: string;
  progressLabel: string;
  routeId: string;
  routeName: string;
  schedule: string;
  status: PassengerTripStatus;
  tripId: string;
  vehicleCode?: string;
}

function buildRouteName(
  startLocation: string | null,
  endLocation: string | null,
) {
  return `${startLocation ?? "Unknown origin"} -> ${endLocation ?? "Unknown destination"}`;
}

function buildDriverName(
  firstName: string | null,
  lastName: string | null,
) {
  const value = [firstName, lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();

  if (value.length === 0) {
    return undefined;
  }

  return value;
}

function resolvePassengerTripStatus(
  bookingStatus: PassengerBookingStatus,
  tripStatus: BackendTripStatus,
): PassengerTripStatus {
  if (bookingStatus === "cancelled" || tripStatus === "cancelled") {
    return "cancelled";
  }

  if (bookingStatus === "completed" || tripStatus === "completed") {
    return "completed";
  }

  if (bookingStatus === "onboard") {
    return "onboard";
  }

  if (bookingStatus === "waiting") {
    return "waiting";
  }

  if (tripStatus === "ongoing") {
    return "active";
  }

  return "booked";
}

function buildProgressLabel(
  status: PassengerTripStatus,
  row: PassengerTripRow,
) {
  if (status === "cancelled") {
    return "This booking has been cancelled.";
  }

  if (status === "completed") {
    return "Trip completed successfully.";
  }

  if (status === "onboard") {
    return "You are currently on board this trip.";
  }

  if (status === "waiting") {
    return `Proceed to ${row.pickupName ?? "your boarding stop"} and wait for the jeepney.`;
  }

  if (status === "active") {
    return "This trip is currently in progress.";
  }

  return "Booking confirmed for your upcoming trip.";
}

function mapPassengerTripSummary(
  row: PassengerTripRow,
  options?: {
    isFavorite?: boolean;
  },
): PassengerTripSummary {
  const status = resolvePassengerTripStatus(row.bookingStatus, row.tripStatus);
  const driverName = buildDriverName(row.driverFirstName, row.driverLastName);

  return {
    bookingId: row.bookingId,
    fare: row.fare ?? 0,
    id: row.bookingId,
    ...(options?.isFavorite ? { isFavorite: true } : {}),
    pickup: row.pickupName ?? "Unknown pickup",
    progressLabel: buildProgressLabel(status, row),
    routeId: row.routeId,
    routeName: buildRouteName(row.routeStart, row.routeEnd),
    schedule: row.scheduledDepartureTime.toISOString(),
    status,
    tripId: row.tripId,
    ...(driverName ? { driverName } : {}),
    ...(row.vehiclePlateNumber ? { vehicleCode: row.vehiclePlateNumber } : {}),
  };
}

function buildFavoriteTrips(rows: PassengerTripRow[]) {
  const groupedTrips = new Map<
    string,
    {
      count: number;
      latestRow: PassengerTripRow;
    }
  >();

  for (const row of rows) {
    const signature = [
      row.routeId,
      row.pickupName ?? "unknown-pickup",
      row.dropoffName ?? "unknown-dropoff",
    ].join(":");
    const existingEntry = groupedTrips.get(signature);

    if (!existingEntry) {
      groupedTrips.set(signature, {
        count: 1,
        latestRow: row,
      });
      continue;
    }

    const shouldReplaceLatest =
      row.scheduledDepartureTime.getTime() > existingEntry.latestRow.scheduledDepartureTime.getTime();

    groupedTrips.set(signature, {
      count: existingEntry.count + 1,
      latestRow: shouldReplaceLatest ? row : existingEntry.latestRow,
    });
  }

  const rankedTrips = Array.from(groupedTrips.values()).sort((
    left,
    right,
  ) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return right.latestRow.scheduledDepartureTime.getTime() - left.latestRow.scheduledDepartureTime.getTime();
  });

  const repeatedTrips = rankedTrips.filter((entry) => entry.count > 1);
  const favoriteCandidates = repeatedTrips.length > 0
    ? repeatedTrips
    : rankedTrips.slice(0, 3);

  return favoriteCandidates.map((entry) =>
    mapPassengerTripSummary(entry.latestRow, { isFavorite: true }),
  );
}

async function queryPassengerTrips(passengerUserId: string) {
  return db
    .select({
      bookingCreatedAt: passengerTrips.createdAt,
      bookingId: passengerTrips.id,
      bookingStatus: passengerTrips.status,
      driverFirstName: driverUsers.firstName,
      driverLastName: driverUsers.lastName,
      dropoffName: dropoffStops.stopName,
      fare: passengerTrips.fare,
      pickupName: pickupStops.stopName,
      routeEnd: transitRoutes.endLocation,
      routeId: transitRoutes.id,
      routeStart: transitRoutes.startLocation,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      tripId: trips.id,
      tripStatus: trips.status,
      vehiclePlateNumber: vehicles.plateNumber,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(pickupStops, eq(passengerTrips.pickupStopId, pickupStops.id))
    .leftJoin(dropoffStops, eq(passengerTrips.dropoffStopId, dropoffStops.id))
    .leftJoin(driverUsers, eq(trips.driverUserId, driverUsers.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(eq(passengerTrips.passengerUserId, passengerUserId))
    .orderBy(desc(trips.scheduledDepartureTime), desc(passengerTrips.createdAt));
}

async function queryPassengerTripById(
  passengerUserId: string,
  tripId: string,
) {
  const [row] = await db
    .select({
      bookingCreatedAt: passengerTrips.createdAt,
      bookingId: passengerTrips.id,
      bookingStatus: passengerTrips.status,
      driverFirstName: driverUsers.firstName,
      driverLastName: driverUsers.lastName,
      dropoffName: dropoffStops.stopName,
      fare: passengerTrips.fare,
      pickupName: pickupStops.stopName,
      routeEnd: transitRoutes.endLocation,
      routeId: transitRoutes.id,
      routeStart: transitRoutes.startLocation,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      tripId: trips.id,
      tripStatus: trips.status,
      vehiclePlateNumber: vehicles.plateNumber,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(pickupStops, eq(passengerTrips.pickupStopId, pickupStops.id))
    .leftJoin(dropoffStops, eq(passengerTrips.dropoffStopId, dropoffStops.id))
    .leftJoin(driverUsers, eq(trips.driverUserId, driverUsers.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(passengerTrips.passengerUserId, passengerUserId),
        eq(passengerTrips.id, tripId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Passenger trip not found");
  }

  return row;
}

export function passengerViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}

export async function passengerListTrips(userId: string) {
  const rows = await queryPassengerTrips(userId);

  logger.info({
    msg: "Passenger trips loaded",
    passengerUserId: userId,
    totalTrips: rows.length,
  });

  return rows.map((row) => mapPassengerTripSummary(row));
}

export async function passengerListRecentTrips(userId: string) {
  const rows = await queryPassengerTrips(userId);
  const recentTrips = rows
    .slice(0, 5)
    .map((row) => mapPassengerTripSummary(row));

  logger.info({
    msg: "Passenger recent trips loaded",
    passengerUserId: userId,
    totalTrips: recentTrips.length,
  });

  return recentTrips;
}

export async function passengerListFavoriteTrips(userId: string) {
  const rows = await queryPassengerTrips(userId);
  const favoriteTrips = buildFavoriteTrips(rows);

  logger.info({
    msg: "Passenger favorite trips loaded",
    passengerUserId: userId,
    totalTrips: favoriteTrips.length,
  });

  return favoriteTrips;
}

export async function passengerViewTripById(
  userId: string,
  tripId: string,
) {
  const row = await queryPassengerTripById(userId, tripId);

  logger.info({
    msg: "Passenger trip detail loaded",
    passengerUserId: userId,
    passengerTripId: tripId,
  });

  return mapPassengerTripSummary(row);
}

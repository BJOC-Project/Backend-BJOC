import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import {
  gpsLogs,
  passengerTrips,
  stops,
  transitRoutes,
  trips,
  users,
  vehicleLocations,
  vehicles,
} from "../../database/schema";
import { NotFoundError } from "../../errors/app-error";
import { usersFindUserProfileById } from "../users/users.service";
import {
  buildPassengerStopProgress,
  estimatePassengerEtaMinutes,
  estimateRemainingRouteDistanceKm,
  haversineDistanceKm,
  resolvePassengerTrackingTarget,
  type PassengerTrackingBookingStatus,
  type PassengerTrackingGpsPoint,
  type PassengerTrackingRouteStop,
  type PassengerTrackingStopProgress,
  type PassengerTrackingTarget,
  type PassengerTrackingTripStatus,
} from "./passenger-trip-tracking.utils";

const pickupStops = alias(stops, "pickup_stop");
const dropoffStops = alias(stops, "dropoff_stop");
const driverUsers = alias(users, "driver_user");

type PassengerBookingStatus = PassengerTrackingBookingStatus;
type BackendTripStatus = PassengerTrackingTripStatus;
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
  dropoff: string;
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

interface PassengerTripDetailRow extends PassengerTripRow {
  currentStopId: string | null;
  dropoffStopId: string | null;
  pickupStopId: string | null;
  routeName: string | null;
  tripEndTime: Date | null;
  tripStartTime: Date | null;
  vehicleId: string | null;
  vehicleLocationLatitude: number | null;
  vehicleLocationLongitude: number | null;
  vehicleLocationUpdatedAt: Date | null;
}

interface PassengerTripDetail {
  bookingId: string;
  distanceKm?: number;
  distanceToTargetKm?: number;
  driverName?: string;
  dropoff: string;
  estimatedMinutes?: number;
  etaMinutes: number | null;
  fare: number;
  id: string;
  pickup: string;
  progressLabel: string;
  routeId: string;
  routeName: string;
  schedule: string;
  status: PassengerTripStatus;
  stops: Array<{
    id: string;
    isDropoff: boolean;
    isPickup: boolean;
    passedAt: string | null;
    scheduledTime: string;
    status: PassengerTrackingStopProgress["status"];
    stopName: string;
  }>;
  targetStopLabel: string | null;
  trackingTarget: PassengerTrackingTarget | null;
  tripId: string;
  vehicleCode?: string;
  vehicleLocation: {
    latitude: number;
    longitude: number;
    updatedAt: string | null;
  } | null;
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
    dropoff: row.dropoffName ?? "Unknown destination",
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
) : Promise<PassengerTripDetailRow> {
  const [row] = await db
    .select({
      currentStopId: vehicleLocations.currentStopId,
      bookingCreatedAt: passengerTrips.createdAt,
      bookingId: passengerTrips.id,
      bookingStatus: passengerTrips.status,
      driverFirstName: driverUsers.firstName,
      driverLastName: driverUsers.lastName,
      dropoffName: dropoffStops.stopName,
      dropoffStopId: passengerTrips.dropoffStopId,
      fare: passengerTrips.fare,
      pickupName: pickupStops.stopName,
      pickupStopId: passengerTrips.pickupStopId,
      routeEnd: transitRoutes.endLocation,
      routeId: transitRoutes.id,
      routeName: transitRoutes.routeName,
      routeStart: transitRoutes.startLocation,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      tripEndTime: trips.endTime,
      tripId: trips.id,
      tripStartTime: trips.startTime,
      tripStatus: trips.status,
      vehicleId: trips.vehicleId,
      vehicleLocationLatitude: vehicleLocations.latitude,
      vehicleLocationLongitude: vehicleLocations.longitude,
      vehicleLocationUpdatedAt: vehicleLocations.updatedAt,
      vehiclePlateNumber: vehicles.plateNumber,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(pickupStops, eq(passengerTrips.pickupStopId, pickupStops.id))
    .leftJoin(dropoffStops, eq(passengerTrips.dropoffStopId, dropoffStops.id))
    .leftJoin(driverUsers, eq(trips.driverUserId, driverUsers.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(vehicleLocations, eq(vehicleLocations.vehicleId, trips.vehicleId))
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

async function listRouteStops(routeId: string) {
  return db
    .select({
      id: stops.id,
      latitude: stops.latitude,
      longitude: stops.longitude,
      stopName: stops.stopName,
      stopOrder: stops.stopOrder,
    })
    .from(stops)
    .where(
      and(
        eq(stops.routeId, routeId),
        eq(stops.isActive, true),
      ),
    )
    .orderBy(asc(stops.stopOrder));
}

async function listTripGpsPoints(input: {
  endAt: Date;
  startAt: Date;
  vehicleId: string | null;
}) : Promise<PassengerTrackingGpsPoint[]> {
  if (!input.vehicleId || input.endAt.getTime() < input.startAt.getTime()) {
    return [];
  }

  const rows = await db
    .select({
      latitude: gpsLogs.latitude,
      longitude: gpsLogs.longitude,
      recordedAt: gpsLogs.recordedAt,
    })
    .from(gpsLogs)
    .where(
      and(
        eq(gpsLogs.vehicleId, input.vehicleId),
        gte(gpsLogs.recordedAt, input.startAt),
        lte(gpsLogs.recordedAt, input.endAt),
      ),
    )
    .orderBy(asc(gpsLogs.recordedAt))
    .limit(600);

  return rows;
}

function roundDistanceKm(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value * 100) / 100;
}

function mapVehicleLocation(row: PassengerTripDetailRow) {
  if (
    typeof row.vehicleLocationLatitude !== "number" ||
    typeof row.vehicleLocationLongitude !== "number"
  ) {
    return null;
  }

  return {
    latitude: row.vehicleLocationLatitude,
    longitude: row.vehicleLocationLongitude,
    updatedAt: row.vehicleLocationUpdatedAt?.toISOString() ?? null,
  };
}

function mapPassengerTripDetailStop(
  stopRow: PassengerTrackingStopProgress,
) {
  return {
    id: stopRow.id,
    isDropoff: stopRow.isDropoff,
    isPickup: stopRow.isPickup,
    passedAt: stopRow.passedAt?.toISOString() ?? null,
    scheduledTime: stopRow.scheduledTime.toISOString(),
    status: stopRow.status,
    stopName: stopRow.stopName,
  };
}

function buildPassengerTripDetail(
  row: PassengerTripDetailRow,
  routeStops: PassengerTrackingRouteStop[],
  gpsPoints: PassengerTrackingGpsPoint[],
) : PassengerTripDetail {
  const summary = mapPassengerTripSummary(row);
  const currentStopOrder = row.currentStopId
    ? routeStops.find((stopRow) => stopRow.id === row.currentStopId)?.stopOrder ?? null
    : null;
  const trackingTarget = resolvePassengerTrackingTarget(row.bookingStatus, row.tripStatus);
  const targetStopId = trackingTarget === "dropoff"
    ? row.dropoffStopId
    : trackingTarget === "pickup"
      ? row.pickupStopId
      : null;
  const targetStop = targetStopId
    ? routeStops.find((stopRow) => stopRow.id === targetStopId) ?? null
    : null;
  const stopProgress = buildPassengerStopProgress({
    currentStopId: row.currentStopId,
    currentStopOrder,
    currentStopUpdatedAt: row.vehicleLocationUpdatedAt,
    dropoffStopId: row.dropoffStopId,
    gpsPoints,
    pickupStopId: row.pickupStopId,
    routeStops,
    scheduledDepartureTime: row.scheduledDepartureTime,
    tripStatus: row.tripStatus,
  });
  const etaMinutes = estimatePassengerEtaMinutes({
    currentLatitude: row.vehicleLocationLatitude,
    currentLongitude: row.vehicleLocationLongitude,
    currentStopOrder,
    routeStops,
    scheduledDepartureTime: row.scheduledDepartureTime,
    targetStopOrder: targetStop?.stopOrder ?? null,
    tripStatus: row.tripStatus,
  });
  const directDistanceKm = targetStop &&
    typeof targetStop.latitude === "number" &&
    typeof targetStop.longitude === "number" &&
    typeof row.vehicleLocationLatitude === "number" &&
    typeof row.vehicleLocationLongitude === "number"
    ? haversineDistanceKm(
      row.vehicleLocationLatitude,
      row.vehicleLocationLongitude,
      targetStop.latitude,
      targetStop.longitude,
      )
    : null;
  const remainingRouteDistanceKm = estimateRemainingRouteDistanceKm({
    currentLatitude: row.vehicleLocationLatitude,
    currentLongitude: row.vehicleLocationLongitude,
    currentStopOrder,
    routeStops,
    targetStopOrder: targetStop?.stopOrder ?? null,
  });
  const distanceKm = remainingRouteDistanceKm ?? directDistanceKm;

  return {
    ...summary,
    distanceKm: roundDistanceKm(distanceKm),
    distanceToTargetKm: roundDistanceKm(distanceKm),
    estimatedMinutes: typeof etaMinutes === "number" ? etaMinutes : undefined,
    etaMinutes,
    stops: stopProgress.map((stopRow) => mapPassengerTripDetailStop(stopRow)),
    targetStopLabel: targetStop?.stopName?.trim() || null,
    trackingTarget,
    vehicleLocation: mapVehicleLocation(row),
  };
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
  const routeStops = await listRouteStops(row.routeId);
  const trackingWindowStart = row.tripStartTime ?? row.scheduledDepartureTime;
  const trackingWindowEnd = row.tripEndTime ?? row.vehicleLocationUpdatedAt ?? new Date();
  const gpsPoints = await listTripGpsPoints({
    endAt: trackingWindowEnd,
    startAt: trackingWindowStart,
    vehicleId: row.vehicleId,
  });

  logger.info({
    msg: "Passenger trip detail loaded",
    passengerUserId: userId,
    passengerTripId: tripId,
  });

  return buildPassengerTripDetail(row, routeStops, gpsPoints);
}

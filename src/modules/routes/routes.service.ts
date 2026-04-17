import { and, asc, count, eq, gte, inArray, or, sql, type InferSelectModel } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import {
  passengerTrips,
  passengers,
  stops,
  transitRoutes,
  trips,
  users,
  vehicleLocations,
  vehicles,
} from "../../database/schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/app-error";
import { fetchLegDuration } from "../eta/mapbox-directions.service";
import {
  operationsCreateRoute,
  operationsDeleteRoute,
  operationsListRoutes,
  operationsPublishRoute,
  operationsUpdateRoute,
} from "../operations/operations.service";
import type {
  BookRouteBody,
  CreateRouteBody,
  PlanRouteQuery,
  UpdateRouteBody,
} from "./routes.validation";

const EARTH_RADIUS_KM = 6371;
const BASE_FARE = 15;
const FARE_STEP_KM = 1;
const FARE_STEP_AMOUNT = 5;
const AVG_SPEED_KPH = 18;
const ACTIVE_BOOKING_STATUSES = ["booked", "waiting", "onboard"] as const;

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type PassengerTripStatus = InferSelectModel<typeof passengerTrips>["status"];

interface StopRow {
  stopId: string;
  stopName: string | null;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
  routeId: string;
  routeName: string | null;
  routeStart: string | null;
  routeEnd: string | null;
}

interface BookableTripRow {
  id: string;
  currentStopId: string | null;
  currentStopOrder: number | null;
  driverFirstName: string | null;
  driverLastName: string | null;
  recordedPassengerCount: number | null;
  scheduledDepartureTime: Date;
  status: "scheduled" | "ongoing";
  tripDate: string;
  vehicleId: string | null;
  vehicleCode: string | null;
  vehicleLatitude: number | null;
  vehicleLongitude: number | null;
  seatCapacity: number | null;
}

interface JourneyStartPreview {
  label: string;
  latitude: number;
  longitude: number;
  scheduledDepartureTime: Date | null;
  source: "driver_location" | "first_stop";
  stopId: string | null;
  tripId: string | null;
  vehicleCode: string | null;
  vehicleId: string | null;
}

interface RouteMatch {
  routeId: string;
  routeName: string;
  boardingStop: StopRow;
  dropoffStop: StopRow;
  stopsInRange: StopRow[];
  distanceKm: number;
  originWalkKm: number;
  destWalkKm: number;
}

function toRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateFare(distanceKm: number) {
  const roundedDistanceKm = Math.max(1, Math.ceil(Math.max(0, distanceKm) / FARE_STEP_KM));
  return BASE_FARE + Math.max(0, roundedDistanceKm - 1) * FARE_STEP_AMOUNT;
}

async function calculateEtaMinutes(
  fromStop: { id: string; latitude: number | null; longitude: number | null },
  toStop:   { id: string; latitude: number | null; longitude: number | null },
  distanceKmFallback: number,
): Promise<number> {
  const haversineFallback = Math.max(5, Math.round((distanceKmFallback / AVG_SPEED_KPH) * 60));
  if (
    fromStop.latitude == null || fromStop.longitude == null ||
    toStop.latitude == null   || toStop.longitude == null
  ) {
    return haversineFallback;
  }
  const result = await fetchLegDuration(
    { id: fromStop.id, latitude: fromStop.latitude, longitude: fromStop.longitude },
    { id: toStop.id,   latitude: toStop.latitude,   longitude: toStop.longitude   },
  );
  if (result) return Math.round(result.durationSeconds / 60);
  return haversineFallback;
}

function buildRouteName(
  startLocation: string | null,
  endLocation: string | null,
) {
  return `${startLocation ?? "Start"} -> ${endLocation ?? "End"}`;
}

function buildRouteDisplayName(
  routeName: string | null,
  startLocation: string | null,
  endLocation: string | null,
) {
  const normalizedRouteName = routeName?.trim();

  return normalizedRouteName && normalizedRouteName.length > 0
    ? normalizedRouteName
    : buildRouteName(startLocation, endLocation);
}

function buildDriverName(
  firstName: string | null,
  lastName: string | null,
) {
  const value = [firstName, lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();

  return value.length > 0 ? value : null;
}

function buildStopLabel(stop: Pick<StopRow, "stopName" | "stopOrder">) {
  return stop.stopName?.trim() || `Stop ${stop.stopOrder}`;
}

function hasStopCoordinates(
  stop: StopRow,
): stop is StopRow & { latitude: number; longitude: number } {
  return typeof stop.latitude === "number" && typeof stop.longitude === "number";
}

function calculateRouteDistance(stopsInRange: StopRow[]) {
  let routeDistance = 0;

  for (let i = 1; i < stopsInRange.length; i += 1) {
    const prev = stopsInRange[i - 1];
    const curr = stopsInRange[i];

    if (
      prev.latitude !== null &&
      prev.longitude !== null &&
      curr.latitude !== null &&
      curr.longitude !== null
    ) {
      routeDistance += haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );
    }
  }

  return routeDistance;
}

function buildPolyline(stopsInRange: StopRow[]) {
  return stopsInRange
    .filter((stop) => stop.latitude !== null && stop.longitude !== null)
    .map((stop) => ({
      latitude: stop.latitude!,
      longitude: stop.longitude!,
    }));
}

function groupStopsByRoute(allStops: StopRow[]) {
  const routeGroups = new Map<string, StopRow[]>();

  for (const stop of allStops) {
    const existing = routeGroups.get(stop.routeId) ?? [];
    existing.push(stop);
    routeGroups.set(stop.routeId, existing);
  }

  return routeGroups;
}

function findRouteMatch(
  input: PlanRouteQuery,
  routeGroups: Map<string, StopRow[]>,
) {
  let bestMatch: RouteMatch | null = null;
  let bestScore = Infinity;

  for (const [routeId, routeStops] of routeGroups) {
    routeStops.sort((
      a,
      b,
    ) => a.stopOrder - b.stopOrder);

    let closestToOrigin: StopRow | null = null;
    let originDist = Infinity;

    for (const stop of routeStops) {
      if (stop.latitude === null || stop.longitude === null) {
        continue;
      }

      const dist = haversineDistance(
        input.originLat,
        input.originLng,
        stop.latitude,
        stop.longitude,
      );

      if (dist < originDist) {
        originDist = dist;
        closestToOrigin = stop;
      }
    }

    let closestToDest: StopRow | null = null;
    let destDist = Infinity;

    for (const stop of routeStops) {
      if (stop.latitude === null || stop.longitude === null) {
        continue;
      }

      const dist = haversineDistance(
        input.destLat,
        input.destLng,
        stop.latitude,
        stop.longitude,
      );

      if (dist < destDist) {
        destDist = dist;
        closestToDest = stop;
      }
    }

    if (!closestToOrigin || !closestToDest) {
      continue;
    }

    if (closestToOrigin.stopOrder >= closestToDest.stopOrder) {
      continue;
    }

    const stopsInRange = routeStops.filter(
      (stop) =>
        stop.stopOrder >= closestToOrigin!.stopOrder &&
        stop.stopOrder <= closestToDest!.stopOrder,
    );

    const routeDistance = calculateRouteDistance(stopsInRange);
    const score = originDist * 2 + destDist * 2 + routeDistance * 0.5;

    if (score < bestScore) {
      bestScore = score;
      bestMatch = {
        routeId,
        routeName: buildRouteDisplayName(
          closestToOrigin.routeName,
          closestToOrigin.routeStart,
          closestToDest.routeEnd,
        ),
        boardingStop: closestToOrigin,
        dropoffStop: closestToDest,
        stopsInRange,
        distanceKm: routeDistance,
        originWalkKm: originDist,
        destWalkKm: destDist,
      };
    }
  }

  return bestMatch;
}

async function getAllActiveStops() {
  return db
    .select({
      stopId: stops.id,
      stopName: stops.stopName,
      latitude: stops.latitude,
      longitude: stops.longitude,
      stopOrder: stops.stopOrder,
      routeId: stops.routeId,
      routeName: transitRoutes.routeName,
      routeStart: transitRoutes.startLocation,
      routeEnd: transitRoutes.endLocation,
    })
    .from(stops)
    .innerJoin(transitRoutes, eq(stops.routeId, transitRoutes.id))
    .where(and(eq(stops.isActive, true), eq(transitRoutes.isActive, true)));
}

async function getActiveRouteStops(routeId: string) {
  return db
    .select({
      stopId: stops.id,
      stopName: stops.stopName,
      latitude: stops.latitude,
      longitude: stops.longitude,
      stopOrder: stops.stopOrder,
      routeId: stops.routeId,
      routeName: transitRoutes.routeName,
      routeStart: transitRoutes.startLocation,
      routeEnd: transitRoutes.endLocation,
    })
    .from(stops)
    .innerJoin(transitRoutes, eq(stops.routeId, transitRoutes.id))
    .where(
      and(
        eq(stops.routeId, routeId),
        eq(stops.isActive, true),
        eq(transitRoutes.isActive, true),
      ),
    )
    .orderBy(asc(stops.stopOrder));
}

async function ensurePassengerExists(passengerUserId: string) {
  const [passengerRow] = await db
    .select({ userId: passengers.userId })
    .from(passengers)
    .where(eq(passengers.userId, passengerUserId))
    .limit(1);

  if (!passengerRow) {
    throw new NotFoundError("Passenger account not found.");
  }
}

async function resolveBookingSegment(input: BookRouteBody) {
  const routeStops = await getActiveRouteStops(input.routeId);

  if (routeStops.length === 0) {
    throw new NotFoundError("Selected route is not available.");
  }

  const pickupStop = routeStops.find((stop) => stop.stopId === input.pickupStopId);
  const dropoffStop = routeStops.find((stop) => stop.stopId === input.dropoffStopId);

  if (!pickupStop || !dropoffStop) {
    throw new NotFoundError("Selected pickup or dropoff stop was not found.");
  }

  if (pickupStop.stopOrder >= dropoffStop.stopOrder) {
    throw new BadRequestError("Pickup stop must be before the dropoff stop.");
  }

  const stopsInRange = routeStops.filter(
    (stop) =>
      stop.stopOrder >= pickupStop.stopOrder &&
      stop.stopOrder <= dropoffStop.stopOrder,
  );

  if (stopsInRange.length < 2) {
    throw new BadRequestError("Selected route segment is invalid.");
  }

  return {
    routeId: input.routeId,
    routeName: buildRouteDisplayName(
      pickupStop.routeName,
      pickupStop.routeStart,
      dropoffStop.routeEnd,
    ),
    pickupStop,
    dropoffStop,
    routeStops,
    stopsInRange,
    distanceKm: calculateRouteDistance(stopsInRange),
  };
}

function isOngoingTripBookable(
  routeStops: StopRow[],
  trip: BookableTripRow,
  options?: {
    dropoffStopOrder?: number;
    pickupStopOrder?: number;
  },
) {
  if (trip.status !== "ongoing") {
    return true;
  }

  const lastStopOrder = routeStops[routeStops.length - 1]?.stopOrder ?? null;

  if (typeof trip.currentStopOrder !== "number") {
    return true;
  }

  if (typeof lastStopOrder === "number" && trip.currentStopOrder >= lastStopOrder) {
    return false;
  }

  if (
    typeof options?.dropoffStopOrder === "number" &&
    options.dropoffStopOrder <= trip.currentStopOrder
  ) {
    return false;
  }

  if (
    typeof options?.pickupStopOrder === "number" &&
    options.pickupStopOrder < trip.currentStopOrder
  ) {
    return false;
  }

  return true;
}

function compareBookableTrips(
  left: BookableTripRow,
  right: BookableTripRow,
  pickupStopOrder?: number,
) {
  if (left.status !== right.status) {
    return left.status === "ongoing" ? -1 : 1;
  }

  if (left.status === "ongoing" && right.status === "ongoing") {
    if (typeof pickupStopOrder === "number") {
      const leftGap = typeof left.currentStopOrder === "number"
        ? Math.max(0, pickupStopOrder - left.currentStopOrder)
        : Number.MAX_SAFE_INTEGER;
      const rightGap = typeof right.currentStopOrder === "number"
        ? Math.max(0, pickupStopOrder - right.currentStopOrder)
        : Number.MAX_SAFE_INTEGER;

      if (leftGap !== rightGap) {
        return leftGap - rightGap;
      }
    }

    const leftCurrentStopOrder = typeof left.currentStopOrder === "number"
      ? left.currentStopOrder
      : Number.MAX_SAFE_INTEGER;
    const rightCurrentStopOrder = typeof right.currentStopOrder === "number"
      ? right.currentStopOrder
      : Number.MAX_SAFE_INTEGER;

    if (leftCurrentStopOrder !== rightCurrentStopOrder) {
      return leftCurrentStopOrder - rightCurrentStopOrder;
    }
  }

  return left.scheduledDepartureTime.getTime() - right.scheduledDepartureTime.getTime();
}

function selectBookableTrip(
  routeStops: StopRow[],
  tripCandidates: BookableTripRow[],
  options?: {
    dropoffStopOrder?: number;
    pickupStopOrder?: number;
  },
) {
  return [...tripCandidates]
    .filter((trip) => isOngoingTripBookable(routeStops, trip, options))
    .sort((left, right) => compareBookableTrips(left, right, options?.pickupStopOrder))[0] ?? null;
}

async function loadBookableTripCandidates(
  executor: DbExecutor,
  routeIds: string[],
) {
  if (routeIds.length === 0) {
    return [];
  }

  return executor
    .select({
      currentStopId: vehicleLocations.currentStopId,
      currentStopOrder: stops.stopOrder,
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      id: trips.id,
      recordedPassengerCount: trips.recordedPassengerCount,
      routeId: trips.routeId,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      status: trips.status,
      tripDate: trips.tripDate,
      vehicleId: trips.vehicleId,
      vehicleCode: vehicles.plateNumber,
      vehicleLatitude: vehicleLocations.latitude,
      vehicleLongitude: vehicleLocations.longitude,
      seatCapacity: vehicles.capacity,
    })
    .from(trips)
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(vehicleLocations, eq(trips.vehicleId, vehicleLocations.vehicleId))
    .leftJoin(stops, eq(vehicleLocations.currentStopId, stops.id))
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(
      and(
        inArray(trips.routeId, routeIds),
        inArray(trips.status, ["scheduled", "ongoing"]),
        or(
          eq(trips.status, "ongoing"),
          and(eq(trips.status, "scheduled"), gte(trips.scheduledDepartureTime, new Date())),
        ),
      ),
    )
    .orderBy(asc(trips.routeId), asc(trips.scheduledDepartureTime)) as Promise<Array<BookableTripRow & {
      routeId: string;
    }>>;
}

async function findBookableTripOrNull(
  executor: DbExecutor,
  input: {
    dropoffStopOrder?: number;
    pickupStopOrder?: number;
    routeId: string;
    routeStops: StopRow[];
  },
) {
  const tripCandidates = await loadBookableTripCandidates(executor, [input.routeId]);

  return selectBookableTrip(
    input.routeStops,
    tripCandidates,
    {
      dropoffStopOrder: input.dropoffStopOrder,
      pickupStopOrder: input.pickupStopOrder,
    },
  );
}

async function getBookableTripsForRoutes(routeGroups: Map<string, StopRow[]>) {
  const tripCandidates = await loadBookableTripCandidates(db, [...routeGroups.keys()]);
  const nextTripByRouteId = new Map<string, BookableTripRow>();

  for (const [routeId, routeStops] of routeGroups.entries()) {
    const sortedRouteStops = [...routeStops].sort((left, right) => left.stopOrder - right.stopOrder);
    const selectedTrip = selectBookableTrip(
      sortedRouteStops,
      tripCandidates.filter((trip) => trip.routeId === routeId),
    );

    if (selectedTrip) {
      nextTripByRouteId.set(routeId, selectedTrip);
    }
  }

  return nextTripByRouteId;
}

function resolveDefaultPickupStopId(
  routeStops: StopRow[],
  selectedTrip: BookableTripRow | null,
) {
  const currentStopOrder = selectedTrip?.currentStopOrder;
  const defaultPickupStop = selectedTrip?.status === "ongoing" && typeof currentStopOrder === "number"
    ? routeStops.find((stop) => stop.stopOrder >= currentStopOrder)
    : routeStops[0];

  return defaultPickupStop?.stopId ?? routeStops[0]?.stopId ?? null;
}

function buildJourneyStart(
  routeStops: StopRow[],
  nextBookableTrip: BookableTripRow | null,
) {
  if (
    nextBookableTrip &&
    typeof nextBookableTrip.vehicleLatitude === "number" &&
    typeof nextBookableTrip.vehicleLongitude === "number"
  ) {
    return {
      label: nextBookableTrip.vehicleCode?.trim() || "Assigned driver start location",
      latitude: nextBookableTrip.vehicleLatitude,
      longitude: nextBookableTrip.vehicleLongitude,
      scheduledDepartureTime: nextBookableTrip.scheduledDepartureTime,
      source: "driver_location" as const,
      stopId: null,
      tripId: nextBookableTrip.id,
      vehicleCode: nextBookableTrip.vehicleCode,
      vehicleId: nextBookableTrip.vehicleId,
    };
  }

  const firstMappableStop = routeStops.find(hasStopCoordinates);

  if (!firstMappableStop) {
    throw new BadRequestError("This route does not have enough stop coordinates to generate a passenger route preview.");
  }

  return {
    label: buildStopLabel(firstMappableStop),
    latitude: firstMappableStop.latitude,
    longitude: firstMappableStop.longitude,
    scheduledDepartureTime: nextBookableTrip?.scheduledDepartureTime ?? null,
    source: "first_stop" as const,
    stopId: firstMappableStop.stopId,
    tripId: nextBookableTrip?.id ?? null,
    vehicleCode: nextBookableTrip?.vehicleCode ?? null,
    vehicleId: nextBookableTrip?.vehicleId ?? null,
  };
}

function buildPlannerPolyline(
  routeStops: StopRow[],
  dropoffStopOrder: number,
  journeyStart: JourneyStartPreview,
) {
  const routePreviewPolyline = buildPolyline(
    routeStops.filter((stop) => stop.stopOrder <= dropoffStopOrder),
  );

  if (journeyStart.source !== "driver_location") {
    return routePreviewPolyline;
  }

  const firstCoordinate = routePreviewPolyline[0];

  if (
    firstCoordinate &&
    Math.abs(firstCoordinate.latitude - journeyStart.latitude) < 0.000001 &&
    Math.abs(firstCoordinate.longitude - journeyStart.longitude) < 0.000001
  ) {
    return routePreviewPolyline;
  }

  return [
    {
      latitude: journeyStart.latitude,
      longitude: journeyStart.longitude,
    },
    ...routePreviewPolyline,
  ];
}

function mapBookableTripPayload(trip: BookableTripRow) {
  return {
    driverName: buildDriverName(trip.driverFirstName, trip.driverLastName),
    id: trip.id,
    scheduledDepartureTime: trip.scheduledDepartureTime,
    status: trip.status,
    tripDate: trip.tripDate,
    vehicleCode: trip.vehicleCode,
    vehicleId: trip.vehicleId,
  };
}

async function ensureNoActiveDuplicateBooking(
  executor: DbExecutor,
  passengerUserId: string,
  tripId: string,
  pickupStopId: string,
  dropoffStopId: string,
) {
  const [existingBooking] = await executor
    .select({ id: passengerTrips.id })
    .from(passengerTrips)
    .where(
      and(
        eq(passengerTrips.passengerUserId, passengerUserId),
        eq(passengerTrips.tripId, tripId),
        eq(passengerTrips.pickupStopId, pickupStopId),
        eq(passengerTrips.dropoffStopId, dropoffStopId),
        inArray(passengerTrips.status, ACTIVE_BOOKING_STATUSES),
      ),
    )
    .limit(1);

  if (existingBooking) {
    throw new ConflictError("You already have an active booking for this trip.");
  }
}

async function lockTripForBooking(
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tripId: string,
) {
  await executor.execute(sql`select id from trips where id = ${tripId} for update`);
}

async function countTripBookingsByStatuses(
  executor: DbExecutor,
  tripId: string,
  statuses: readonly PassengerTripStatus[],
) {
  const [bookingRow] = await executor
    .select({
      bookingCount: count(passengerTrips.id),
    })
    .from(passengerTrips)
    .where(
      and(
        eq(passengerTrips.tripId, tripId),
        inArray(passengerTrips.status, statuses),
      ),
    );

  return Number(bookingRow?.bookingCount ?? 0);
}

function resolveSeatUsageCount(input: {
  activeBookingCount: number;
  onboardBookingCount: number;
  recordedPassengerCount: number | null;
}) {
  const recordedPassengerCount = Math.max(0, Number(input.recordedPassengerCount ?? 0));
  const walkInOccupancyCount = Math.max(0, recordedPassengerCount - input.onboardBookingCount);

  return input.activeBookingCount + walkInOccupancyCount;
}

async function assertTripHasAvailableCapacity(
  executor: DbExecutor,
  input: {
    recordedPassengerCount: number | null;
    seatCapacity: number | null;
    tripId: string;
    vehicleId: string | null;
  },
) {
  if (!input.vehicleId) {
    throw new BadRequestError(
      "This trip cannot accept bookings yet because it does not have an assigned vehicle.",
      {
        trip_id: input.tripId,
      },
    );
  }

  if (input.seatCapacity === null || input.seatCapacity <= 0) {
    throw new BadRequestError(
      "This trip cannot accept bookings yet because the assigned vehicle has no valid passenger capacity.",
      {
        seat_capacity: input.seatCapacity,
        trip_id: input.tripId,
        vehicle_id: input.vehicleId,
      },
    );
  }

  const [activeBookingCount, onboardBookingCount] = await Promise.all([
    countTripBookingsByStatuses(executor, input.tripId, ACTIVE_BOOKING_STATUSES),
    countTripBookingsByStatuses(executor, input.tripId, ["onboard"]),
  ]);
  const reservedSeatCount = resolveSeatUsageCount({
    activeBookingCount,
    onboardBookingCount,
    recordedPassengerCount: input.recordedPassengerCount,
  });

  if (reservedSeatCount >= input.seatCapacity) {
    throw new BadRequestError("No seats are currently available on this trip.", {
      active_bookings: activeBookingCount,
      onboard_bookings: onboardBookingCount,
      recorded_passenger_count: input.recordedPassengerCount,
      reserved_seats: reservedSeatCount,
      seat_capacity: input.seatCapacity,
      trip_id: input.tripId,
      vehicle_id: input.vehicleId,
    });
  }
}

export async function findBestRoute(input: PlanRouteQuery) {
  const allStops = await getAllActiveStops();
  const routeGroups = groupStopsByRoute(allStops);
  const bestMatch = findRouteMatch(input, routeGroups);

  if (!bestMatch) {
    logger.info({
      msg: "No matching route found",
      originLat: input.originLat,
      originLng: input.originLng,
      destLat: input.destLat,
      destLng: input.destLng,
    });
    return null;
  }

  const fare = calculateFare(bestMatch.distanceKm);
  const etaMinutes = await calculateEtaMinutes(
    { id: bestMatch.boardingStop.stopId, latitude: bestMatch.boardingStop.latitude, longitude: bestMatch.boardingStop.longitude },
    { id: bestMatch.dropoffStop.stopId,  latitude: bestMatch.dropoffStop.latitude,  longitude: bestMatch.dropoffStop.longitude  },
    bestMatch.distanceKm,
  );

  logger.info({
    msg: "Route plan generated",
    routeId: bestMatch.routeId,
    boardingStopId: bestMatch.boardingStop.stopId,
    dropoffStopId: bestMatch.dropoffStop.stopId,
    distanceKm: bestMatch.distanceKm,
    fare,
    etaMinutes,
  });

  return {
    matchFound: true,
    route: {
      id: bestMatch.routeId,
      name: bestMatch.routeName,
    },
    boardingStop: {
      id: bestMatch.boardingStop.stopId,
      name: bestMatch.boardingStop.stopName,
      latitude: bestMatch.boardingStop.latitude,
      longitude: bestMatch.boardingStop.longitude,
      stopOrder: bestMatch.boardingStop.stopOrder,
    },
    dropoffStop: {
      id: bestMatch.dropoffStop.stopId,
      name: bestMatch.dropoffStop.stopName,
      latitude: bestMatch.dropoffStop.latitude,
      longitude: bestMatch.dropoffStop.longitude,
      stopOrder: bestMatch.dropoffStop.stopOrder,
    },
    distanceKm: Math.round(bestMatch.distanceKm * 10) / 10,
    etaMinutes,
    fare,
    originWalkKm: Math.round(bestMatch.originWalkKm * 10) / 10,
    destWalkKm: Math.round(bestMatch.destWalkKm * 10) / 10,
    polyline: buildPolyline(bestMatch.stopsInRange),
  };
}

export async function listPassengerRouteOptions() {
  const allStops = await getAllActiveStops();
  const routeGroups = groupStopsByRoute(allStops);
  const nextTripsByRouteId = await getBookableTripsForRoutes(routeGroups);

  const routeOptions = [...routeGroups.entries()]
    .map(([
      routeId,
      routeStops,
    ]) => {
      const sortedStops = [...routeStops].sort((left, right) => left.stopOrder - right.stopOrder);
      const mappableStops = sortedStops.filter(hasStopCoordinates);

      if (sortedStops.length < 2 || mappableStops.length < 2) {
        return null;
      }

      const firstStop = sortedStops[0];
      const lastStop = sortedStops[sortedStops.length - 1];
      const nextBookableTrip = nextTripsByRouteId.get(routeId) ?? null;
      const journeyStart = buildJourneyStart(sortedStops, nextBookableTrip);

      return {
        id: routeId,
        name: buildRouteDisplayName(
          firstStop?.routeName ?? null,
          firstStop?.routeStart ?? null,
          lastStop?.routeEnd ?? null,
        ),
        startLocation: firstStop?.routeStart ?? null,
        endLocation: lastStop?.routeEnd ?? null,
        bookingAvailable: Boolean(nextBookableTrip),
        defaultPickupStopId: resolveDefaultPickupStopId(sortedStops, nextBookableTrip),
        defaultDropoffStopId: lastStop?.stopId ?? null,
        journeyStart: {
          label: journeyStart.label,
          latitude: journeyStart.latitude,
          longitude: journeyStart.longitude,
          scheduledDepartureTime: journeyStart.scheduledDepartureTime,
          source: journeyStart.source,
          stopId: journeyStart.stopId,
          tripId: journeyStart.tripId,
          vehicleCode: journeyStart.vehicleCode,
          vehicleId: journeyStart.vehicleId,
        },
        nextTrip: nextBookableTrip
          ? mapBookableTripPayload(nextBookableTrip)
          : null,
        stops: sortedStops.map((stop) => ({
          id: stop.stopId,
          name: stop.stopName,
          latitude: stop.latitude,
          longitude: stop.longitude,
          stopOrder: stop.stopOrder,
        })),
        polyline: buildPolyline(sortedStops),
      };
    })
    .filter((routeOption): routeOption is NonNullable<typeof routeOption> => routeOption !== null);

  logger.info({
    msg: "Passenger route options loaded",
    count: routeOptions.length,
  });

  return routeOptions;
}

export async function planRouteSegmentForPassenger(input: BookRouteBody) {
  const bookingSegment = await resolveBookingSegment(input);
  const nextBookableTrip = await findBookableTripOrNull(db, {
    dropoffStopOrder: bookingSegment.dropoffStop.stopOrder,
    pickupStopOrder: bookingSegment.pickupStop.stopOrder,
    routeId: input.routeId,
    routeStops: bookingSegment.routeStops,
  });
  const fare = calculateFare(bookingSegment.distanceKm);
  const etaMinutes = await calculateEtaMinutes(
    { id: bookingSegment.pickupStop.stopId, latitude: bookingSegment.pickupStop.latitude, longitude: bookingSegment.pickupStop.longitude },
    { id: bookingSegment.dropoffStop.stopId, latitude: bookingSegment.dropoffStop.latitude, longitude: bookingSegment.dropoffStop.longitude },
    bookingSegment.distanceKm,
  );
  const journeyStart = buildJourneyStart(bookingSegment.routeStops, nextBookableTrip);

  logger.info({
    msg: "Passenger stop-based route plan generated",
    routeId: bookingSegment.routeId,
    pickupStopId: bookingSegment.pickupStop.stopId,
    dropoffStopId: bookingSegment.dropoffStop.stopId,
    tripId: nextBookableTrip?.id ?? null,
  });

  return {
    matchFound: true,
    route: {
      id: bookingSegment.routeId,
      name: bookingSegment.routeName,
    },
    trip: nextBookableTrip
      ? mapBookableTripPayload(nextBookableTrip)
      : null,
    journeyStart: {
      label: journeyStart.label,
      latitude: journeyStart.latitude,
      longitude: journeyStart.longitude,
      scheduledDepartureTime: journeyStart.scheduledDepartureTime,
      source: journeyStart.source,
      stopId: journeyStart.stopId,
      tripId: journeyStart.tripId,
      vehicleCode: journeyStart.vehicleCode,
      vehicleId: journeyStart.vehicleId,
    },
    boardingStop: {
      id: bookingSegment.pickupStop.stopId,
      name: bookingSegment.pickupStop.stopName,
      latitude: bookingSegment.pickupStop.latitude,
      longitude: bookingSegment.pickupStop.longitude,
      stopOrder: bookingSegment.pickupStop.stopOrder,
    },
    dropoffStop: {
      id: bookingSegment.dropoffStop.stopId,
      name: bookingSegment.dropoffStop.stopName,
      latitude: bookingSegment.dropoffStop.latitude,
      longitude: bookingSegment.dropoffStop.longitude,
      stopOrder: bookingSegment.dropoffStop.stopOrder,
    },
    distanceKm: Math.round(bookingSegment.distanceKm * 10) / 10,
    etaMinutes,
    fare,
    polyline: buildPlannerPolyline(
      bookingSegment.routeStops,
      bookingSegment.dropoffStop.stopOrder,
      journeyStart,
    ),
  };
}

export async function bookRouteForPassenger(
  passengerUserId: string,
  input: BookRouteBody,
) {
  await ensurePassengerExists(passengerUserId);

  const bookingSegment = await resolveBookingSegment(input);
  const fare = calculateFare(bookingSegment.distanceKm);
  const {
    createdBooking,
    selectedTrip,
  } = await db.transaction(async (tx) => {
    const selectedTrip = await findBookableTripOrNull(tx, {
      dropoffStopOrder: bookingSegment.dropoffStop.stopOrder,
      pickupStopOrder: bookingSegment.pickupStop.stopOrder,
      routeId: input.routeId,
      routeStops: bookingSegment.routeStops,
    });

    if (!selectedTrip) {
      throw new NotFoundError("No bookable trip is available for this route right now.");
    }

    await lockTripForBooking(tx, selectedTrip.id);
    await ensureNoActiveDuplicateBooking(
      tx,
      passengerUserId,
      selectedTrip.id,
      bookingSegment.pickupStop.stopId,
      bookingSegment.dropoffStop.stopId,
    );
    await assertTripHasAvailableCapacity(tx, {
      recordedPassengerCount: selectedTrip.recordedPassengerCount,
      seatCapacity: selectedTrip.seatCapacity,
      tripId: selectedTrip.id,
      vehicleId: selectedTrip.vehicleId,
    });

    const [createdBooking] = await tx
      .insert(passengerTrips)
      .values({
        passengerUserId,
        tripId: selectedTrip.id,
        pickupStopId: bookingSegment.pickupStop.stopId,
        dropoffStopId: bookingSegment.dropoffStop.stopId,
        status: "booked",
        fare,
      })
      .returning({
        id: passengerTrips.id,
        status: passengerTrips.status,
        fare: passengerTrips.fare,
        createdAt: passengerTrips.createdAt,
      });

    if (!createdBooking) {
      throw new BadRequestError("Unable to create route booking.");
    }

    return {
      createdBooking,
      selectedTrip,
    };
  });

  logger.info({
    msg: "Passenger route booked",
    passengerUserId,
    tripId: selectedTrip.id,
    routeId: input.routeId,
    pickupStopId: bookingSegment.pickupStop.stopId,
    dropoffStopId: bookingSegment.dropoffStop.stopId,
  });

  return {
    booking: {
      id: createdBooking.id,
      status: createdBooking.status,
      fare: createdBooking.fare,
      createdAt: createdBooking.createdAt,
    },
    trip: {
      id: selectedTrip.id,
      tripDate: selectedTrip.tripDate,
      scheduledDepartureTime: selectedTrip.scheduledDepartureTime,
      status: selectedTrip.status,
    },
    route: {
      id: bookingSegment.routeId,
      name: bookingSegment.routeName,
      distanceKm: Math.round(bookingSegment.distanceKm * 10) / 10,
      fare,
    },
    pickupStop: {
      id: bookingSegment.pickupStop.stopId,
      name: bookingSegment.pickupStop.stopName,
      stopOrder: bookingSegment.pickupStop.stopOrder,
    },
    dropoffStop: {
      id: bookingSegment.dropoffStop.stopId,
      name: bookingSegment.dropoffStop.stopName,
      stopOrder: bookingSegment.dropoffStop.stopOrder,
    },
  };
}

export function routeListRoutes() {
  return operationsListRoutes();
}

export function routeCreateRoute(
  input: CreateRouteBody,
  actorUserId?: string,
) {
  return operationsCreateRoute(input, actorUserId);
}

export function routeUpdateRoute(
  routeId: string,
  input: UpdateRouteBody,
  actorUserId?: string,
) {
  return operationsUpdateRoute(routeId, input, actorUserId);
}

export function routeDeleteRoute(
  routeId: string,
  actorUserId?: string,
) {
  return operationsDeleteRoute(routeId, actorUserId);
}

export function routePublishRoute(
  routeId: string,
  actorUserId?: string,
) {
  return operationsPublishRoute(routeId, actorUserId);
}

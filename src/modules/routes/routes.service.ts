import { and, asc, count, eq, gte, inArray, sql } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import { passengerTrips, passengers, stops, transitRoutes, trips, vehicles } from "../../database/schema";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/app-error";
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
const BASE_FARE = 13;
const FARE_PER_KM = 1.8;
const FREE_KM = 4;
const AVG_SPEED_KPH = 18;
const ACTIVE_BOOKING_STATUSES = ["booked", "waiting", "onboard"] as const;

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

interface StopRow {
  stopId: string;
  stopName: string | null;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
  routeId: string;
  routeStart: string | null;
  routeEnd: string | null;
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
  const chargeableKm = Math.max(0, distanceKm - FREE_KM);
  return Math.round((BASE_FARE + chargeableKm * FARE_PER_KM) * 100) / 100;
}

function calculateEtaMinutes(distanceKm: number) {
  return Math.max(5, Math.round((distanceKm / AVG_SPEED_KPH) * 60));
}

function buildRouteName(
  startLocation: string | null,
  endLocation: string | null,
) {
  return `${startLocation ?? "Start"} -> ${endLocation ?? "End"}`;
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
        routeName: buildRouteName(
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
    routeName: buildRouteName(pickupStop.routeStart, dropoffStop.routeEnd),
    pickupStop,
    dropoffStop,
    stopsInRange,
    distanceKm: calculateRouteDistance(stopsInRange),
  };
}

async function findNextScheduledTrip(
  executor: DbExecutor,
  routeId: string,
) {
  const [scheduledTrip] = await executor
    .select({
      id: trips.id,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      tripDate: trips.tripDate,
      status: trips.status,
      vehicleId: trips.vehicleId,
      seatCapacity: vehicles.capacity,
    })
    .from(trips)
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(trips.routeId, routeId),
        eq(trips.status, "scheduled"),
        gte(trips.scheduledDepartureTime, new Date()),
      ),
    )
    .orderBy(asc(trips.scheduledDepartureTime))
    .limit(1);

  if (!scheduledTrip) {
    throw new NotFoundError("No upcoming scheduled trip is available for this route.");
  }

  return scheduledTrip;
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

async function lockScheduledTripForBooking(
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tripId: string,
) {
  await executor.execute(sql`select id from trips where id = ${tripId} for update`);
}

async function assertScheduledTripHasAvailableCapacity(
  executor: DbExecutor,
  input: {
    seatCapacity: number | null;
    tripId: string;
    vehicleId: string | null;
  },
) {
  if (!input.vehicleId) {
    throw new BadRequestError(
      "The next scheduled trip for this route cannot accept bookings yet because it does not have an assigned vehicle.",
      {
        trip_id: input.tripId,
      },
    );
  }

  if (input.seatCapacity === null || input.seatCapacity <= 0) {
    throw new BadRequestError(
      "The next scheduled trip for this route cannot accept bookings yet because the assigned vehicle has no valid passenger capacity.",
      {
        seat_capacity: input.seatCapacity,
        trip_id: input.tripId,
        vehicle_id: input.vehicleId,
      },
    );
  }

  const [activeBookingRow] = await executor
    .select({
      activeBookingCount: count(passengerTrips.id),
    })
    .from(passengerTrips)
    .where(
      and(
        eq(passengerTrips.tripId, input.tripId),
        inArray(passengerTrips.status, ACTIVE_BOOKING_STATUSES),
      ),
    );

  const activeBookingCount = Number(activeBookingRow?.activeBookingCount ?? 0);

  if (activeBookingCount >= input.seatCapacity) {
    throw new BadRequestError("No seats are currently available on the next scheduled trip for this route.", {
      active_bookings: activeBookingCount,
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
  const etaMinutes = calculateEtaMinutes(bestMatch.distanceKm);

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

export async function bookRouteForPassenger(
  passengerUserId: string,
  input: BookRouteBody,
) {
  await ensurePassengerExists(passengerUserId);

  const bookingSegment = await resolveBookingSegment(input);
  const fare = calculateFare(bookingSegment.distanceKm);
  const {
    createdBooking,
    scheduledTrip,
  } = await db.transaction(async (tx) => {
    const scheduledTrip = await findNextScheduledTrip(tx, input.routeId);

    await lockScheduledTripForBooking(tx, scheduledTrip.id);
    await ensureNoActiveDuplicateBooking(
      tx,
      passengerUserId,
      scheduledTrip.id,
      bookingSegment.pickupStop.stopId,
      bookingSegment.dropoffStop.stopId,
    );
    await assertScheduledTripHasAvailableCapacity(tx, {
      seatCapacity: scheduledTrip.seatCapacity,
      tripId: scheduledTrip.id,
      vehicleId: scheduledTrip.vehicleId,
    });

    const [createdBooking] = await tx
      .insert(passengerTrips)
      .values({
        passengerUserId,
        tripId: scheduledTrip.id,
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
      scheduledTrip,
    };
  });

  logger.info({
    msg: "Passenger route booked",
    passengerUserId,
    tripId: scheduledTrip.id,
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
      id: scheduledTrip.id,
      tripDate: scheduledTrip.tripDate,
      scheduledDepartureTime: scheduledTrip.scheduledDepartureTime,
      status: scheduledTrip.status,
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

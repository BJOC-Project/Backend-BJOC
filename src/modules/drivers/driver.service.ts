import { and, asc, count, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "../../database/db";
import {
  drivers,
  gpsLogs,
  passengerTrips,
  stops,
  transitRoutes,
  tripEmergencyReports,
  trips,
  users,
  vehicleAssignments,
  vehicleLocations,
  vehicles,
} from "../../database/schema";
import { BadRequestError, NotFoundError } from "../../errors/app-error";
import { usersFindUserProfileById } from "../users/users.service";
import {
  operationsCreateDriver,
  operationsDeleteDriver,
  operationsListDrivers,
  operationsReportDriverEmergency,
  operationsScheduleTrip,
  operationsUpdateDriver,
} from "../operations/operations.service";
import type {
  DriverDashboardData,
  DriverDashboardTripCard,
  DriverMobileHistoryTrip,
  DriverMobileTrip,
  DriverSchedulableRoute,
  DriverDashboardTripStatPoint,
  DriverManagementStopStatus,
  DriverManagementTrip,
} from "./driver.types";
import type {
  DriverCreateBody,
  DriverEmergencyBody,
  DriverLocationBody,
  DriverScheduleTripBody,
  DriverUpdateBody,
} from "./driver.validation";

const ACTIVE_PASSENGER_STATUSES = ["booked", "waiting", "onboard"] as const;
const DASHBOARD_TIME_ZONE = "Asia/Manila";
const ROUTE_STOP_INTERVAL_MINUTES = 5;
const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatDashboardDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDashboardDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function getDashboardWeekday(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIME_ZONE,
    weekday: "short",
  }).format(parseDashboardDateKey(dateKey));
}

function buildRouteName(
  routeName: string | null | undefined,
  startLocation: string | null,
  endLocation: string | null,
) {
  if (routeName?.trim()) {
    return routeName.trim();
  }

  return `${startLocation ?? "Unknown origin"} -> ${endLocation ?? "Unknown destination"}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function addMinutes(
  baseDate: Date,
  minutesToAdd: number,
) {
  return new Date(baseDate.getTime() + minutesToAdd * 60_000);
}

function mapDashboardTripCard(row: {
  endLocation: string | null;
  id: string;
  routeName: string | null;
  scheduledDepartureTime: Date;
  startLocation: string | null;
  startTime: Date | null;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  tripDate: string;
  endTime: Date | null;
}): DriverDashboardTripCard {
  return {
    id: row.id,
    route_name: buildRouteName(row.routeName, row.startLocation, row.endLocation),
    scheduled_departure_time: row.scheduledDepartureTime,
    start_location: row.startLocation,
    end_location: row.endLocation,
    status: row.status,
    trip_date: row.tripDate,
    trip_ended_at: row.endTime,
    trip_started_at: row.startTime,
  };
}

type DriverTripRow = {
  endLocation: string | null;
  endTime: Date | null;
  id: string;
  routeId: string;
  routeName: string | null;
  scheduledDepartureTime: Date;
  startLocation: string | null;
  startTime: Date | null;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  vehicleCode: string | null;
};

function toDriverMobileStatus(status: DriverTripRow["status"]): DriverMobileTrip["status"] {
  if (status === "scheduled") {
    return "waiting";
  }

  if (status === "ongoing") {
    return "active";
  }

  return status;
}

function buildDriverProgressLabel(row: DriverTripRow) {
  if (row.status === "scheduled") {
    return "Ready for dispatch";
  }

  if (row.status === "ongoing") {
    return "Trip in progress";
  }

  if (row.status === "completed") {
    return "Trip completed successfully.";
  }

  return "Trip was cancelled.";
}

async function loadDriverTripAggregates(tripRows: DriverTripRow[]) {
  const tripIds = tripRows.map((row) => row.id);
  const routeIds = [...new Set(tripRows.map((row) => row.routeId))];
  const [passengerRows, routeStopRows] = await Promise.all([
    tripIds.length > 0
      ? db
        .select({
          fare: passengerTrips.fare,
          status: passengerTrips.status,
          tripId: passengerTrips.tripId,
        })
        .from(passengerTrips)
        .where(inArray(passengerTrips.tripId, tripIds))
      : Promise.resolve([]),
    routeIds.length > 0
      ? db
        .select({
          routeId: stops.routeId,
          stopCount: count(stops.id),
        })
        .from(stops)
        .where(inArray(stops.routeId, routeIds))
        .groupBy(stops.routeId)
      : Promise.resolve([]),
  ]);
  const fareByTripId = new Map<string, number>();
  const passengerCountByTripId = new Map<string, number>();
  const stopCountByRouteId = new Map<string, number>();

  for (const row of passengerRows) {
    fareByTripId.set(row.tripId, (fareByTripId.get(row.tripId) ?? 0) + Number(row.fare ?? 0));

    if (
      row.status === "booked" ||
      row.status === "waiting" ||
      row.status === "onboard" ||
      row.status === "completed"
    ) {
      passengerCountByTripId.set(row.tripId, (passengerCountByTripId.get(row.tripId) ?? 0) + 1);
    }
  }

  for (const row of routeStopRows) {
    stopCountByRouteId.set(row.routeId, Number(row.stopCount));
  }

  return {
    fareByTripId,
    passengerCountByTripId,
    stopCountByRouteId,
  };
}

function mapDriverMobileTrip(
  row: DriverTripRow,
  aggregates: {
    fareByTripId: Map<string, number>;
  },
): DriverMobileTrip {
  return {
    dropoff: row.endLocation ?? "Unknown destination",
    estimated_minutes: row.status === "scheduled"
      ? Math.max(0, Math.round((row.scheduledDepartureTime.getTime() - Date.now()) / 60_000))
      : null,
    fare: Math.round((aggregates.fareByTripId.get(row.id) ?? 0) * 100) / 100,
    id: row.id,
    pickup: row.startLocation ?? "Unknown origin",
    progress_label: buildDriverProgressLabel(row),
    route_name: buildRouteName(row.routeName, row.startLocation, row.endLocation),
    schedule: row.scheduledDepartureTime,
    status: toDriverMobileStatus(row.status),
    vehicle_code: row.vehicleCode ?? null,
  };
}

function mapDriverMobileHistoryTrip(
  row: DriverTripRow,
  aggregates: {
    fareByTripId: Map<string, number>;
    passengerCountByTripId: Map<string, number>;
    stopCountByRouteId: Map<string, number>;
  },
): DriverMobileHistoryTrip {
  const totalStops = Math.max(0, aggregates.stopCountByRouteId.get(row.routeId) ?? 0);

  return {
    ...mapDriverMobileTrip(row, aggregates),
    completed_at: row.endTime ?? row.scheduledDepartureTime,
    notes: row.status === "completed"
      ? "Trip completed successfully."
      : "Trip ended due to cancellation.",
    stops_made: row.status === "completed" ? totalStops : 0,
    total_stops: totalStops,
    trip_started_at: row.startTime,
    waited_passengers: Math.max(0, aggregates.passengerCountByTripId.get(row.id) ?? 0),
  };
}

async function queryDriverTrips(
  userId: string,
  statusFilter: Array<DriverTripRow["status"]>,
  order: "asc" | "desc" = "asc",
) {
  return db
    .select({
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeId: trips.routeId,
      routeName: transitRoutes.routeName,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      vehicleCode: vehicles.plateNumber,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(trips.driverUserId, userId),
        inArray(trips.status, statusFilter),
      ),
    )
    .orderBy(
      order === "asc"
        ? asc(trips.scheduledDepartureTime)
        : desc(trips.scheduledDepartureTime),
    );
}

async function findCurrentTrip(userId: string) {
  const [currentTrip] = await db
    .select({
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeName: transitRoutes.routeName,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripDate: trips.tripDate,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .where(
      and(
        eq(trips.driverUserId, userId),
        eq(trips.status, "ongoing"),
      ),
    )
    .orderBy(desc(trips.startTime))
    .limit(1);

  return currentTrip ?? null;
}

async function findUpcomingTrip(
  userId: string,
  todayKey: string,
) {
  const [upcomingTrip] = await db
    .select({
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeName: transitRoutes.routeName,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripDate: trips.tripDate,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .where(
      and(
        eq(trips.driverUserId, userId),
        eq(trips.status, "scheduled"),
        gte(trips.tripDate, todayKey),
      ),
    )
    .orderBy(asc(trips.tripDate), asc(trips.scheduledDepartureTime))
    .limit(1);

  return upcomingTrip ?? null;
}

function buildTripStats(
  rows: Array<{
    hasEmergencyReport: string | null;
    status: "scheduled" | "ongoing" | "completed" | "cancelled";
    tripDate: string;
  }>,
) {
  const statsByDay = new Map<string, DriverDashboardTripStatPoint>(
    WEEKDAY_ORDER.map((day) => [
      day,
      {
        day,
        completed: 0,
        cancelled: 0,
      },
    ]),
  );

  for (const row of rows) {
    const weekday = getDashboardWeekday(row.tripDate);
    const point = statsByDay.get(weekday);

    if (!point) {
      continue;
    }

    if (row.status === "completed") {
      point.completed += 1;
      continue;
    }

    if (row.status === "cancelled" && row.hasEmergencyReport) {
      point.cancelled += 1;
    }
  }

  return WEEKDAY_ORDER.map((day) => statsByDay.get(day)!);
}

function deriveStopStatus(
  currentStopOrder: number | null,
  stopOrder: number,
) : DriverManagementStopStatus {
  if (currentStopOrder === null) {
    return stopOrder === 1 ? "current" : "upcoming";
  }

  if (stopOrder < currentStopOrder) {
    return "passed";
  }

  if (stopOrder === currentStopOrder) {
    return "current";
  }

  return "upcoming";
}

async function findNearestRouteStopId(
  routeId: string,
  latitude: number,
  longitude: number,
) {
  const routeStops = await db
    .select({
      id: stops.id,
      latitude: stops.latitude,
      longitude: stops.longitude,
    })
    .from(stops)
    .where(eq(stops.routeId, routeId));

  let nearestStop: {
    distanceKm: number;
    id: string;
  } | null = null;

  for (const stopRow of routeStops) {
    if (typeof stopRow.latitude !== "number" || typeof stopRow.longitude !== "number") {
      continue;
    }

    const distanceKm = haversineDistanceKm(
      latitude,
      longitude,
      stopRow.latitude,
      stopRow.longitude,
    );

    if (!nearestStop || distanceKm < nearestStop.distanceKm) {
      nearestStop = {
        distanceKm,
        id: stopRow.id,
      };
    }
  }

  return nearestStop?.id ?? null;
}

export function driverViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}

async function assertDriverSchedulableRoute(routeId: string) {
  const [routeRow] = await db
    .select({
      id: transitRoutes.id,
      isActive: transitRoutes.isActive,
    })
    .from(transitRoutes)
    .where(eq(transitRoutes.id, routeId))
    .limit(1);

  if (!routeRow || !routeRow.isActive) {
    throw new NotFoundError("Selected route is not available for scheduling.");
  }
}

async function getAssignedVehicleIdForDriver(userId: string) {
  const [assignmentRow] = await db
    .select({
      vehicleId: vehicleAssignments.vehicleId,
    })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.driverUserId, userId))
    .limit(1);

  if (!assignmentRow?.vehicleId) {
    throw new BadRequestError("No vehicle is assigned to this driver.");
  }

  return assignmentRow.vehicleId;
}

export async function driverListSchedulableRoutes(): Promise<DriverSchedulableRoute[]> {
  const routeRows = await db
    .select({
      endLocation: transitRoutes.endLocation,
      id: transitRoutes.id,
      routeName: transitRoutes.routeName,
      startLocation: transitRoutes.startLocation,
    })
    .from(transitRoutes)
    .where(eq(transitRoutes.isActive, true))
    .orderBy(asc(transitRoutes.updatedAt));

  return routeRows.map((routeRow) => ({
    end_location: routeRow.endLocation,
    id: routeRow.id,
    route_name: buildRouteName(routeRow.routeName, routeRow.startLocation, routeRow.endLocation),
    start_location: routeRow.startLocation,
  }));
}

export async function driverScheduleTrip(
  userId: string,
  input: DriverScheduleTripBody,
) {
  await assertDriverSchedulableRoute(input.route_id);

  const vehicleId = await getAssignedVehicleIdForDriver(userId);

  return operationsScheduleTrip(
    {
      route_id: input.route_id,
      scheduled_departure_time: input.scheduled_departure_time,
      vehicle_id: vehicleId,
    },
    userId,
  );
}

export async function driverGetDashboard(
  userId: string,
): Promise<DriverDashboardData> {
  const [driverRow] = await db
    .select({
      firstName: users.firstName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!driverRow) {
    throw new NotFoundError("Driver not found");
  }

  const now = new Date();
  const todayKey = formatDashboardDateKey(now);
  const statsStartDate = new Date(now);
  statsStartDate.setDate(statsStartDate.getDate() - 6);
  const statsStartKey = formatDashboardDateKey(statsStartDate);

  const [currentTripRow, upcomingTripRow, summaryRows, tripStatRows] = await Promise.all([
    findCurrentTrip(userId),
    findUpcomingTrip(userId, todayKey),
    db
      .select({
        endLocation: transitRoutes.endLocation,
        endTime: trips.endTime,
        hasEmergencyReport: tripEmergencyReports.id,
        recordedPassengerCount: trips.recordedPassengerCount,
        routeName: transitRoutes.routeName,
        startLocation: transitRoutes.startLocation,
        startTime: trips.startTime,
        status: trips.status,
        tripDate: trips.tripDate,
      })
      .from(trips)
      .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
      .leftJoin(tripEmergencyReports, eq(tripEmergencyReports.tripId, trips.id))
      .where(
        and(
          eq(trips.driverUserId, userId),
          or(
            eq(trips.status, "completed"),
            and(
              eq(trips.status, "cancelled"),
              eq(tripEmergencyReports.tripId, trips.id),
            ),
          ),
        ),
      )
      .orderBy(desc(trips.endTime), desc(trips.startTime))
      .limit(20),
    db
      .select({
        hasEmergencyReport: tripEmergencyReports.id,
        status: trips.status,
        tripDate: trips.tripDate,
      })
      .from(trips)
      .leftJoin(tripEmergencyReports, eq(tripEmergencyReports.tripId, trips.id))
      .where(
        and(
          eq(trips.driverUserId, userId),
          gte(trips.tripDate, statsStartKey),
          lte(trips.tripDate, todayKey),
          inArray(trips.status, ["completed", "cancelled"]),
        ),
      ),
  ]);

  return {
    current_trip: currentTripRow ? mapDashboardTripCard(currentTripRow) : null,
    driver_name: driverRow.firstName,
    trip_stats: buildTripStats(tripStatRows),
    trip_summary: summaryRows.map((row) => ({
        route_name: buildRouteName(row.routeName, row.startLocation, row.endLocation),
        passenger_count: Math.max(0, row.recordedPassengerCount ?? 0),
        status: row.status === "cancelled" ? "cancelled" : "completed",
        trip_date: row.tripDate,
        trip_ended_at: row.endTime,
        trip_started_at: row.startTime,
      })),
    upcoming_trip: upcomingTripRow ? mapDashboardTripCard(upcomingTripRow) : null,
  };
}

export async function driverGetTripManagement(
  userId: string,
  tripId: string,
): Promise<DriverManagementTrip> {
  const [tripRow] = await db
    .select({
      currentStopId: vehicleLocations.currentStopId,
      driverUserId: trips.driverUserId,
      id: trips.id,
      plateNumber: vehicles.plateNumber,
      routeId: trips.routeId,
      routeName: transitRoutes.routeName,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      seatCapacity: vehicles.capacity,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      vehicleId: trips.vehicleId,
      endLocation: transitRoutes.endLocation,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(vehicleLocations, eq(vehicleLocations.vehicleId, trips.vehicleId))
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.driverUserId, userId),
      ),
    )
    .limit(1);

  if (!tripRow) {
    throw new NotFoundError("Trip not found for this driver.");
  }

  if (tripRow.status !== "ongoing") {
    throw new NotFoundError("Trip management is only available for ongoing trips.");
  }

  const seatCapacity = typeof tripRow.seatCapacity === "number"
    ? tripRow.seatCapacity
    : null;

  if (seatCapacity === null || seatCapacity <= 0) {
    throw new BadRequestError(
      "The assigned vehicle does not have a valid passenger capacity. Please contact admin or staff to update it.",
      {
        seat_capacity: seatCapacity,
        trip_id: tripId,
        vehicle_id: tripRow.vehicleId,
      },
    );
  }

  const [routeStops, waitingRows, occupiedSeatRows] = await Promise.all([
    db
      .select({
        id: stops.id,
        stopName: stops.stopName,
        stopOrder: stops.stopOrder,
      })
      .from(stops)
      .where(eq(stops.routeId, tripRow.routeId))
      .orderBy(asc(stops.stopOrder)),
    db
      .select({
        pickupStopId: passengerTrips.pickupStopId,
        waitingCount: count(passengerTrips.id),
      })
      .from(passengerTrips)
      .where(
        and(
          eq(passengerTrips.tripId, tripId),
          inArray(passengerTrips.status, [...ACTIVE_PASSENGER_STATUSES]),
        ),
      )
      .groupBy(passengerTrips.pickupStopId),
    db
      .select({
        occupiedSeats: count(passengerTrips.id),
      })
      .from(passengerTrips)
      .where(
        and(
          eq(passengerTrips.tripId, tripId),
          inArray(passengerTrips.status, [...ACTIVE_PASSENGER_STATUSES]),
        ),
      )
      .limit(1),
  ]);

  const occupiedSeatRow = occupiedSeatRows[0] ?? null;
  const waitingCountByStopId = new Map<string, number>();
  for (const row of waitingRows) {
    if (row.pickupStopId) {
      waitingCountByStopId.set(row.pickupStopId, Number(row.waitingCount));
    }
  }

  const currentStopOrder = tripRow.currentStopId
    ? routeStops.find((stopRow) => stopRow.id === tripRow.currentStopId)?.stopOrder ?? null
    : null;

  const mappedStops = routeStops.map((stopRow) => ({
    id: stopRow.id,
    scheduled_time: addMinutes(
      tripRow.scheduledDepartureTime,
      Math.max(0, stopRow.stopOrder - 1) * ROUTE_STOP_INTERVAL_MINUTES,
    ),
    status: deriveStopStatus(currentStopOrder, stopRow.stopOrder),
    stop_name: stopRow.stopName ?? `Stop ${stopRow.stopOrder}`,
    waiting_count: waitingCountByStopId.get(stopRow.id) ?? 0,
    stopOrder: stopRow.stopOrder,
  }));

  const nextStop = mappedStops.find((stopRow) => stopRow.status === "current")
    ?? mappedStops.find((stopRow) => stopRow.status === "upcoming")
    ?? mappedStops[mappedStops.length - 1];

  const etaMinutes = nextStop
    ? Math.max(
        0,
        Math.round((nextStop.scheduled_time.getTime() - Date.now()) / 60_000),
      )
    : 0;

  return {
    eta_minutes: etaMinutes,
    next_stop_label: nextStop?.stop_name ?? "Route complete",
    occupied_seats: Math.max(0, Number(occupiedSeatRow?.occupiedSeats ?? 0)),
    route_name: buildRouteName(tripRow.routeName, tripRow.startLocation, tripRow.endLocation),
    seat_capacity: seatCapacity,
    stops: mappedStops.map(({ stopOrder: _stopOrder, ...stopRow }) => stopRow),
    trip_id: tripRow.id,
    trip_started_at: tripRow.startTime,
    vehicle_code: tripRow.plateNumber ?? null,
  };
}

export async function driverListActiveTrips(userId: string) {
  const tripRows = await queryDriverTrips(userId, ["scheduled", "ongoing"]);
  const aggregates = await loadDriverTripAggregates(tripRows);

  return tripRows.map((row) => mapDriverMobileTrip(row, aggregates));
}

export async function driverListHistoryTrips(userId: string) {
  const tripRows = await queryDriverTrips(userId, ["completed"], "desc");
  const aggregates = await loadDriverTripAggregates(tripRows);

  return tripRows.map((row) => mapDriverMobileHistoryTrip(row, aggregates));
}

export async function driverGetTripDetails(
  userId: string,
  tripId: string,
) {
  const [tripRow] = await db
    .select({
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeId: trips.routeId,
      routeName: transitRoutes.routeName,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      vehicleCode: vehicles.plateNumber,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.driverUserId, userId),
      ),
    )
    .limit(1);

  if (!tripRow) {
    throw new NotFoundError("Trip not found for this driver.");
  }

  const aggregates = await loadDriverTripAggregates([tripRow]);

  if (tripRow.status === "completed" || tripRow.status === "cancelled") {
    return mapDriverMobileHistoryTrip(tripRow, aggregates);
  }

  return mapDriverMobileTrip(tripRow, aggregates);
}

export function driverReportEmergency(
  userId: string,
  tripId: string,
  input: DriverEmergencyBody,
) {
  return operationsReportDriverEmergency(tripId, input, userId);
}

export async function driverTrackTripLocation(
  userId: string,
  tripId: string,
  input: DriverLocationBody,
) {
  const [tripRow] = await db
    .select({
      id: trips.id,
      routeId: trips.routeId,
      status: trips.status,
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.driverUserId, userId),
      ),
    )
    .limit(1);

  if (!tripRow) {
    throw new NotFoundError("Trip not found for this driver.");
  }

  if (tripRow.status !== "ongoing") {
    throw new BadRequestError("Location tracking is only available for ongoing trips.");
  }

  if (!tripRow.vehicleId) {
    throw new BadRequestError("This trip does not have an assigned vehicle.");
  }

  const vehicleId = tripRow.vehicleId;
  const now = new Date();
  const currentStopId = await findNearestRouteStopId(
    tripRow.routeId,
    input.latitude,
    input.longitude,
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(vehicleLocations)
      .values({
        currentStopId,
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: now,
        vehicleId,
      })
      .onConflictDoUpdate({
        target: vehicleLocations.vehicleId,
        set: {
          currentStopId,
          latitude: input.latitude,
          longitude: input.longitude,
          updatedAt: now,
        },
      });

    await tx.insert(gpsLogs).values({
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt: now,
      vehicleId,
    });

    await tx
      .update(drivers)
      .set({
        lastActive: now,
        status: "driving",
      })
      .where(eq(drivers.userId, userId));

    await tx
      .update(vehicles)
      .set({
        status: "on_route",
      })
      .where(eq(vehicles.id, vehicleId));
  });

  return {
    current_stop_id: currentStopId,
    latitude: input.latitude,
    longitude: input.longitude,
    trip_id: tripId,
    updated_at: now,
    vehicle_id: vehicleId,
  };
}

export function driverListDrivers() {
  return operationsListDrivers();
}

export function driverCreateDriver(
  input: DriverCreateBody,
  actorUserId?: string,
) {
  return operationsCreateDriver(input, actorUserId);
}

export function driverUpdateDriver(
  driverUserId: string,
  input: DriverUpdateBody,
  actorUserId?: string,
) {
  return operationsUpdateDriver(driverUserId, input, actorUserId);
}

export function driverDeleteDriver(
  driverUserId: string,
  actorUserId?: string,
) {
  return operationsDeleteDriver(driverUserId, actorUserId);
}

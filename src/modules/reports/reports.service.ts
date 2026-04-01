import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
} from "drizzle-orm";
import { db } from "../../database/db";
import {
  passengerTrips,
  transitRoutes,
  trips,
  users,
  vehicles,
} from "../../database/schema";
import { buildExplicitWindow, formatHourBucket } from "./reports.utils";
import type { ReportQuery } from "./reports.validation";

const PASSENGER_COUNTED_STATUSES = [
  "booked",
  "waiting",
  "onboard",
  "completed",
] as const;

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

function buildFullName(
  firstName?: string | null,
  lastName?: string | null,
) {
  const values = [firstName, lastName]
    .map((value) => value?.trim())
    .filter(Boolean);

  return values.length > 0
    ? values.join(" ")
    : "Unassigned driver";
}

function matchesSearch(
  query: string | undefined,
  values: Array<string | null | undefined>,
) {
  if (!query?.trim()) {
    return true;
  }

  const needle = query.trim().toLowerCase();

  return values.some((value) => value?.toLowerCase().includes(needle));
}

export async function reportsGetTripHistory(query: ReportQuery) {
  const window = buildExplicitWindow(query.startDate, query.endDate);
  const rows = await db
    .select({
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      plateNumber: vehicles.plateNumber,
      routeName: transitRoutes.routeName,
      scheduledStart: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripDate: trips.tripDate,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        inArray(trips.status, [
          "completed",
          "cancelled",
        ]),
        window.startDateKey
          ? gte(trips.tripDate, window.startDateKey)
          : undefined,
        window.endDateKey
          ? lte(trips.tripDate, window.endDateKey)
          : undefined,
      ),
    )
    .orderBy(desc(trips.scheduledDepartureTime));

  return rows
    .filter((row) => matchesSearch(query.search, [
      row.plateNumber,
      row.driverFirstName,
      row.driverLastName,
      row.startLocation,
      row.endLocation,
    ]))
    .map((row) => ({
      actual_end: row.endTime ? row.endTime.toISOString() : null,
      actual_start: row.startTime ? row.startTime.toISOString() : null,
      driver_name: buildFullName(row.driverFirstName, row.driverLastName),
      id: row.id,
      plate_number: row.plateNumber ?? "Unassigned vehicle",
      route_name: buildRouteName(row.routeName, row.startLocation, row.endLocation),
      scheduled_start: row.scheduledStart.toISOString(),
      status: row.status,
      trip_date: row.tripDate,
    }));
}

export async function reportsGetPassengerVolume(query: ReportQuery) {
  const window = buildExplicitWindow(query.startDate, query.endDate);
  const rows = await db
    .select({
      endLocation: transitRoutes.endLocation,
      routeName: transitRoutes.routeName,
      startLocation: transitRoutes.startLocation,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .where(
      and(
        inArray(passengerTrips.status, [
          ...PASSENGER_COUNTED_STATUSES,
        ]),
        window.startDateKey
          ? gte(trips.tripDate, window.startDateKey)
          : undefined,
        window.endDateKey
          ? lte(trips.tripDate, window.endDateKey)
          : undefined,
      ),
    );

  const countsByRoute = new Map<string, number>();

  for (const row of rows) {
    const routeName = buildRouteName(row.routeName, row.startLocation, row.endLocation);
    countsByRoute.set(routeName, (countsByRoute.get(routeName) ?? 0) + 1);
  }

  return [...countsByRoute.entries()]
    .map(([
      route,
      passengers,
    ]) => ({
      passengers,
      route,
    }))
    .sort((left, right) => right.passengers - left.passengers);
}

export async function reportsGetPeakHours(query: ReportQuery) {
  const window = buildExplicitWindow(query.startDate, query.endDate);
  const rows = await db
    .select({
      passengerId: passengerTrips.id,
      scheduledStart: trips.scheduledDepartureTime,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .where(
      and(
        inArray(passengerTrips.status, [
          ...PASSENGER_COUNTED_STATUSES,
        ]),
        window.startDateKey
          ? gte(trips.tripDate, window.startDateKey)
          : undefined,
        window.endDateKey
          ? lte(trips.tripDate, window.endDateKey)
          : undefined,
      ),
    );

  const countsByHour = new Map<string, number>();

  for (const row of rows) {
    const hour = formatHourBucket(row.scheduledStart);
    countsByHour.set(hour, (countsByHour.get(hour) ?? 0) + 1);
  }

  return [...countsByHour.entries()]
    .map(([
      hour,
      passengers,
    ]) => ({
      hour,
      passengers,
    }))
    .sort((left, right) => left.hour.localeCompare(right.hour));
}

export async function reportsGetDailyTrend(query: ReportQuery) {
  const window = buildExplicitWindow(query.startDate, query.endDate);
  const rows = await db
    .select({
      tripDate: trips.tripDate,
    })
    .from(passengerTrips)
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .where(
      and(
        inArray(passengerTrips.status, [
          ...PASSENGER_COUNTED_STATUSES,
        ]),
        window.startDateKey
          ? gte(trips.tripDate, window.startDateKey)
          : undefined,
        window.endDateKey
          ? lte(trips.tripDate, window.endDateKey)
          : undefined,
      ),
    );

  const countsByDate = new Map<string, number>();

  for (const row of rows) {
    countsByDate.set(row.tripDate, (countsByDate.get(row.tripDate) ?? 0) + 1);
  }

  return [...countsByDate.entries()]
    .map(([
      date,
      passengers,
    ]) => ({
      date,
      passengers,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function reportsGetDriverPerformance(query: ReportQuery) {
  const window = buildExplicitWindow(query.startDate, query.endDate);
  const rows = await db
    .select({
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      driverUserId: trips.driverUserId,
      scheduledStart: trips.scheduledDepartureTime,
      startTime: trips.startTime,
      status: trips.status,
    })
    .from(trips)
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(
      and(
        window.startDateKey
          ? gte(trips.tripDate, window.startDateKey)
          : undefined,
        window.endDateKey
          ? lte(trips.tripDate, window.endDateKey)
          : undefined,
      ),
    );

  const metricsByDriver = new Map<string, {
    delayed: number;
    driver: string;
    onTime: number;
    trips: number;
  }>();

  for (const row of rows) {
    if (!row.driverUserId) {
      continue;
    }

    const metric = metricsByDriver.get(row.driverUserId) ?? {
      delayed: 0,
      driver: buildFullName(row.driverFirstName, row.driverLastName),
      onTime: 0,
      trips: 0,
    };

    metric.trips += 1;

    if (row.startTime) {
      const delayMinutes = (row.startTime.getTime() - row.scheduledStart.getTime()) / 60000;

      if (delayMinutes <= 5) {
        metric.onTime += 1;
      } else {
        metric.delayed += 1;
      }
    } else if (row.status === "cancelled") {
      metric.delayed += 1;
    }

    metricsByDriver.set(row.driverUserId, metric);
  }

  return [...metricsByDriver.values()]
    .filter((row) => matchesSearch(query.search, [
      row.driver,
    ]))
    .sort((left, right) => right.trips - left.trips);
}

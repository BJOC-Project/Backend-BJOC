import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import {
  activityLogs,
  drivers,
  gpsLogs,
  notifications,
  passengerTrips,
  roles,
  stops,
  tripEmergencyReports,
  transitRoutes,
  trips,
  users,
  vehicleAssignments,
  vehicleLocations,
  vehicles,
} from "../../database/schema";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/app-error";
import { hashPassword } from "../../library/bcrypt";
import {
  finalizeCancelledTripPassengers,
  finalizeCompletedTripPassengers,
  syncTripPassengerLifecycle,
} from "../trips/passenger-lifecycle.service";

const DASHBOARD_TIME_ZONE = "Asia/Manila";
const NOTIFICATION_ROLE_TARGETS = ["admin", "staff"] as const;
const ACTIVE_PASSENGER_STATUSES = ["booked", "waiting", "onboard"] as const;
const ACTIVE_TRIP_STATUSES = ["scheduled", "ongoing"] as const;
const EARTH_RADIUS_KM = 6371;
const AVG_ROUTE_SPEED_KPH = 18;
const ROUTE_STOP_INTERVAL_MINUTES = 5;
const MIN_TRIP_OCCUPANCY_MINUTES = 30;
const DRIVER_TRIP_START_RADIUS_KM = 10;

type DateFilter = "today" | "week" | "month";

type DriverCreateInput = {
  contact_number?: string;
  email: string;
  first_name: string;
  last_name: string;
  license_number: string;
  middle_name?: string;
  password: string;
  status?: "offline" | "available" | "driving" | "suspended";
};

type DriverUpdateInput = {
  contact_number?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  license_number?: string;
  middle_name?: string;
  password?: string;
  status?: "offline" | "available" | "driving" | "suspended";
};

type VehicleCreateInput = {
  capacity: number;
  driver_id?: string | null;
  model?: string;
  plate_number: string;
  status?: "offline" | "available" | "on_route" | "maintenance";
};

type VehicleUpdateInput = {
  capacity?: number;
  driver_id?: string | null;
  model?: string;
  plate_number?: string;
  status?: "offline" | "available" | "on_route" | "maintenance";
};

type RouteCreateInput = {
  end_location: string;
  route_name?: string;
  start_location: string;
};

type RouteUpdateInput = Partial<RouteCreateInput>;

type TripStartInput = {
  latitude?: number;
  longitude?: number;
};

type StopCreateInput = {
  latitude: number;
  longitude: number;
  route_id: string;
  stop_name: string;
  stop_order?: number;
};

type StopUpdateInput = {
  latitude?: number;
  longitude?: number;
  stop_name?: string;
};

type StopOrderUpdateInput = Array<{
  id: string;
  stop_order: number;
}>;

type TripScheduleInput = {
  route_id: string;
  scheduled_departure_time: string;
  trip_date?: string;
  vehicle_id: string;
};

type TripRescheduleInput = {
  scheduled_departure_time: string;
};

type TripEndInput = {
  client_action_id?: string;
  passenger_count: number;
};

type DriverEmergencyInput = {
  client_action_id: string;
  passenger_count: number;
  reason_text?: string;
  reason_type: "vehicle_problem" | "other";
};

type ActivityLogQuery = {
  action?: string;
  limit?: number;
  module?: string;
  offset?: number;
  search?: string;
};

type NotificationListQuery = {
  limit?: number;
  page?: number;
  severity?: "info" | "success" | "warning" | "critical";
  type?: "trip" | "vehicle" | "driver" | "maintenance" | "route" | "system" | "emergency" | "message";
};

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatHourLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

function addDays(
  date: Date,
  amount: number,
) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function normalizeFilter(filter?: string): DateFilter {
  if (filter === "week" || filter === "month") {
    return filter;
  }

  return "today";
}

function buildDateRange(filter?: string) {
  const normalizedFilter = normalizeFilter(filter);
  const now = new Date();
  const endAt = now;

  if (normalizedFilter === "today") {
    const startKey = formatDateKey(now);

    return {
      endAt,
      endDateKey: startKey,
      filter: normalizedFilter,
      startAt: parseDateKey(startKey),
      startDateKey: startKey,
    };
  }

  if (normalizedFilter === "week") {
    const startDate = addDays(now, -6);
    const startDateKey = formatDateKey(startDate);
    const endDateKey = formatDateKey(now);

    return {
      endAt,
      endDateKey,
      filter: normalizedFilter,
      startAt: parseDateKey(startDateKey),
      startDateKey,
    };
  }

  const startDate = new Date(now);
  startDate.setDate(1);

  const startDateKey = formatDateKey(startDate);
  const endDateKey = formatDateKey(now);

  return {
    endAt,
    endDateKey,
    filter: normalizedFilter,
    startAt: parseDateKey(startDateKey),
    startDateKey,
  };
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

function buildFullName(
  firstName?: string | null,
  lastName?: string | null,
) {
  const segments = [firstName, lastName]
    .map((value) => value?.trim())
    .filter(Boolean);

  return segments.length > 0
    ? segments.join(" ")
    : null;
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function addMinutes(
  baseDate: Date,
  minutesToAdd: number,
) {
  return new Date(baseDate.getTime() + minutesToAdd * 60_000);
}

function formatScheduleWindow(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: DASHBOARD_TIME_ZONE,
  }).format(date);
}

function calculateRouteDistanceKm(routeStops: Array<{
  latitude: number | null;
  longitude: number | null;
  stopOrder: number;
}>) {
  const orderedStops = [...routeStops].sort((left, right) => left.stopOrder - right.stopOrder);
  let totalDistance = 0;

  for (let index = 1; index < orderedStops.length; index += 1) {
    const previousStop = orderedStops[index - 1];
    const currentStop = orderedStops[index];

    if (
      previousStop.latitude === null ||
      previousStop.longitude === null ||
      currentStop.latitude === null ||
      currentStop.longitude === null
    ) {
      continue;
    }

    totalDistance += haversineDistanceKm(
      previousStop.latitude,
      previousStop.longitude,
      currentStop.latitude,
      currentStop.longitude,
    );
  }

  return totalDistance;
}

function estimateTripOccupancyMinutes(
  distanceKm: number,
  stopCount: number,
) {
  const drivingMinutes = Math.max(5, Math.round((distanceKm / AVG_ROUTE_SPEED_KPH) * 60));
  const stopHandlingMinutes = Math.max(0, stopCount - 1) * ROUTE_STOP_INTERVAL_MINUTES;

  return Math.max(MIN_TRIP_OCCUPANCY_MINUTES, drivingMinutes + stopHandlingMinutes);
}

async function getRouteOccupancyMinutes(
  routeId: string,
  cache: Map<string, number>,
) {
  const cachedMinutes = cache.get(routeId);

  if (typeof cachedMinutes === "number") {
    return cachedMinutes;
  }

  const routeStops = await db
    .select({
      latitude: stops.latitude,
      longitude: stops.longitude,
      stopOrder: stops.stopOrder,
    })
    .from(stops)
    .where(eq(stops.routeId, routeId))
    .orderBy(asc(stops.stopOrder));

  const occupancyMinutes = routeStops.length === 0
    ? MIN_TRIP_OCCUPANCY_MINUTES
    : estimateTripOccupancyMinutes(
      calculateRouteDistanceKm(routeStops),
      routeStops.length,
    );

  cache.set(routeId, occupancyMinutes);
  return occupancyMinutes;
}

async function buildTripOccupancyWindow(
  tripRow: {
    endTime?: Date | null;
    routeId: string;
    scheduledDepartureTime: Date;
    startTime?: Date | null;
    status: "cancelled" | "completed" | "ongoing" | "scheduled";
  },
  routeDurationCache: Map<string, number>,
) {
  const occupiedMinutes = await getRouteOccupancyMinutes(tripRow.routeId, routeDurationCache);
  const windowStart = tripRow.status === "ongoing"
    ? tripRow.startTime ?? tripRow.scheduledDepartureTime
    : tripRow.scheduledDepartureTime;
  const plannedWindowEnd = addMinutes(windowStart, occupiedMinutes);

  if (tripRow.endTime) {
    return {
      windowEnd: tripRow.endTime,
      windowStart,
    };
  }

  if (tripRow.status === "ongoing") {
    return {
      windowEnd: plannedWindowEnd.getTime() > Date.now() ? plannedWindowEnd : new Date(),
      windowStart,
    };
  }

  return {
    windowEnd: plannedWindowEnd,
    windowStart,
  };
}

async function assertNoTripScheduleConflict(input: {
  driverUserId: string;
  excludeTripId?: string;
  routeId: string;
  scheduledDepartureTime: Date;
  vehicleId: string;
}) {
  const candidateTrips = await db
    .select({
      driverUserId: trips.driverUserId,
      endTime: trips.endTime,
      id: trips.id,
      routeId: trips.routeId,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startTime: trips.startTime,
      status: trips.status,
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .where(
      and(
        inArray(trips.status, ACTIVE_TRIP_STATUSES),
        or(
          eq(trips.driverUserId, input.driverUserId),
          eq(trips.vehicleId, input.vehicleId),
        ),
        input.excludeTripId ? ne(trips.id, input.excludeTripId) : undefined,
      ),
    );

  if (candidateTrips.length === 0) {
    return;
  }

  const routeDurationCache = new Map<string, number>();
  const nextTripWindow = await buildTripOccupancyWindow(
    {
      routeId: input.routeId,
      scheduledDepartureTime: input.scheduledDepartureTime,
      status: "scheduled",
    },
    routeDurationCache,
  );

  for (const candidateTrip of candidateTrips) {
    const existingTripWindow = await buildTripOccupancyWindow(candidateTrip, routeDurationCache);
    const windowsOverlap =
      nextTripWindow.windowStart.getTime() < existingTripWindow.windowEnd.getTime() &&
      existingTripWindow.windowStart.getTime() < nextTripWindow.windowEnd.getTime();

    if (!windowsOverlap) {
      continue;
    }

    const resourceLabel =
      candidateTrip.vehicleId === input.vehicleId && candidateTrip.driverUserId === input.driverUserId
        ? "vehicle and driver"
        : candidateTrip.vehicleId === input.vehicleId
        ? "vehicle"
        : "driver";

    throw new ConflictError(
      `This trip schedule is already occupied for the selected ${resourceLabel} from ${formatScheduleWindow(existingTripWindow.windowStart)} to ${formatScheduleWindow(existingTripWindow.windowEnd)}.`,
    );
  }
}

function deriveNotificationSeverity(
  title: string,
  message: string,
) {
  const content = `${title} ${message}`.toLowerCase();

  if (
    content.includes("deleted") ||
    content.includes("failed") ||
    content.includes("error") ||
    content.includes("suspend")
  ) {
    return "critical";
  }

  if (
    content.includes("cancel") ||
    content.includes("warning") ||
    content.includes("offline")
  ) {
    return "warning";
  }

  if (
    content.includes("created") ||
    content.includes("scheduled") ||
    content.includes("published")
  ) {
    return "success";
  }

  return "info";
}

async function getRoleId(roleName: "driver" | "admin" | "staff") {
  const [roleRow] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);

  if (!roleRow) {
    throw new NotFoundError(`${roleName} role is not seeded.`);
  }

  return roleRow.id;
}

async function getActorRole(actorUserId?: string) {
  if (!actorUserId) {
    return null;
  }

  const [actorRow] = await db
    .select({
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, actorUserId))
    .limit(1);

  return actorRow?.role ?? null;
}

async function assertDriverOwnsTripIfNeeded(input: {
  actorUserId?: string;
  driverUserId: string | null;
}) {
  if (!input.actorUserId) {
    return null;
  }

  const actorRole = await getActorRole(input.actorUserId);

  if (actorRole !== "driver") {
    return actorRole;
  }

  if (!input.driverUserId || input.driverUserId !== input.actorUserId) {
    throw new ForbiddenError("Drivers can only update trips assigned to them.");
  }

  return actorRole;
}

async function getVehicleSeatCapacity(vehicleId: string | null) {
  if (!vehicleId) {
    return null;
  }

  const [vehicleRow] = await db
    .select({
      capacity: vehicles.capacity,
    })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  return typeof vehicleRow?.capacity === "number"
    ? vehicleRow.capacity
    : null;
}

async function assertVehicleCapacityConfigured(input: {
  tripId: string;
  vehicleId: string | null;
}) {
  if (!input.vehicleId) {
    throw new BadRequestError("This trip does not have an assigned vehicle.", {
      trip_id: input.tripId,
    });
  }

  const seatCapacity = await getVehicleSeatCapacity(input.vehicleId);

  if (seatCapacity === null || seatCapacity <= 0) {
    throw new BadRequestError(
      "The assigned vehicle does not have a valid passenger capacity. Please update it from the admin or staff module before continuing.",
      {
        seat_capacity: seatCapacity,
        trip_id: input.tripId,
        vehicle_id: input.vehicleId,
      },
    );
  }

  return seatCapacity;
}

async function assertPassengerCountWithinCapacity(input: {
  passengerCount: number;
  tripId: string;
  vehicleId: string | null;
}) {
  if (input.passengerCount < 0) {
    throw new BadRequestError("Passenger count cannot be negative.");
  }

  const seatCapacity = await getVehicleSeatCapacity(input.vehicleId);

  if (seatCapacity !== null && input.passengerCount > seatCapacity) {
    throw new BadRequestError(`Passenger count cannot exceed seat capacity (${seatCapacity}).`, {
      passenger_count: input.passengerCount,
      seat_capacity: seatCapacity,
      trip_id: input.tripId,
    });
  }
}

async function assertDriverExists(driverUserId: string) {
  const [driverRow] = await db
    .select({
      userId: drivers.userId,
    })
    .from(drivers)
    .where(eq(drivers.userId, driverUserId))
    .limit(1);

  if (!driverRow) {
    throw new NotFoundError("Driver not found.");
  }
}

async function assertVehicleExists(vehicleId: string) {
  const [vehicleRow] = await db
    .select({
      id: vehicles.id,
    })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  if (!vehicleRow) {
    throw new NotFoundError("Vehicle not found.");
  }
}

async function assertRouteExists(routeId: string) {
  const [routeRow] = await db
    .select({
      id: transitRoutes.id,
    })
    .from(transitRoutes)
    .where(eq(transitRoutes.id, routeId))
    .limit(1);

  if (!routeRow) {
    throw new NotFoundError("Route not found.");
  }
}

async function assertStopExists(stopId: string) {
  const [stopRow] = await db
    .select({
      id: stops.id,
    })
    .from(stops)
    .where(eq(stops.id, stopId))
    .limit(1);

  if (!stopRow) {
    throw new NotFoundError("Stop not found.");
  }
}

async function ensureUniqueDriverEmail(
  email: string,
  excludeUserId?: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser && existingUser.id !== excludeUserId) {
    throw new ConflictError("Email is already registered.");
  }
}

async function ensureUniqueLicenseNumber(
  licenseNumber: string,
  excludeUserId?: string,
) {
  const [existingDriver] = await db
    .select({
      userId: drivers.userId,
    })
    .from(drivers)
    .where(eq(drivers.licenseNumber, licenseNumber.trim()))
    .limit(1);

  if (existingDriver && existingDriver.userId !== excludeUserId) {
    throw new ConflictError("License number is already registered.");
  }
}

async function ensureUniquePlateNumber(
  plateNumber: string,
  excludeVehicleId?: string,
) {
  const [existingVehicle] = await db
    .select({
      id: vehicles.id,
    })
    .from(vehicles)
    .where(eq(vehicles.plateNumber, plateNumber.trim()))
    .limit(1);

  if (existingVehicle && existingVehicle.id !== excludeVehicleId) {
    throw new ConflictError("Plate number is already registered.");
  }
}

export async function writeActivityLog(input: {
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  module: string;
  performedBy?: string;
  targetUserId?: string;
}) {
  await db.insert(activityLogs).values({
    action: input.action,
    description: input.description,
    metadata: input.metadata ?? null,
    module: input.module,
    performedBy: input.performedBy ?? null,
    targetUserId: input.targetUserId ?? null,
  });

  logger.info({
    msg: "Activity log recorded",
    action: input.action,
    module: input.module,
    performedBy: input.performedBy,
    targetUserId: input.targetUserId,
  });
}

export async function notifyAdminsAndStaff(input: {
  entity_id?: string;
  entity_type?: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity?: "info" | "success" | "warning" | "critical";
  title: string;
  type?: "trip" | "vehicle" | "driver" | "maintenance" | "route" | "system" | "emergency" | "message";
}) {
  const targetUsers = await db
    .select({
      id: users.id,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(inArray(roles.name, [
      ...NOTIFICATION_ROLE_TARGETS,
    ]));

  if (targetUsers.length === 0) {
    return;
  }

  await db.insert(notifications).values(
    targetUsers.map((targetUser) => ({
      entityId: input.entity_id ?? null,
      entityType: input.entity_type ?? null,
      isRead: false,
      message: input.message,
      metadata: input.metadata ?? null,
      severity: input.severity ?? deriveNotificationSeverity(input.title, input.message),
      targetUserId: targetUser.id,
      title: input.title,
      type: input.type ?? "system",
    })),
  );

  logger.info({
    msg: "Admin and staff notification created",
    title: input.title,
    targetCount: targetUsers.length,
  });
}

async function getDriverAssignments() {
  const assignmentRows = await db
    .select({
      driverUserId: vehicleAssignments.driverUserId,
      vehicleId: vehicleAssignments.vehicleId,
    })
    .from(vehicleAssignments);

  const assignmentsByDriverId = new Map<string, string>();
  const assignmentsByVehicleId = new Map<string, string>();

  for (const row of assignmentRows) {
    assignmentsByDriverId.set(row.driverUserId, row.vehicleId);
    assignmentsByVehicleId.set(row.vehicleId, row.driverUserId);
  }

  return {
    assignmentsByDriverId,
    assignmentsByVehicleId,
  };
}

async function setVehicleDriverAssignment(
  vehicleId: string,
  driverUserId: string | null,
) {
  await db.transaction(async (tx) => {
    if (!driverUserId) {
      await tx
        .delete(vehicleAssignments)
        .where(eq(vehicleAssignments.vehicleId, vehicleId));
      return;
    }

    const [vehicleAssignmentRow] = await tx
      .select({
        driverUserId: vehicleAssignments.driverUserId,
      })
      .from(vehicleAssignments)
      .where(eq(vehicleAssignments.vehicleId, vehicleId))
      .limit(1);

    if (vehicleAssignmentRow && vehicleAssignmentRow.driverUserId !== driverUserId) {
      throw new ConflictError("This vehicle is already assigned to another driver.");
    }

    const [driverAssignmentRow] = await tx
      .select({
        vehicleId: vehicleAssignments.vehicleId,
      })
      .from(vehicleAssignments)
      .where(eq(vehicleAssignments.driverUserId, driverUserId))
      .limit(1);

    if (driverAssignmentRow && driverAssignmentRow.vehicleId !== vehicleId) {
      throw new ConflictError("This driver is already assigned to another vehicle.");
    }

    if (vehicleAssignmentRow && driverAssignmentRow) {
      return;
    }

    await tx.insert(vehicleAssignments).values({
      driverUserId,
      vehicleId,
    });
  });
}

async function getAssignedDriverForVehicle(vehicleId: string) {
  const [assignmentRow] = await db
    .select({
      driverUserId: vehicleAssignments.driverUserId,
    })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.vehicleId, vehicleId))
    .limit(1);

  if (!assignmentRow) {
    return null;
  }

  return assignmentRow.driverUserId;
}

async function getVehicleOperationRows() {
  const vehicleRows = await db
    .select({
      capacity: vehicles.capacity,
      id: vehicles.id,
      locationLatitude: vehicleLocations.latitude,
      locationLongitude: vehicleLocations.longitude,
      locationUpdatedAt: vehicleLocations.updatedAt,
      model: vehicles.model,
      plateNumber: vehicles.plateNumber,
      status: vehicles.status,
    })
    .from(vehicles)
    .leftJoin(vehicleLocations, eq(vehicleLocations.vehicleId, vehicles.id))
    .orderBy(asc(vehicles.plateNumber));

  const tripRows = await db
    .select({
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      driverUserId: trips.driverUserId,
      endLocation: transitRoutes.endLocation,
      routeName: transitRoutes.routeName,
      routeId: trips.routeId,
      recordedPassengerCount: trips.recordedPassengerCount,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripId: trips.id,
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(
      inArray(trips.status, [
        ...ACTIVE_TRIP_STATUSES,
      ]),
    )
    .orderBy(asc(trips.scheduledDepartureTime));

  const activeTripIds = tripRows
    .map((row) => row.tripId)
    .filter(Boolean);

  const passengerCountRows = activeTripIds.length > 0
    ? await db
      .select({
        passengerCount: count(passengerTrips.id),
        tripId: passengerTrips.tripId,
      })
      .from(passengerTrips)
      .where(
        and(
          inArray(passengerTrips.tripId, activeTripIds),
          inArray(passengerTrips.status, [
            ...ACTIVE_PASSENGER_STATUSES,
          ]),
        ),
      )
      .groupBy(passengerTrips.tripId)
    : [];
  const onboardPassengerCountRows = activeTripIds.length > 0
    ? await db
      .select({
        onboardPassengerCount: count(passengerTrips.id),
        tripId: passengerTrips.tripId,
      })
      .from(passengerTrips)
      .where(
        and(
          inArray(passengerTrips.tripId, activeTripIds),
          eq(passengerTrips.status, "onboard"),
        ),
      )
      .groupBy(passengerTrips.tripId)
    : [];

  const { assignmentsByVehicleId } = await getDriverAssignments();
  const assignedDriverIds = [...assignmentsByVehicleId.values()];
  const assignedDriverRows = assignedDriverIds.length > 0
    ? await db
      .select({
        firstName: users.firstName,
        id: users.id,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, assignedDriverIds))
    : [];

  const passengerCountByTripId = new Map<string, number>();
  const onboardPassengerCountByTripId = new Map<string, number>();
  const assignedDriverById = new Map<string, { firstName: string; lastName: string }>();
  const tripRowsByVehicleId = new Map<string, typeof tripRows>();

  for (const row of passengerCountRows) {
    passengerCountByTripId.set(row.tripId, Number(row.passengerCount));
  }

  for (const row of onboardPassengerCountRows) {
    onboardPassengerCountByTripId.set(row.tripId, Number(row.onboardPassengerCount));
  }

  for (const row of assignedDriverRows) {
    assignedDriverById.set(row.id, {
      firstName: row.firstName,
      lastName: row.lastName,
    });
  }

  for (const row of tripRows) {
    if (!row.vehicleId) {
      continue;
    }

    const existingRows = tripRowsByVehicleId.get(row.vehicleId) ?? [];
    existingRows.push(row);
    tripRowsByVehicleId.set(row.vehicleId, existingRows);
  }

  return vehicleRows.map((vehicleRow) => {
    const relatedTrips = tripRowsByVehicleId.get(vehicleRow.id) ?? [];
    const ongoingTrip = relatedTrips.find((tripRow) => tripRow.status === "ongoing") ?? null;
    const scheduledTrip = relatedTrips.find((tripRow) => tripRow.status === "scheduled") ?? null;
    const relevantTrip = ongoingTrip ?? scheduledTrip;

    const assignedDriverId = assignmentsByVehicleId.get(vehicleRow.id) ?? null;
    const assignedDriver = assignedDriverId
      ? assignedDriverById.get(assignedDriverId) ?? null
      : null;

    const routeName = relevantTrip
      ? buildRouteName(relevantTrip.routeName, relevantTrip.startLocation, relevantTrip.endLocation)
      : null;

    const tripPassengerCount = !relevantTrip
      ? 0
      : relevantTrip.status === "ongoing"
        ? Math.max(
            0,
            Number(relevantTrip.recordedPassengerCount ?? 0),
            onboardPassengerCountByTripId.get(relevantTrip.tripId) ?? 0,
          )
        : passengerCountByTripId.get(relevantTrip.tripId) ?? 0;

    const loadPercentage = vehicleRow.capacity && vehicleRow.capacity > 0
      ? Math.round((tripPassengerCount / vehicleRow.capacity) * 100)
      : 0;

    const now = new Date();
    const minutesToDeparture = scheduledTrip
      ? Math.max(
        0,
        Math.round((scheduledTrip.scheduledDepartureTime.getTime() - now.getTime()) / 60000),
      )
      : null;

    const driverName = relevantTrip
      ? buildFullName(relevantTrip.driverFirstName, relevantTrip.driverLastName)
      : buildFullName(assignedDriver?.firstName, assignedDriver?.lastName);

    const isOnline = vehicleRow.locationUpdatedAt
      ? now.getTime() - vehicleRow.locationUpdatedAt.getTime() <= 5 * 60 * 1000
      : false;

    const operatorStatus = ongoingTrip
      ? "Driving"
      : scheduledTrip
        ? "Standby"
        : vehicleRow.status === "available"
          ? "Standby"
          : "Offline";

    const adminStatus = ongoingTrip
      ? "on_trip"
      : scheduledTrip
        ? "pending"
        : vehicleRow.status === "available"
          ? "standby"
          : "offline";

    return {
      adminStatus,
      assignedDriverId,
      capacity: vehicleRow.capacity ?? 0,
      driverName,
      eta: ongoingTrip
        ? "On route"
        : minutesToDeparture !== null
          ? `${minutesToDeparture} min`
          : null,
      isOnline,
      latitude: vehicleRow.locationLatitude ?? 14.440677,
      load: Math.max(0, Math.min(100, loadPercentage)),
      longitude: vehicleRow.locationLongitude ?? 120.960164,
      model: vehicleRow.model ?? null,
      operatorStatus,
      plateNumber: vehicleRow.plateNumber ?? "Unknown vehicle",
      routeName,
      updatedAt: vehicleRow.locationUpdatedAt ?? null,
      vehicleId: vehicleRow.id,
    };
  });
}

async function getRouteDirectory(routeIds?: string[]) {
  const rows = await db
    .select({
      endLocation: transitRoutes.endLocation,
      id: transitRoutes.id,
      isActive: transitRoutes.isActive,
      routeName: transitRoutes.routeName,
      startLocation: transitRoutes.startLocation,
      updatedAt: transitRoutes.updatedAt,
    })
    .from(transitRoutes)
    .where(
      routeIds && routeIds.length > 0
        ? inArray(transitRoutes.id, routeIds)
        : undefined,
    )
    .orderBy(desc(transitRoutes.updatedAt));

  return rows.map((row) => ({
    end_location: row.endLocation,
    id: row.id,
    is_active: row.isActive,
    route_name: buildRouteName(row.routeName, row.startLocation, row.endLocation),
    start_location: row.startLocation,
    updated_at: row.updatedAt,
  }));
}

async function mapTripRows(
  statusFilter: Array<"scheduled" | "ongoing" | "completed" | "cancelled">,
) {
  const rows = await db
    .select({
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeName: transitRoutes.routeName,
      routeId: trips.routeId,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripDate: trips.tripDate,
      vehicleId: trips.vehicleId,
      vehiclePlateNumber: vehicles.plateNumber,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(inArray(trips.status, statusFilter))
    .orderBy(desc(trips.scheduledDepartureTime));

  return rows.map((row) => ({
    driver: buildFullName(row.driverFirstName, row.driverLastName) ?? "Unassigned driver",
    end_time: row.endTime,
    id: row.id,
    route: buildRouteName(row.routeName, row.startLocation, row.endLocation),
    route_id: row.routeId,
    scheduled_departure_time: row.scheduledDepartureTime,
    start_time: row.startTime,
    status: row.status,
    trip_date: row.tripDate,
    vehicle: row.vehiclePlateNumber ?? "Unassigned vehicle",
    vehicle_id: row.vehicleId,
  }));
}

export async function operationsListDrivers() {
  const rows = await db
    .select({
      contactNumber: users.contact,
      email: users.email,
      firstName: users.firstName,
      id: users.id,
      lastName: users.lastName,
      licenseNumber: drivers.licenseNumber,
      middleName: users.middleName,
      status: drivers.status,
    })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .orderBy(asc(users.firstName), asc(users.lastName));

  const { assignmentsByDriverId } = await getDriverAssignments();

  logger.info({
    msg: "Driver list loaded",
    count: rows.length,
  });

  return rows.map((row) => ({
    contact_number: row.contactNumber,
    email: row.email,
    first_name: row.firstName,
    id: row.id,
    last_name: row.lastName,
    license_number: row.licenseNumber,
    middle_name: row.middleName,
    status: row.status,
    vehicle_id: assignmentsByDriverId.get(row.id) ?? null,
  }));
}

export async function operationsCreateDriver(
  input: DriverCreateInput,
  actorUserId?: string,
) {
  await ensureUniqueDriverEmail(input.email);
  await ensureUniqueLicenseNumber(input.license_number);

  const driverRoleId = await getRoleId("driver");
  const passwordHash = await hashPassword(input.password);

  const [createdUser] = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        contact: input.contact_number?.trim() || null,
        email: input.email.trim().toLowerCase(),
        firstName: input.first_name.trim(),
        lastName: input.last_name.trim(),
        middleName: input.middle_name?.trim() || null,
        passwordHash,
        roleId: driverRoleId,
        status: "active",
      })
      .returning({
        email: users.email,
        firstName: users.firstName,
        id: users.id,
        lastName: users.lastName,
      });

    await tx.insert(drivers).values({
      lastActive: null,
      licenseNumber: input.license_number.trim(),
      status: input.status ?? "offline",
      userId: newUser.id,
    });

    return [newUser];
  });

  await writeActivityLog({
    action: "CREATE_DRIVER",
    description: `Created driver ${createdUser.firstName} ${createdUser.lastName}.`,
    module: "drivers",
    performedBy: actorUserId,
    targetUserId: createdUser.id,
  });

  await notifyAdminsAndStaff({
    message: `Driver ${createdUser.firstName} ${createdUser.lastName} was added to the fleet.`,
    title: "Driver created",
  });

  logger.info({
    msg: "Driver created",
    actorUserId,
    driverUserId: createdUser.id,
    email: createdUser.email,
  });

  const driversList = await operationsListDrivers();

  return driversList.find((driverRow) => driverRow.id === createdUser.id) ?? null;
}

export async function operationsUpdateDriver(
  driverUserId: string,
  input: DriverUpdateInput,
  actorUserId?: string,
) {
  await assertDriverExists(driverUserId);

  if (input.email) {
    await ensureUniqueDriverEmail(input.email, driverUserId);
  }

  if (input.license_number) {
    await ensureUniqueLicenseNumber(input.license_number, driverUserId);
  }

  const userUpdatePayload: Partial<typeof users.$inferInsert> = {};
  const driverUpdatePayload: Partial<typeof drivers.$inferInsert> = {};

  if (typeof input.first_name === "string") {
    userUpdatePayload.firstName = input.first_name.trim();
  }

  if (typeof input.middle_name === "string") {
    userUpdatePayload.middleName = input.middle_name.trim() || null;
  }

  if (typeof input.last_name === "string") {
    userUpdatePayload.lastName = input.last_name.trim();
  }

  if (typeof input.email === "string") {
    userUpdatePayload.email = input.email.trim().toLowerCase();
  }

  if (typeof input.contact_number === "string") {
    userUpdatePayload.contact = input.contact_number.trim() || null;
  }

  if (typeof input.password === "string" && input.password.trim()) {
    userUpdatePayload.passwordHash = await hashPassword(input.password.trim());
  }

  if (Object.keys(userUpdatePayload).length > 0) {
    userUpdatePayload.updatedAt = new Date();
  }

  if (typeof input.license_number === "string") {
    driverUpdatePayload.licenseNumber = input.license_number.trim();
  }

  if (typeof input.status === "string") {
    driverUpdatePayload.status = input.status;
  }

  await db.transaction(async (tx) => {
    if (Object.keys(userUpdatePayload).length > 0) {
      await tx
        .update(users)
        .set(userUpdatePayload)
        .where(eq(users.id, driverUserId));
    }

    if (Object.keys(driverUpdatePayload).length > 0) {
      await tx
        .update(drivers)
        .set(driverUpdatePayload)
        .where(eq(drivers.userId, driverUserId));
    }
  });

  await writeActivityLog({
    action: "UPDATE_DRIVER",
    description: `Updated driver ${driverUserId}.`,
    module: "drivers",
    performedBy: actorUserId,
    targetUserId: driverUserId,
  });

  await notifyAdminsAndStaff({
    message: "A driver profile was updated in the operations console.",
    title: "Driver updated",
  });

  logger.info({
    msg: "Driver updated",
    actorUserId,
    driverUserId,
  });

  const driversList = await operationsListDrivers();

  return driversList.find((driverRow) => driverRow.id === driverUserId) ?? null;
}

export async function operationsDeleteDriver(
  driverUserId: string,
  actorUserId?: string,
) {
  const [driverRow] = await db
    .select({
      firstName: users.firstName,
      id: users.id,
      lastName: users.lastName,
    })
    .from(users)
    .innerJoin(drivers, eq(drivers.userId, users.id))
    .where(eq(users.id, driverUserId))
    .limit(1);

  if (!driverRow) {
    throw new NotFoundError("Driver not found.");
  }

  await db.delete(users).where(eq(users.id, driverUserId));

  await writeActivityLog({
    action: "DELETE_DRIVER",
    description: `Deleted driver ${driverRow.firstName} ${driverRow.lastName}.`,
    module: "drivers",
    performedBy: actorUserId,
    targetUserId: driverUserId,
  });

  await notifyAdminsAndStaff({
    message: `Driver ${driverRow.firstName} ${driverRow.lastName} was removed from the fleet.`,
    title: "Driver deleted",
  });

  logger.info({
    msg: "Driver deleted",
    actorUserId,
    driverUserId,
  });

  return {
    id: driverUserId,
  };
}

export async function operationsListVehicles() {
  const vehicleRows = await db
    .select({
      capacity: vehicles.capacity,
      id: vehicles.id,
      model: vehicles.model,
      plateNumber: vehicles.plateNumber,
      status: vehicles.status,
    })
    .from(vehicles)
    .orderBy(asc(vehicles.plateNumber));

  const { assignmentsByVehicleId } = await getDriverAssignments();
  const driverIds = [...assignmentsByVehicleId.values()];

  const driverRows = driverIds.length > 0
    ? await db
      .select({
        firstName: users.firstName,
        id: users.id,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, driverIds))
    : [];

  const driverById = new Map<string, { firstName: string; lastName: string }>();

  for (const row of driverRows) {
    driverById.set(row.id, {
      firstName: row.firstName,
      lastName: row.lastName,
    });
  }

  logger.info({
    msg: "Vehicle list loaded",
    count: vehicleRows.length,
  });

  return vehicleRows.map((row) => {
    const driverId = assignmentsByVehicleId.get(row.id) ?? null;
    const driver = driverId
      ? driverById.get(driverId) ?? null
      : null;

    return {
      capacity: row.capacity ?? 0,
      driver: buildFullName(driver?.firstName, driver?.lastName),
      driver_id: driverId,
      id: row.id,
      model: row.model,
      plate_number: row.plateNumber,
      status: row.status,
    };
  });
}

export async function operationsCreateVehicle(
  input: VehicleCreateInput,
  actorUserId?: string,
) {
  await ensureUniquePlateNumber(input.plate_number);

  if (input.driver_id) {
    await assertDriverExists(input.driver_id);
  }

  const [createdVehicle] = await db
    .insert(vehicles)
    .values({
      capacity: input.capacity,
      model: input.model?.trim() || null,
      plateNumber: input.plate_number.trim(),
      status: input.status ?? "offline",
    })
    .returning({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
    });

  if (input.driver_id) {
    await setVehicleDriverAssignment(createdVehicle.id, input.driver_id);
  }

  await writeActivityLog({
    action: "CREATE_VEHICLE",
    description: `Created vehicle ${createdVehicle.plateNumber}.`,
    module: "vehicles",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: `Vehicle ${createdVehicle.plateNumber} was added to the fleet.`,
    title: "Vehicle created",
  });

  logger.info({
    msg: "Vehicle created",
    actorUserId,
    plateNumber: createdVehicle.plateNumber,
    vehicleId: createdVehicle.id,
  });

  const vehiclesList = await operationsListVehicles();

  return vehiclesList.find((vehicleRow) => vehicleRow.id === createdVehicle.id) ?? null;
}

export async function operationsUpdateVehicle(
  vehicleId: string,
  input: VehicleUpdateInput,
  actorUserId?: string,
) {
  await assertVehicleExists(vehicleId);

  if (input.plate_number) {
    await ensureUniquePlateNumber(input.plate_number, vehicleId);
  }

  if (input.driver_id) {
    await assertDriverExists(input.driver_id);
  }

  const vehicleUpdatePayload: Partial<typeof vehicles.$inferInsert> = {};

  if (typeof input.plate_number === "string") {
    vehicleUpdatePayload.plateNumber = input.plate_number.trim();
  }

  if (typeof input.model === "string") {
    vehicleUpdatePayload.model = input.model.trim() || null;
  }

  if (typeof input.capacity === "number") {
    vehicleUpdatePayload.capacity = input.capacity;
  }

  if (typeof input.status === "string") {
    vehicleUpdatePayload.status = input.status;
  }

  if (Object.keys(vehicleUpdatePayload).length > 0) {
    await db
      .update(vehicles)
      .set(vehicleUpdatePayload)
      .where(eq(vehicles.id, vehicleId));
  }

  if ("driver_id" in input) {
    await setVehicleDriverAssignment(vehicleId, input.driver_id ?? null);
  }

  await writeActivityLog({
    action: "UPDATE_VEHICLE",
    description: `Updated vehicle ${vehicleId}.`,
    module: "vehicles",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: "A vehicle profile was updated in the operations console.",
    title: "Vehicle updated",
  });

  logger.info({
    msg: "Vehicle updated",
    actorUserId,
    vehicleId,
  });

  const vehiclesList = await operationsListVehicles();

  return vehiclesList.find((vehicleRow) => vehicleRow.id === vehicleId) ?? null;
}

export async function operationsDeleteVehicle(
  vehicleId: string,
  actorUserId?: string,
) {
  const [vehicleRow] = await db
    .select({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
    })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  if (!vehicleRow) {
    throw new NotFoundError("Vehicle not found.");
  }

  await db.delete(vehicles).where(eq(vehicles.id, vehicleId));

  await writeActivityLog({
    action: "DELETE_VEHICLE",
    description: `Deleted vehicle ${vehicleRow.plateNumber}.`,
    module: "vehicles",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: `Vehicle ${vehicleRow.plateNumber} was removed from the fleet.`,
    title: "Vehicle deleted",
  });

  logger.info({
    msg: "Vehicle deleted",
    actorUserId,
    vehicleId,
  });

  return {
    id: vehicleId,
  };
}

export async function operationsListVehicleLocations() {
  const rows = await getVehicleOperationRows();

  logger.info({
    msg: "Vehicle location list loaded",
    count: rows.length,
  });

  return rows.map((row) => ({
    driver_name: row.driverName,
    latitude: row.latitude,
    longitude: row.longitude,
    plate_number: row.plateNumber,
    status: row.adminStatus,
    vehicle_id: row.vehicleId,
  }));
}

export async function operationsListRoutes() {
  const routeRows = await getRouteDirectory();

  logger.info({
    msg: "Route list loaded",
    count: routeRows.length,
  });

  return routeRows;
}

export async function operationsCreateRoute(
  input: RouteCreateInput,
  actorUserId?: string,
) {
  const [createdRoute] = await db
    .insert(transitRoutes)
    .values({
      endLocation: input.end_location.trim(),
      isActive: false,
      routeName: input.route_name?.trim() || null,
      startLocation: input.start_location.trim(),
      updatedAt: new Date(),
    })
    .returning({
      id: transitRoutes.id,
      endLocation: transitRoutes.endLocation,
      routeName: transitRoutes.routeName,
      startLocation: transitRoutes.startLocation,
    });

  await writeActivityLog({
    action: "CREATE_ROUTE",
    description: `Created route ${buildRouteName(createdRoute.routeName, createdRoute.startLocation, createdRoute.endLocation)}.`,
    module: "routes",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: `A new route from ${createdRoute.startLocation} to ${createdRoute.endLocation} was created.`,
    title: "Route created",
  });

  logger.info({
    msg: "Route created",
    actorUserId,
    routeId: createdRoute.id,
  });

  const routesList = await operationsListRoutes();

  return routesList.find((routeRow) => routeRow.id === createdRoute.id) ?? null;
}

export async function operationsUpdateRoute(
  routeId: string,
  input: RouteUpdateInput,
  actorUserId?: string,
) {
  await assertRouteExists(routeId);

  const routeUpdatePayload: Partial<typeof transitRoutes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof input.start_location === "string") {
    routeUpdatePayload.startLocation = input.start_location.trim();
  }

  if (typeof input.end_location === "string") {
    routeUpdatePayload.endLocation = input.end_location.trim();
  }

  if (typeof input.route_name === "string") {
    routeUpdatePayload.routeName = input.route_name.trim() || null;
  }

  await db
    .update(transitRoutes)
    .set(routeUpdatePayload)
    .where(eq(transitRoutes.id, routeId));

  await writeActivityLog({
    action: "UPDATE_ROUTE",
    description: `Updated route ${routeId}.`,
    module: "routes",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: "A route was updated in the route management console.",
    title: "Route updated",
  });

  logger.info({
    msg: "Route updated",
    actorUserId,
    routeId,
  });

  const routesList = await operationsListRoutes();

  return routesList.find((routeRow) => routeRow.id === routeId) ?? null;
}

export async function operationsDeleteRoute(
  routeId: string,
  actorUserId?: string,
) {
  const [routeRow] = await db
    .select({
      endLocation: transitRoutes.endLocation,
      id: transitRoutes.id,
      routeName: transitRoutes.routeName,
      startLocation: transitRoutes.startLocation,
    })
    .from(transitRoutes)
    .where(eq(transitRoutes.id, routeId))
    .limit(1);

  if (!routeRow) {
    throw new NotFoundError("Route not found.");
  }

  const [tripCount] = await db
    .select({ value: count() })
    .from(trips)
    .where(eq(trips.routeId, routeId));

  if ((tripCount?.value ?? 0) > 0) {
    throw new BadRequestError(
      "Cannot delete a route that has existing trips. Remove all associated trips first or deactivate the route instead.",
    );
  }

  await db.delete(transitRoutes).where(eq(transitRoutes.id, routeId));

  await writeActivityLog({
    action: "DELETE_ROUTE",
    description: `Deleted route ${buildRouteName(routeRow.routeName, routeRow.startLocation, routeRow.endLocation)}.`,
    module: "routes",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: `Route ${buildRouteName(routeRow.routeName, routeRow.startLocation, routeRow.endLocation)} was deleted.`,
    title: "Route deleted",
  });

  logger.info({
    msg: "Route deleted",
    actorUserId,
    routeId,
  });

  return {
    id: routeId,
  };
}

export async function operationsPublishRoute(
  routeId: string,
  actorUserId?: string,
) {
  await assertRouteExists(routeId);

  await db
    .update(transitRoutes)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(transitRoutes.id, routeId));

  await writeActivityLog({
    action: "PUBLISH_ROUTE",
    description: `Published route ${routeId}.`,
    module: "routes",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: "A route was published for passenger and driver visibility.",
    title: "Route published",
  });

  logger.info({
    msg: "Route published",
    actorUserId,
    routeId,
  });

  return {
    published_version: 1,
    success: true,
  };
}

export async function operationsListStops(routeId?: string) {
  const rows = await db
    .select({
      id: stops.id,
      isActive: stops.isActive,
      latitude: stops.latitude,
      longitude: stops.longitude,
      routeId: stops.routeId,
      stopName: stops.stopName,
      stopOrder: stops.stopOrder,
    })
    .from(stops)
    .where(routeId ? eq(stops.routeId, routeId) : undefined)
    .orderBy(asc(stops.routeId), asc(stops.stopOrder));

  logger.info({
    msg: "Stop list loaded",
    count: rows.length,
    routeId,
  });

  return rows.map((row) => ({
    id: row.id,
    is_active: row.isActive,
    latitude: row.latitude,
    longitude: row.longitude,
    route_id: row.routeId,
    stop_name: row.stopName,
    stop_order: row.stopOrder,
  }));
}

export async function operationsCreateStop(
  input: StopCreateInput,
  actorUserId?: string,
) {
  await assertRouteExists(input.route_id);

  const nextStopOrder = typeof input.stop_order === "number"
    ? input.stop_order
    : await (async () => {
      const [lastStop] = await db
        .select({
          stopOrder: stops.stopOrder,
        })
        .from(stops)
        .where(eq(stops.routeId, input.route_id))
        .orderBy(desc(stops.stopOrder))
        .limit(1);

      return (lastStop?.stopOrder ?? 0) + 1;
    })();

  const [createdStop] = await db
    .insert(stops)
    .values({
      latitude: input.latitude,
      longitude: input.longitude,
      routeId: input.route_id,
      stopName: input.stop_name.trim(),
      stopOrder: nextStopOrder,
      updatedAt: new Date(),
    })
    .returning({
      id: stops.id,
      stopName: stops.stopName,
    });

  await writeActivityLog({
    action: "CREATE_STOP",
    description: `Created stop ${createdStop.stopName}.`,
    module: "stops",
    performedBy: actorUserId,
  });

  logger.info({
    msg: "Stop created",
    actorUserId,
    routeId: input.route_id,
    stopId: createdStop.id,
  });

  const routeStops = await operationsListStops(input.route_id);

  return routeStops.find((stopRow) => stopRow.id === createdStop.id) ?? null;
}

export async function operationsUpdateStop(
  stopId: string,
  input: StopUpdateInput,
  actorUserId?: string,
) {
  await assertStopExists(stopId);

  const stopUpdatePayload: Partial<typeof stops.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof input.stop_name === "string") {
    stopUpdatePayload.stopName = input.stop_name.trim();
  }

  if (typeof input.latitude === "number") {
    stopUpdatePayload.latitude = input.latitude;
  }

  if (typeof input.longitude === "number") {
    stopUpdatePayload.longitude = input.longitude;
  }

  await db
    .update(stops)
    .set(stopUpdatePayload)
    .where(eq(stops.id, stopId));

  await writeActivityLog({
    action: "UPDATE_STOP",
    description: `Updated stop ${stopId}.`,
    module: "stops",
    performedBy: actorUserId,
  });

  logger.info({
    msg: "Stop updated",
    actorUserId,
    stopId,
  });

  const stopRows = await operationsListStops();

  return stopRows.find((stopRow) => stopRow.id === stopId) ?? null;
}

export async function operationsDeleteStop(
  stopId: string,
  actorUserId?: string,
) {
  const [stopRow] = await db
    .select({
      id: stops.id,
      stopName: stops.stopName,
    })
    .from(stops)
    .where(eq(stops.id, stopId))
    .limit(1);

  if (!stopRow) {
    throw new NotFoundError("Stop not found.");
  }

  await db.delete(stops).where(eq(stops.id, stopId));

  await writeActivityLog({
    action: "DELETE_STOP",
    description: `Deleted stop ${stopRow.stopName}.`,
    module: "stops",
    performedBy: actorUserId,
  });

  logger.info({
    msg: "Stop deleted",
    actorUserId,
    stopId,
  });

  return {
    id: stopId,
  };
}

export async function operationsToggleStopStatus(
  stopId: string,
  isActive: boolean,
  actorUserId?: string,
) {
  await assertStopExists(stopId);

  await db
    .update(stops)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(stops.id, stopId));

  await writeActivityLog({
    action: isActive ? "ACTIVATE_STOP" : "DEACTIVATE_STOP",
    description: `${isActive ? "Activated" : "Deactivated"} stop ${stopId}.`,
    module: "stops",
    performedBy: actorUserId,
  });

  logger.info({
    msg: "Stop status updated",
    actorUserId,
    isActive,
    stopId,
  });

  const stopRows = await operationsListStops();

  return stopRows.find((stopRow) => stopRow.id === stopId) ?? null;
}

export async function operationsReorderStops(
  routeId: string,
  updates: StopOrderUpdateInput,
  actorUserId?: string,
) {
  await assertRouteExists(routeId);

  await db.transaction(async (tx) => {
    // Phase 1: move all stops to temporary negative order values so that no
    // two stops share the same stop_order during the update. PostgreSQL checks
    // the unique (route_id, stop_order) constraint after every statement, so
    // sequential positive-to-positive updates would violate it mid-transaction.
    for (let i = 0; i < updates.length; i++) {
      await tx
        .update(stops)
        .set({ stopOrder: -(i + 1), updatedAt: new Date() })
        .where(
          and(
            eq(stops.id, updates[i].id),
            eq(stops.routeId, routeId),
          ),
        );
    }

    // Phase 2: assign the final positive order values now that all slots are free.
    for (const updateRow of updates) {
      await tx
        .update(stops)
        .set({ stopOrder: updateRow.stop_order, updatedAt: new Date() })
        .where(
          and(
            eq(stops.id, updateRow.id),
            eq(stops.routeId, routeId),
          ),
        );
    }
  });

  await writeActivityLog({
    action: "REORDER_STOPS",
    description: `Reordered stops for route ${routeId}.`,
    module: "stops",
    performedBy: actorUserId,
  });

  logger.info({
    msg: "Stops reordered",
    actorUserId,
    routeId,
    stopCount: updates.length,
  });

  return operationsListStops(routeId);
}

async function operationsGetTripById(tripId: string) {
  const [row] = await db
    .select({
      driverFirstName: users.firstName,
      driverLastName: users.lastName,
      endLocation: transitRoutes.endLocation,
      endTime: trips.endTime,
      id: trips.id,
      routeName: transitRoutes.routeName,
      routeId: trips.routeId,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startLocation: transitRoutes.startLocation,
      startTime: trips.startTime,
      status: trips.status,
      tripDate: trips.tripDate,
      vehicleId: trips.vehicleId,
      vehiclePlateNumber: vehicles.plateNumber,
    })
    .from(trips)
    .innerJoin(transitRoutes, eq(trips.routeId, transitRoutes.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    driver: buildFullName(row.driverFirstName, row.driverLastName) ?? "Unassigned driver",
    end_time: row.endTime,
    id: row.id,
    route: buildRouteName(row.routeName, row.startLocation, row.endLocation),
    route_id: row.routeId,
    scheduled_departure_time: row.scheduledDepartureTime,
    start_time: row.startTime,
    status: row.status,
    trip_date: row.tripDate,
    vehicle: row.vehiclePlateNumber ?? "Unassigned vehicle",
    vehicle_id: row.vehicleId,
  };
}

export async function operationsListActiveTrips() {
  const rows = await mapTripRows([
    "scheduled",
    "ongoing",
  ]);

  logger.info({
    msg: "Active trips loaded",
    count: rows.length,
  });

  return rows;
}

export async function operationsListTripHistory() {
  const rows = await mapTripRows([
    "completed",
    "cancelled",
  ]);

  logger.info({
    msg: "Trip history loaded",
    count: rows.length,
  });

  return rows;
}

export async function operationsScheduleTrip(
  input: TripScheduleInput,
  actorUserId: string,
) {
  await assertVehicleExists(input.vehicle_id);
  await assertRouteExists(input.route_id);

  const assignedDriverId = await getAssignedDriverForVehicle(input.vehicle_id);

  if (!assignedDriverId) {
    throw new BadRequestError("Vehicle has no assigned driver.");
  }

  const scheduledDepartureTime = new Date(input.scheduled_departure_time);

  if (Number.isNaN(scheduledDepartureTime.getTime())) {
    throw new BadRequestError("Invalid scheduled departure time.");
  }

  const tripDate = formatDateKey(scheduledDepartureTime);

  await assertNoTripScheduleConflict({
    driverUserId: assignedDriverId,
    routeId: input.route_id,
    scheduledDepartureTime,
    vehicleId: input.vehicle_id,
  });

  const [createdTrip] = await db
    .insert(trips)
    .values({
      assignedBy: actorUserId,
      driverUserId: assignedDriverId,
      routeId: input.route_id,
      scheduledDepartureTime,
      status: "scheduled",
      tripDate,
      vehicleId: input.vehicle_id,
    })
    .returning({
      id: trips.id,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      tripDate: trips.tripDate,
    });

  await writeActivityLog({
    action: "SCHEDULE_TRIP",
    description: `Scheduled trip ${createdTrip.id} for vehicle ${input.vehicle_id}.`,
    module: "trips",
    performedBy: actorUserId,
  });

  await notifyAdminsAndStaff({
    message: `Trip ${createdTrip.id} was scheduled for ${tripDate}.`,
    title: "Trip scheduled",
  });

  logger.info({
    msg: "Trip scheduled",
    actorUserId,
    routeId: input.route_id,
    scheduledDepartureTime,
    tripId: createdTrip.id,
    vehicleId: input.vehicle_id,
  });

  const activeTrips = await operationsListActiveTrips();

  return activeTrips.find((tripRow) => tripRow.id === createdTrip.id) ?? null;
}

async function getTripForMutation(tripId: string) {
  const [tripRow] = await db
    .select({
      driverUserId: trips.driverUserId,
      id: trips.id,
      routeId: trips.routeId,
      scheduledDepartureTime: trips.scheduledDepartureTime,
      startTime: trips.startTime,
      status: trips.status,
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!tripRow) {
    throw new NotFoundError("Trip not found.");
  }

  return tripRow;
}

async function getRouteStartStops(routeId: string): Promise<Array<{
  id: string;
  latitude: number;
  longitude: number;
  stopName: string | null;
  stopOrder: number;
}>> {
  const startStopRows = await db
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

  if (startStopRows.length === 0) {
    throw new BadRequestError("This route does not have any active stops configured yet.");
  }

  type StopRowWithCoords = typeof startStopRows[number] & { latitude: number; longitude: number };

  function hasValidCoords(row: typeof startStopRows[number]): row is StopRowWithCoords {
    return typeof row.latitude === "number" && typeof row.longitude === "number";
  }

  const validStartStops = startStopRows.filter(hasValidCoords);

  if (validStartStops.length === 0) {
    throw new BadRequestError("The active route stops are missing coordinates. Please update the route before starting the trip.");
  }

  return validStartStops.map((stopRow) => ({
    id: stopRow.id,
    latitude: stopRow.latitude,
    longitude: stopRow.longitude,
    stopName: stopRow.stopName,
    stopOrder: stopRow.stopOrder,
  }));
}

function buildStartStopLabel(input: {
  stopName: string | null;
  stopOrder: number;
}) {
  return input.stopName?.trim() || `Stop ${input.stopOrder}`;
}

async function assertDriverStartLocationIfNeeded(input: {
  actorRole: string | null;
  latitude?: number;
  longitude?: number;
  routeId: string;
}) {
  if (input.actorRole !== "driver") {
    return null;
  }

  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    throw new BadRequestError("Current driver location is required before starting a trip.");
  }

  const routeStartStops = await getRouteStartStops(input.routeId);
  let routeStartStop = routeStartStops[0];
  let distanceKm = haversineDistanceKm(
    input.latitude,
    input.longitude,
    routeStartStop.latitude,
    routeStartStop.longitude,
  );

  for (const candidateStop of routeStartStops.slice(1)) {
    const candidateDistanceKm = haversineDistanceKm(
      input.latitude,
      input.longitude,
      candidateStop.latitude,
      candidateStop.longitude,
    );

    if (candidateDistanceKm < distanceKm) {
      routeStartStop = candidateStop;
      distanceKm = candidateDistanceKm;
    }
  }

  if (distanceKm > DRIVER_TRIP_START_RADIUS_KM) {
    const startStopLabel = buildStartStopLabel(routeStartStop);
    const radiusLabel = `${DRIVER_TRIP_START_RADIUS_KM} km`;

    throw new BadRequestError(
      `You must be within ${radiusLabel} of an active stop on this route to start this trip. Nearest stop: ${startStopLabel}. Current distance: ${distanceKm.toFixed(2)} km.`,
      {
        allowed_radius_km: DRIVER_TRIP_START_RADIUS_KM,
        current_distance_km: Number(distanceKm.toFixed(2)),
        start_stop_id: routeStartStop.id,
        start_stop_name: startStopLabel,
      },
    );
  }

  return {
    distanceKm,
    routeStartStop,
  };
}

async function findEmergencyHistoryTripByClientActionId(clientActionId: string) {
  const [reportRow] = await db
    .select({
      tripId: tripEmergencyReports.tripId,
    })
    .from(tripEmergencyReports)
    .where(eq(tripEmergencyReports.clientActionId, clientActionId))
    .limit(1);

  if (!reportRow) {
    return null;
  }

  return operationsGetTripById(reportRow.tripId);
}

export async function operationsStartTrip(
  tripId: string,
  input: TripStartInput = {},
  actorUserId?: string,
) {
  const tripRow = await getTripForMutation(tripId);

  const actorRole = await assertDriverOwnsTripIfNeeded({
    actorUserId,
    driverUserId: tripRow.driverUserId,
  });

  if (tripRow.status !== "scheduled") {
    throw new BadRequestError("Only scheduled trips can be started.");
  }

  await assertVehicleCapacityConfigured({
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  const startLocationCheck = await assertDriverStartLocationIfNeeded({
    actorRole,
    latitude: input.latitude,
    longitude: input.longitude,
    routeId: tripRow.routeId,
  });

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(trips)
      .set({
        startTime: now,
        status: "ongoing",
      })
      .where(eq(trips.id, tripId));

    if (tripRow.vehicleId) {
      await tx
        .update(vehicles)
        .set({
          status: "on_route",
        })
        .where(eq(vehicles.id, tripRow.vehicleId));
    }

    if (tripRow.driverUserId) {
      await tx
        .update(drivers)
        .set({
          lastActive: now,
          status: "driving",
        })
        .where(eq(drivers.userId, tripRow.driverUserId));
    }

    if (
      tripRow.vehicleId &&
      typeof input.latitude === "number" &&
      typeof input.longitude === "number"
    ) {
      await tx
        .insert(vehicleLocations)
        .values({
          currentStopId: startLocationCheck?.routeStartStop.id ?? null,
          isOffRoute: false,
          latitude: input.latitude,
          longitude: input.longitude,
          offRouteDetectedAt: null,
          offRouteDistanceMeters: 0,
          lastOffRouteAlertAt: null,
          updatedAt: now,
          vehicleId: tripRow.vehicleId,
        })
        .onConflictDoUpdate({
          target: vehicleLocations.vehicleId,
          set: {
            currentStopId: startLocationCheck?.routeStartStop.id ?? null,
            isOffRoute: false,
            latitude: input.latitude,
            longitude: input.longitude,
            offRouteDetectedAt: null,
            offRouteDistanceMeters: 0,
            lastOffRouteAlertAt: null,
            updatedAt: now,
          },
        });

      await tx.insert(gpsLogs).values({
        latitude: input.latitude,
        longitude: input.longitude,
        recordedAt: now,
        vehicleId: tripRow.vehicleId,
      });
    }

    await syncTripPassengerLifecycle(tx, {
      currentStopId: startLocationCheck?.routeStartStop.id ?? null,
      tripId,
    });
  });

  await writeActivityLog({
    action: "START_TRIP",
    description: `Started trip ${tripId}.`,
    metadata: {
      driver_start_distance_km: startLocationCheck
        ? Number(startLocationCheck.distanceKm.toFixed(2))
        : null,
      next_state: "ongoing",
      previous_state: tripRow.status,
      start_stop_id: startLocationCheck?.routeStartStop.id ?? null,
      trip_id: tripId,
    },
    module: "trips",
    performedBy: actorUserId,
    targetUserId: tripRow.driverUserId ?? undefined,
  });

  await notifyAdminsAndStaff({
    entity_id: tripId,
    entity_type: "trip",
    message: `Trip ${tripId} is now in progress.`,
    metadata: {
      trip_id: tripId,
    },
    severity: "info",
    title: "Trip started",
    type: "trip",
  });

  logger.info({
    msg: "Trip started",
    actorUserId,
    driverUserId: tripRow.driverUserId,
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  const activeTrips = await operationsListActiveTrips();

  return activeTrips.find((tripRowItem) => tripRowItem.id === tripId) ?? null;
}

export async function operationsEndTrip(
  tripId: string,
  input: TripEndInput,
  actorUserId?: string,
) {
  const tripRow = await getTripForMutation(tripId);

  await assertDriverOwnsTripIfNeeded({
    actorUserId,
    driverUserId: tripRow.driverUserId,
  });

  if (tripRow.status !== "ongoing") {
    throw new BadRequestError("Only ongoing trips can be ended.");
  }

  await assertPassengerCountWithinCapacity({
    passengerCount: input.passenger_count,
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  const now = new Date();
  let resolvedPassengerCount = Math.max(0, input.passenger_count);

  await db.transaction(async (tx) => {
    const resolvedPassengerState = await finalizeCompletedTripPassengers(tx, {
      totalPassengerCount: input.passenger_count,
      tripId,
    });
    resolvedPassengerCount = resolvedPassengerState.resolvedPassengerCount;

    await tx
      .update(trips)
      .set({
        endTime: now,
        recordedPassengerCount: resolvedPassengerCount,
        status: "completed",
      })
      .where(eq(trips.id, tripId));

    if (tripRow.vehicleId) {
      await tx
        .update(vehicles)
        .set({
          status: "available",
        })
        .where(eq(vehicles.id, tripRow.vehicleId));
    }

    if (tripRow.driverUserId) {
      await tx
        .update(drivers)
        .set({
          lastActive: now,
          status: "available",
        })
        .where(eq(drivers.userId, tripRow.driverUserId));
    }
  });

  await writeActivityLog({
    action: "END_TRIP",
    description: `Completed trip ${tripId}.`,
    metadata: {
      client_action_id: input.client_action_id ?? null,
      next_state: "completed",
      passenger_count: resolvedPassengerCount,
      previous_state: tripRow.status,
      trip_id: tripId,
    },
    module: "trips",
    performedBy: actorUserId,
    targetUserId: tripRow.driverUserId ?? undefined,
  });

  await notifyAdminsAndStaff({
    entity_id: tripId,
    entity_type: "trip",
    message: `Trip ${tripId} was completed successfully.`,
    metadata: {
      passenger_count: resolvedPassengerCount,
      trip_id: tripId,
    },
    severity: "success",
    title: "Trip ended",
    type: "trip",
  });

  logger.info({
    msg: "Trip ended",
    actorUserId,
    driverUserId: tripRow.driverUserId,
    passengerCount: resolvedPassengerCount,
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  return operationsGetTripById(tripId);
}

export async function operationsReportDriverEmergency(
  tripId: string,
  input: DriverEmergencyInput,
  actorUserId?: string,
) {
  const existingEmergencyTrip = await findEmergencyHistoryTripByClientActionId(input.client_action_id);

  if (existingEmergencyTrip) {
    return existingEmergencyTrip;
  }

  const tripRow = await getTripForMutation(tripId);

  await assertDriverOwnsTripIfNeeded({
    actorUserId,
    driverUserId: tripRow.driverUserId,
  });

  if (tripRow.status !== "ongoing") {
    throw new BadRequestError("Only ongoing trips can report an emergency.");
  }

  await assertPassengerCountWithinCapacity({
    passengerCount: input.passenger_count,
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  const emergencyDriverUserId = actorUserId ?? tripRow.driverUserId;

  if (!emergencyDriverUserId) {
    throw new BadRequestError("Emergency reports require an assigned driver.");
  }

  const now = new Date();
  let resolvedPassengerCount = Math.max(0, input.passenger_count);

  await db.transaction(async (tx) => {
    const resolvedPassengerState = await finalizeCancelledTripPassengers(tx, {
      currentPassengerCount: input.passenger_count,
      tripId,
    });
    resolvedPassengerCount = resolvedPassengerState.resolvedPassengerCount;

    await tx
      .insert(tripEmergencyReports)
      .values({
        clientActionId: input.client_action_id,
        driverUserId: emergencyDriverUserId,
        reasonText: input.reason_text?.trim() || null,
        reasonType: input.reason_type,
        reportedAt: now,
        reportedPassengerCount: resolvedPassengerCount,
        tripId,
      });

    await tx
      .update(trips)
      .set({
        endTime: now,
        recordedPassengerCount: resolvedPassengerCount,
        status: "cancelled",
      })
      .where(eq(trips.id, tripId));

    if (tripRow.vehicleId) {
      await tx
        .update(vehicles)
        .set({
          status: "available",
        })
        .where(eq(vehicles.id, tripRow.vehicleId));
    }

    if (tripRow.driverUserId) {
      await tx
        .update(drivers)
        .set({
          lastActive: now,
          status: "available",
        })
        .where(eq(drivers.userId, tripRow.driverUserId));
    }
  });

  await writeActivityLog({
    action: "EMERGENCY_TRIP_CANCEL",
    description: `Emergency reported for trip ${tripId}.`,
    metadata: {
      client_action_id: input.client_action_id,
      emergency_reason_text: input.reason_text?.trim() || null,
      emergency_reason_type: input.reason_type,
      next_state: "cancelled",
      passenger_count: resolvedPassengerCount,
      previous_state: tripRow.status,
      trip_id: tripId,
    },
    module: "trips",
    performedBy: actorUserId,
    targetUserId: tripRow.driverUserId ?? undefined,
  });

  await notifyAdminsAndStaff({
    entity_id: tripId,
    entity_type: "trip",
    message: `Trip ${tripId} was cancelled due to a driver emergency (${input.reason_type.replace("_", " ")}).`,
    metadata: {
      emergency_reason_text: input.reason_text?.trim() || null,
      emergency_reason_type: input.reason_type,
      passenger_count: resolvedPassengerCount,
      trip_id: tripId,
    },
    severity: "critical",
    title: "Driver emergency reported",
    type: "emergency",
  });

  logger.warn({
    msg: "Driver emergency reported",
    actorUserId,
    passengerCount: resolvedPassengerCount,
    reasonType: input.reason_type,
    tripId,
    vehicleId: tripRow.vehicleId,
  });

  return operationsGetTripById(tripId);
}

export async function operationsCancelTrip(
  tripId: string,
  actorUserId?: string,
) {
  const tripRow = await getTripForMutation(tripId);

  if (tripRow.status !== "scheduled") {
    throw new BadRequestError("Only scheduled trips can be cancelled.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(trips)
      .set({
        status: "cancelled",
      })
      .where(eq(trips.id, tripId));

    await tx
      .update(passengerTrips)
      .set({
        status: "cancelled",
      })
      .where(
        and(
          eq(passengerTrips.tripId, tripId),
          inArray(passengerTrips.status, [
            ...ACTIVE_PASSENGER_STATUSES,
          ]),
        ),
      );
  });

  await writeActivityLog({
    action: "CANCEL_TRIP",
    description: `Cancelled trip ${tripId}.`,
    module: "trips",
    performedBy: actorUserId,
    targetUserId: tripRow.driverUserId ?? undefined,
  });

  await notifyAdminsAndStaff({
    message: `Trip ${tripId} was cancelled.`,
    title: "Trip cancelled",
  });

  logger.info({
    msg: "Trip cancelled",
    actorUserId,
    tripId,
  });

  return operationsGetTripById(tripId);
}

export async function operationsRescheduleTrip(
  tripId: string,
  input: TripRescheduleInput,
  actorUserId?: string,
) {
  const tripRow = await getTripForMutation(tripId);

  if (tripRow.status !== "scheduled") {
    throw new BadRequestError("Only scheduled trips can be rescheduled.");
  }

  const scheduledDepartureTime = new Date(input.scheduled_departure_time);

  if (Number.isNaN(scheduledDepartureTime.getTime())) {
    throw new BadRequestError("Invalid scheduled departure time.");
  }

  if (!tripRow.driverUserId || !tripRow.vehicleId) {
    throw new BadRequestError("Trip is missing a driver or vehicle assignment.");
  }

  await assertNoTripScheduleConflict({
    driverUserId: tripRow.driverUserId,
    excludeTripId: tripId,
    routeId: tripRow.routeId,
    scheduledDepartureTime,
    vehicleId: tripRow.vehicleId,
  });

  await db
    .update(trips)
    .set({
      scheduledDepartureTime,
      tripDate: formatDateKey(scheduledDepartureTime),
    })
    .where(eq(trips.id, tripId));

  await writeActivityLog({
    action: "RESCHEDULE_TRIP",
    description: `Rescheduled trip ${tripId}.`,
    module: "trips",
    performedBy: actorUserId,
    targetUserId: tripRow.driverUserId ?? undefined,
  });

  await notifyAdminsAndStaff({
    message: `Trip ${tripId} received a new departure time.`,
    title: "Trip rescheduled",
  });

  logger.info({
    msg: "Trip rescheduled",
    actorUserId,
    scheduledDepartureTime,
    tripId,
  });

  const activeTrips = await operationsListActiveTrips();

  return activeTrips.find((tripRowItem) => tripRowItem.id === tripId) ?? null;
}

export async function operationsListActivityLogs(query: ActivityLogQuery) {
  const limit = Math.min(query.limit ?? 50, 200);
  const offset = Math.max(query.offset ?? 0, 0);

  const whereClause = and(
    query.module ? eq(activityLogs.module, query.module) : undefined,
    query.action ? eq(activityLogs.action, query.action) : undefined,
    query.search ? ilike(activityLogs.description, `%${query.search}%`) : undefined,
  );

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        action: activityLogs.action,
        created_at: activityLogs.createdAt,
        description: activityLogs.description,
        id: activityLogs.id,
        module: activityLogs.module,
      })
      .from(activityLogs)
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count(activityLogs.id) })
      .from(activityLogs)
      .where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  logger.info({
    msg: "Activity logs loaded",
    count: rows.length,
    total,
  });

  return { rows, total };
}

export async function operationsListNotifications(
  userId: string,
  query: NotificationListQuery = {},
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
  const whereClause = and(
    eq(notifications.targetUserId, userId),
    query.severity
      ? eq(notifications.severity, query.severity)
      : undefined,
    query.type
      ? eq(notifications.type, query.type)
      : undefined,
  );

  const offset = (page - 1) * limit;

  const [items, totalRows] = await Promise.all([
    db
      .select({
        created_at: notifications.createdAt,
        entity_id: notifications.entityId,
        entity_type: notifications.entityType,
        id: notifications.id,
        is_read: notifications.isRead,
        message: notifications.message,
        metadata: notifications.metadata,
        severity: notifications.severity,
        title: notifications.title,
        type: notifications.type,
      })
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: count(notifications.id),
      })
      .from(notifications)
      .where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  logger.info({
    msg: "Notifications loaded",
    count: items.length,
    page,
    userId,
  });

  return {
    items,
    meta: {
      limit,
      page,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function operationsMarkNotificationRead(
  notificationId: string,
  userId: string,
) {
  await db
    .update(notifications)
    .set({
      isRead: true,
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.targetUserId, userId),
      ),
    );

  logger.info({
    msg: "Notification marked read",
    notificationId,
    userId,
  });

  return {
    success: true,
  };
}

export async function operationsMarkAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({
      isRead: true,
    })
    .where(eq(notifications.targetUserId, userId));

  logger.info({
    msg: "All notifications marked read",
    userId,
  });

  return {
    success: true,
  };
}

export async function operationsGetAdminDashboardSummary(filter?: string) {
  const range = buildDateRange(filter);

  const tripRows = await db
    .select({
      id: trips.id,
    })
    .from(trips)
    .where(
      and(
        gte(trips.tripDate, range.startDateKey),
        lte(trips.tripDate, range.endDateKey),
      ),
    );

  const passengerRows = await db
    .select({
      pickupStopId: passengerTrips.pickupStopId,
    })
    .from(passengerTrips)
    .where(
      and(
        gte(passengerTrips.createdAt, range.startAt),
        lte(passengerTrips.createdAt, range.endAt),
        inArray(passengerTrips.status, [
          ...ACTIVE_PASSENGER_STATUSES,
        ]),
      ),
    );

  const activeTripRows = await db
    .select({
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .where(eq(trips.status, "ongoing"));

  return {
    activeVehicles: new Set(activeTripRows.map((row) => row.vehicleId).filter(Boolean)).size,
    passengers: passengerRows.length,
    trips: tripRows.length,
    waitingStops: new Set(passengerRows.map((row) => row.pickupStopId).filter(Boolean)).size,
  };
}

export async function operationsGetAdminVehicleStatus() {
  const rows = await getVehicleOperationRows();

  return rows.map((row) => ({
    driver_name: row.driverName,
    latitude: row.latitude,
    longitude: row.longitude,
    plate_number: row.plateNumber,
    status: row.adminStatus,
    vehicle_id: row.vehicleId,
  }));
}

export async function operationsGetAdminRoutes() {
  const routesList = await operationsListRoutes();

  return routesList.map((routeRow) => ({
    end_location: routeRow.end_location,
    id: routeRow.id,
    start_location: routeRow.start_location,
  }));
}

export async function operationsGetPassengerWaitingStops(
  routeId: string,
  filter?: string,
) {
  await assertRouteExists(routeId);

  const range = buildDateRange(filter);
  const routeStops = await operationsListStops(routeId);
  const bookingRows = await db
    .select({
      createdAt: passengerTrips.createdAt,
      stopName: stops.stopName,
    })
    .from(passengerTrips)
    .innerJoin(stops, eq(passengerTrips.pickupStopId, stops.id))
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .where(
      and(
        eq(trips.routeId, routeId),
        gte(passengerTrips.createdAt, range.startAt),
        lte(passengerTrips.createdAt, range.endAt),
      ),
    );

  const hours = Array.from({
    length: 24,
  }, (_, index) => `${index.toString().padStart(2, "0")}:00`);

  const stopLabels = routeStops.map((stopRow) => stopRow.stop_name ?? "Unnamed stop");
  const matrix = Object.fromEntries(
    hours.map((hour) => [
      hour,
      Object.fromEntries(stopLabels.map((label) => [
        label,
        0,
      ])),
    ]),
  ) as Record<string, Record<string, number>>;

  for (const bookingRow of bookingRows) {
    const hour = formatHourLabel(bookingRow.createdAt);
    const stopLabel = bookingRow.stopName ?? "Unnamed stop";

    if (matrix[hour]?.[stopLabel] !== undefined) {
      matrix[hour][stopLabel] += 1;
    }
  }

  return {
    hours,
    matrix,
    stops: stopLabels,
  };
}

export async function operationsGetDriverPerformance(filter?: string) {
  const range = buildDateRange(filter);
  const rows = await db
    .select({
      driverUserId: trips.driverUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      status: trips.status,
    })
    .from(trips)
    .leftJoin(users, eq(trips.driverUserId, users.id))
    .where(
      and(
        gte(trips.tripDate, range.startDateKey),
        lte(trips.tripDate, range.endDateKey),
      ),
    );

  const metricsByDriverId = new Map<string, {
    completed: number;
    name: string;
    total: number;
  }>();

  for (const row of rows) {
    if (!row.driverUserId) {
      continue;
    }

    const existingMetric = metricsByDriverId.get(row.driverUserId) ?? {
      completed: 0,
      name: buildFullName(row.firstName, row.lastName) ?? row.driverUserId,
      total: 0,
    };

    existingMetric.total += 1;

    if (row.status === "completed") {
      existingMetric.completed += 1;
    }

    metricsByDriverId.set(row.driverUserId, existingMetric);
  }

  return [...metricsByDriverId.entries()]
    .map(([
      driverId,
      metric,
    ]) => ({
      driver: metric.name,
      driver_id: driverId,
      rating: Number(((metric.completed / Math.max(1, metric.total)) * 5).toFixed(1)),
      trips: metric.total,
    }))
    .sort((left, right) => right.trips - left.trips)
    .slice(0, 10);
}

export async function operationsGetAdminAlerts() {
  const rows = await getVehicleOperationRows();
  const offlineVehicles = rows.filter((row) => row.operatorStatus === "Offline");

  return offlineVehicles.slice(0, 10).map((row) => ({
    id: row.vehicleId,
    is_read: false,
    message: `${row.plateNumber} has not reported a recent location update.`,
    severity: "warning",
    title: "Vehicle offline",
  }));
}

export async function operationsGetAdminNotifications(userId: string) {
  const result = await operationsListNotifications(userId, {
    limit: 10,
    page: 1,
  });

  return result.items;
}

export async function operationsGetAdminAppRatings() {
  return {
    average: 0,
    total: 0,
  };
}

export async function operationsGetAdminSuggestions() {
  return [];
}

export async function operationsGetAdminLiveMap() {
  return operationsGetAdminVehicleStatus();
}

export async function operationsAssignDriverToVehicle(
  vehicleId: string,
  driverUserId: string,
  actorUserId?: string,
) {
  await assertVehicleExists(vehicleId);
  await assertDriverExists(driverUserId);
  await setVehicleDriverAssignment(vehicleId, driverUserId);

  await writeActivityLog({
    action: "ASSIGN_DRIVER",
    description: `Assigned driver ${driverUserId} to vehicle ${vehicleId}.`,
    module: "vehicles",
    performedBy: actorUserId,
    targetUserId: driverUserId,
  });

  await notifyAdminsAndStaff({
    message: "A driver was assigned to a vehicle.",
    title: "Driver assigned",
  });

  logger.info({
    msg: "Driver assigned to vehicle",
    actorUserId,
    driverUserId,
    vehicleId,
  });

  return operationsListVehicles();
}

export async function operationsGetOperatorFleetSummary() {
  const rows = await getVehicleOperationRows();

  return {
    active: rows.filter((row) => row.operatorStatus === "Driving").length,
    offline: rows.filter((row) => row.operatorStatus === "Offline").length,
    standby: rows.filter((row) => row.operatorStatus === "Standby").length,
    total: rows.length,
  };
}

export async function operationsGetOperatorJeepneys() {
  const rows = await getVehicleOperationRows();

  return rows.map((row) => ({
    driver: row.driverName,
    eta: row.eta,
    id: row.vehicleId,
    is_online: row.isOnline,
    load: row.load,
    plate: row.plateNumber,
    route: row.routeName,
    status: row.operatorStatus,
    updated_at: row.updatedAt,
  }));
}

export async function operationsGetOperatorDrivers() {
  return operationsListDrivers();
}

export async function operationsGetOperatorVehicles() {
  const rows = await getVehicleOperationRows();

  return rows.map((row) => ({
    driver_name: row.driverName,
    id: row.vehicleId,
    load: row.load,
    plate_number: row.plateNumber,
    route: row.routeName,
    status: row.operatorStatus,
    updated_at: row.updatedAt,
  }));
}

export async function operationsGetOperatorVehicleLocations() {
  const rows = await getVehicleOperationRows();

  return rows.map((row) => ({
    driver_name: row.driverName,
    latitude: row.latitude,
    longitude: row.longitude,
    plate_number: row.plateNumber,
    status: row.operatorStatus,
    vehicle_id: row.vehicleId,
  }));
}

export async function operationsGetOperatorStopPopularity() {
  const todayKey = formatDateKey(new Date());
  const rows = await db
    .select({
      stopName: stops.stopName,
    })
    .from(passengerTrips)
    .innerJoin(stops, eq(passengerTrips.pickupStopId, stops.id))
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .where(eq(trips.tripDate, todayKey));

  const countsByStop = new Map<string, number>();

  for (const row of rows) {
    const stopLabel = row.stopName ?? "Unnamed stop";
    countsByStop.set(stopLabel, (countsByStop.get(stopLabel) ?? 0) + 1);
  }

  const total = Math.max(1, rows.length);

  return [...countsByStop.entries()]
    .map(([
      stop,
      value,
    ]) => ({
      percentage: Math.round((value / total) * 100),
      stop,
    }))
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 6);
}

export async function operationsGetOperatorLoadSummary() {
  const now = new Date();
  const startDate = addDays(now, -6);
  const startDateKey = formatDateKey(startDate);
  const endDateKey = formatDateKey(now);

  const tripRows = await db
    .select({
      capacity: vehicles.capacity,
      tripDate: trips.tripDate,
      tripId: trips.id,
    })
    .from(trips)
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        gte(trips.tripDate, startDateKey),
        lte(trips.tripDate, endDateKey),
      ),
    );

  const tripIds = tripRows.map((row) => row.tripId);
  const passengerRows = tripIds.length > 0
    ? await db
      .select({
        passengerCount: count(passengerTrips.id),
        tripId: passengerTrips.tripId,
      })
      .from(passengerTrips)
      .where(inArray(passengerTrips.tripId, tripIds))
      .groupBy(passengerTrips.tripId)
    : [];

  const passengerCountByTripId = new Map<string, number>();

  for (const row of passengerRows) {
    passengerCountByTripId.set(row.tripId, Number(row.passengerCount));
  }

  const loadByDate = new Map<string, number[]>();

  for (const row of tripRows) {
    const tripLoad = row.capacity && row.capacity > 0
      ? ((passengerCountByTripId.get(row.tripId) ?? 0) / row.capacity) * 100
      : 0;

    const values = loadByDate.get(row.tripDate) ?? [];
    values.push(tripLoad);
    loadByDate.set(row.tripDate, values);
  }

  return [...loadByDate.entries()]
    .map(([
      date,
      values,
    ]) => ({
      date,
      load: Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function operationsGetOperatorActiveStops() {
  const todayKey = formatDateKey(new Date());
  const rows = await db
    .select({
      stopName: stops.stopName,
    })
    .from(passengerTrips)
    .innerJoin(stops, eq(passengerTrips.pickupStopId, stops.id))
    .innerJoin(trips, eq(passengerTrips.tripId, trips.id))
    .where(
      and(
        eq(trips.tripDate, todayKey),
        inArray(passengerTrips.status, [
          ...ACTIVE_PASSENGER_STATUSES,
        ]),
      ),
    );

  const waitingByStop = new Map<string, number>();

  for (const row of rows) {
    const stopLabel = row.stopName ?? "Unnamed stop";
    waitingByStop.set(stopLabel, (waitingByStop.get(stopLabel) ?? 0) + 1);
  }

  return [...waitingByStop.entries()]
    .map(([
      stop,
      waiting,
    ]) => ({
      stop,
      waiting,
    }))
    .sort((left, right) => right.waiting - left.waiting)
    .slice(0, 6);
}

export async function operationsGetOperatorOverallSummary() {
  const todayKey = formatDateKey(new Date());
  const todayTrips = await db
    .select({
      routeId: trips.routeId,
      tripId: trips.id,
      vehicleId: trips.vehicleId,
    })
    .from(trips)
    .where(eq(trips.tripDate, todayKey));

  const tripIds = todayTrips.map((row) => row.tripId);
  const passengerRows = tripIds.length > 0
    ? await db
      .select({
        passengerCount: count(passengerTrips.id),
        tripId: passengerTrips.tripId,
      })
      .from(passengerTrips)
      .where(inArray(passengerTrips.tripId, tripIds))
      .groupBy(passengerTrips.tripId)
    : [];

  const passengerCountByTripId = new Map<string, number>();

  for (const row of passengerRows) {
    passengerCountByTripId.set(row.tripId, Number(row.passengerCount));
  }

  const routeIds = [...new Set(todayTrips.map((row) => row.routeId))];
  const routeDirectory = await getRouteDirectory(routeIds);
  const routeById = new Map<string, string>();

  for (const routeRow of routeDirectory) {
    routeById.set(routeRow.id, routeRow.route_name);
  }

  const routePassengerCounts = new Map<string, number>();
  let totalLoad = 0;
  let loadCount = 0;

  const vehicleDirectory = await operationsListVehicles();
  const vehicleCapacityById = new Map<string, number>();

  for (const vehicleRow of vehicleDirectory) {
    vehicleCapacityById.set(vehicleRow.id, vehicleRow.capacity);
  }

  for (const tripRow of todayTrips) {
    const passengerCount = passengerCountByTripId.get(tripRow.tripId) ?? 0;
    routePassengerCounts.set(
      tripRow.routeId,
      (routePassengerCounts.get(tripRow.routeId) ?? 0) + passengerCount,
    );

    if (!tripRow.vehicleId) {
      continue;
    }

    const capacity = vehicleCapacityById.get(tripRow.vehicleId) ?? 0;

    if (capacity <= 0) {
      continue;
    }

    totalLoad += (passengerCount / capacity) * 100;
    loadCount += 1;
  }

  const topRouteEntry = [...routePassengerCounts.entries()]
    .sort((left, right) => right[1] - left[1])[0];

  return {
    avg_load: Math.round(totalLoad / Math.max(1, loadCount)),
    passengers_today: passengerRows.reduce((sum, row) => sum + Number(row.passengerCount), 0),
    top_route: topRouteEntry
      ? routeById.get(topRouteEntry[0]) ?? "No route data"
      : "No route data",
    trips_today: todayTrips.length,
  };
}

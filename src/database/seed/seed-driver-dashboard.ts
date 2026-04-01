import { and, asc, eq, inArray } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../db";
import {
  passengers,
  passengerTrips,
  roles,
  stops,
  transitRoutes,
  trips,
  users,
  vehicles,
} from "../schema";

const MANILA_TIME_ZONE = "Asia/Manila";
const DEMO_PASSWORD_HASH = "$2b$12$7VglM9lAcfmZXXBvlqG1MOSTNRhcJVDdptmjrBM2/RzA4QvoheOsu";

const DEMO_PASSENGERS = [
  {
    email: "passenger.one@bjoc.com",
    firstName: "Ana",
    lastName: "Mendoza",
    contact: "09170000004",
    username: "ana.passenger",
  },
  {
    email: "passenger.two@bjoc.com",
    firstName: "Liza",
    lastName: "Rivera",
    contact: "09170000005",
    username: "liza.passenger",
  },
  {
    email: "passenger.three@bjoc.com",
    firstName: "Paolo",
    lastName: "Garcia",
    contact: "09170000006",
    username: "paolo.passenger",
  },
] as const;

const DEMO_TRIPS = [
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Pili Town Center",
    },
    dateOffset: -6,
    scheduledHour: 6,
    scheduledMinute: 0,
    startHour: 6,
    startMinute: 5,
    endHour: 6,
    endMinute: 45,
    status: "completed" as const,
    passengerCount: 2,
    fare: 14,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Canaman",
    },
    dateOffset: -5,
    scheduledHour: 7,
    scheduledMinute: 15,
    status: "cancelled" as const,
    passengerCount: 0,
    fare: 13,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Milaor",
    },
    dateOffset: -4,
    scheduledHour: 7,
    scheduledMinute: 30,
    startHour: 7,
    startMinute: 35,
    endHour: 8,
    endMinute: 10,
    status: "completed" as const,
    passengerCount: 1,
    fare: 15,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Canaman",
    },
    dateOffset: -3,
    scheduledHour: 8,
    scheduledMinute: 0,
    startHour: 8,
    startMinute: 5,
    endHour: 8,
    endMinute: 40,
    status: "completed" as const,
    passengerCount: 3,
    fare: 13,
  },
  {
    route: {
      startLocation: "SM City Naga",
      endLocation: "Naga City Center",
    },
    dateOffset: -2,
    scheduledHour: 6,
    scheduledMinute: 45,
    startHour: 6,
    startMinute: 50,
    endHour: 7,
    endMinute: 20,
    status: "completed" as const,
    passengerCount: 2,
    fare: 13,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Pili Town Center",
    },
    dateOffset: -1,
    scheduledHour: 9,
    scheduledMinute: 0,
    status: "cancelled" as const,
    passengerCount: 0,
    fare: 14,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "SM City Naga",
    },
    dateOffset: 0,
    scheduledHour: 7,
    scheduledMinute: 0,
    startHour: 7,
    startMinute: 5,
    endHour: 7,
    endMinute: 35,
    status: "completed" as const,
    passengerCount: 2,
    fare: 13,
  },
  {
    route: {
      startLocation: "Naga City Center",
      endLocation: "Canaman",
    },
    dateOffset: 0,
    scheduledHour: 9,
    scheduledMinute: 0,
    status: "cancelled" as const,
    passengerCount: 0,
    fare: 13,
  },
] as const;

interface RouteContext {
  routeId: string;
  pickupStopId: string | null;
  dropoffStopId: string | null;
}

function formatDashboardDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildDateKey(dateOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  return formatDashboardDateKey(date);
}

function buildTimestamp(
  dateKey: string,
  hour: number,
  minute: number,
) {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
}

function buildUpcomingTimestamp(todayKey: string) {
  const upcoming = new Date();
  upcoming.setMinutes(upcoming.getMinutes() + 45);

  if (formatDashboardDateKey(upcoming) === todayKey) {
    return upcoming;
  }

  return buildTimestamp(todayKey, 23, 30);
}

async function upsertPassengerUser(
  passengerRoleId: string,
  passengerSeed: (typeof DEMO_PASSENGERS)[number],
) {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, passengerSeed.email))
    .limit(1);

  const userId =
    existingUser?.id ??
    (
      await db
        .insert(users)
        .values({
          roleId: passengerRoleId,
          email: passengerSeed.email,
          passwordHash: DEMO_PASSWORD_HASH,
          firstName: passengerSeed.firstName,
          lastName: passengerSeed.lastName,
          contact: passengerSeed.contact,
          status: "active",
        })
        .returning({ id: users.id })
    )[0]?.id;

  if (!userId) {
    throw new Error(`Unable to seed passenger user: ${passengerSeed.email}`);
  }

  await db
    .update(users)
    .set({
      roleId: passengerRoleId,
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: passengerSeed.firstName,
      lastName: passengerSeed.lastName,
      contact: passengerSeed.contact,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  const [existingPassenger] = await db
    .select({ userId: passengers.userId })
    .from(passengers)
    .where(eq(passengers.userId, userId))
    .limit(1);

  if (existingPassenger) {
    await db
      .update(passengers)
      .set({
        username: passengerSeed.username,
        status: "active",
      })
      .where(eq(passengers.userId, userId));
  } else {
    await db.insert(passengers).values({
      userId,
      username: passengerSeed.username,
      status: "active",
    });
  }

  return userId;
}

async function upsertVehicle() {
  const plateNumber = "BJOC-1001";

  const [existingVehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.plateNumber, plateNumber))
    .limit(1);

  if (existingVehicle) {
    await db
      .update(vehicles)
      .set({
        model: "Jeepney Modernized Unit",
        capacity: 20,
        status: "available",
      })
      .where(eq(vehicles.id, existingVehicle.id));

    return existingVehicle.id;
  }

  const [createdVehicle] = await db
    .insert(vehicles)
    .values({
      plateNumber,
      model: "Jeepney Modernized Unit",
      capacity: 20,
      status: "available",
    })
    .returning({ id: vehicles.id });

  if (!createdVehicle) {
    throw new Error("Unable to seed dashboard vehicle");
  }

  return createdVehicle.id;
}

async function getRouteContext(
  startLocation: string,
  endLocation: string,
): Promise<RouteContext> {
  const [routeRow] = await db
    .select({ id: transitRoutes.id })
    .from(transitRoutes)
    .where(
      and(
        eq(transitRoutes.startLocation, startLocation),
        eq(transitRoutes.endLocation, endLocation),
      ),
    )
    .limit(1);

  if (!routeRow) {
    throw new Error(`Missing seeded route: ${startLocation} -> ${endLocation}`);
  }

  const routeStops = await db
    .select({
      id: stops.id,
      stopOrder: stops.stopOrder,
    })
    .from(stops)
    .where(eq(stops.routeId, routeRow.id))
    .orderBy(asc(stops.stopOrder));

  return {
    routeId: routeRow.id,
    pickupStopId: routeStops[0]?.id ?? null,
    dropoffStopId: routeStops[routeStops.length - 1]?.id ?? null,
  };
}

export async function seedDriverDashboardData() {
  logger.info({ msg: "Seeding driver dashboard data" });

  const [driverUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "driver.one@bjoc.com"))
    .limit(1);

  if (!driverUser) {
    throw new Error("Seeded driver user not found");
  }

  const [dispatcherUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "staff.dispatcher@bjoc.com"))
    .limit(1);

  const [passengerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, "passenger"))
    .limit(1);

  if (!passengerRole) {
    throw new Error("Passenger role not found");
  }

  const passengerUserIds: string[] = [];
  for (const passengerSeed of DEMO_PASSENGERS) {
    passengerUserIds.push(await upsertPassengerUser(passengerRole.id, passengerSeed));
  }

  const vehicleId = await upsertVehicle();

  const existingTrips = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.driverUserId, driverUser.id));

  const existingTripIds = existingTrips.map((tripRow) => tripRow.id);

  if (existingTripIds.length > 0) {
    await db
      .delete(passengerTrips)
      .where(inArray(passengerTrips.tripId, existingTripIds));

    await db
      .delete(trips)
      .where(inArray(trips.id, existingTripIds));
  }

  const routeContextCache = new Map<string, RouteContext>();

  for (const tripSeed of DEMO_TRIPS) {
    const routeKey = `${tripSeed.route.startLocation}|${tripSeed.route.endLocation}`;
    const routeContext = routeContextCache.get(routeKey) ?? await getRouteContext(
      tripSeed.route.startLocation,
      tripSeed.route.endLocation,
    );

    routeContextCache.set(routeKey, routeContext);

    const tripDate = buildDateKey(tripSeed.dateOffset);
    const scheduledDepartureTime = buildTimestamp(
      tripDate,
      tripSeed.scheduledHour,
      tripSeed.scheduledMinute,
    );

    const [createdTrip] = await db
      .insert(trips)
      .values({
        routeId: routeContext.routeId,
        vehicleId,
        driverUserId: driverUser.id,
        assignedBy: dispatcherUser?.id ?? null,
        tripDate,
        scheduledDepartureTime,
        startTime: tripSeed.status === "completed" && typeof tripSeed.startHour === "number"
          ? buildTimestamp(tripDate, tripSeed.startHour, tripSeed.startMinute ?? 0)
          : null,
        endTime: tripSeed.status === "completed" && typeof tripSeed.endHour === "number"
          ? buildTimestamp(tripDate, tripSeed.endHour, tripSeed.endMinute ?? 0)
          : null,
        recordedPassengerCount: tripSeed.status === "completed"
          ? tripSeed.passengerCount
          : null,
        status: tripSeed.status,
      })
      .returning({ id: trips.id });

    if (!createdTrip) {
      throw new Error(`Unable to seed trip for route ${routeKey}`);
    }

    if (tripSeed.passengerCount === 0) {
      continue;
    }

    const passengerTripStatus = tripSeed.status === "completed"
      ? "completed" as const
      : "booked" as const;

    await db.insert(passengerTrips).values(
      passengerUserIds.slice(0, tripSeed.passengerCount).map((passengerUserId) => ({
        passengerUserId,
        tripId: createdTrip.id,
        pickupStopId: routeContext.pickupStopId,
        dropoffStopId: routeContext.dropoffStopId,
        status: passengerTripStatus,
        fare: tripSeed.fare,
      })),
    );
  }

  const todayKey = buildDateKey(0);
  const upcomingRouteContext = routeContextCache.get("Naga City Center|SM City Naga")
    ?? await getRouteContext("Naga City Center", "SM City Naga");

  const [upcomingTrip] = await db
    .insert(trips)
    .values({
      routeId: upcomingRouteContext.routeId,
      vehicleId,
      driverUserId: driverUser.id,
      assignedBy: dispatcherUser?.id ?? null,
      tripDate: todayKey,
      scheduledDepartureTime: buildUpcomingTimestamp(todayKey),
      status: "scheduled",
    })
    .returning({ id: trips.id });

  if (!upcomingTrip) {
    throw new Error("Unable to seed upcoming driver dashboard trip");
  }

  await db.insert(passengerTrips).values(
    passengerUserIds.slice(0, 2).map((passengerUserId) => ({
      passengerUserId,
      tripId: upcomingTrip.id,
      pickupStopId: upcomingRouteContext.pickupStopId,
      dropoffStopId: upcomingRouteContext.dropoffStopId,
      status: "booked" as const,
      fare: 13,
    })),
  );

  logger.info({
    msg: "Driver dashboard data seeded",
    driverUserId: driverUser.id,
    passengerCount: passengerUserIds.length,
  });
}

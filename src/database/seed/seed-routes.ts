import { and, eq } from "drizzle-orm";

import { logger } from "../../config/logger";
import { db } from "../db";
import { stops, transitRoutes } from "../schema";

const ROUTE_DATA = [
  {
    startLocation: "Naga City Center",
    endLocation: "Pili Town Center",
    stops: [
      { stopName: "Naga City Terminal", latitude: 13.6218, longitude: 123.1948, stopOrder: 1 },
      { stopName: "Panganiban Drive", latitude: 13.6195, longitude: 123.1985, stopOrder: 2 },
      { stopName: "Naga Central School", latitude: 13.617, longitude: 123.203, stopOrder: 3 },
      { stopName: "Magsaysay Avenue Junction", latitude: 13.613, longitude: 123.211, stopOrder: 4 },
      { stopName: "CBD Terminal II", latitude: 13.6085, longitude: 123.22, stopOrder: 5 },
      { stopName: "San Felipe Crossing", latitude: 13.602, longitude: 123.238, stopOrder: 6 },
      { stopName: "Pili Intersection", latitude: 13.59, longitude: 123.257, stopOrder: 7 },
      { stopName: "Pili Town Center", latitude: 13.5825, longitude: 123.2735, stopOrder: 8 },
    ],
  },
  {
    startLocation: "Naga City Center",
    endLocation: "Canaman",
    stops: [
      { stopName: "Naga City Terminal", latitude: 13.6218, longitude: 123.1948, stopOrder: 1 },
      { stopName: "University of Nueva Caceres", latitude: 13.624, longitude: 123.19, stopOrder: 2 },
      { stopName: "Concepcion Pequena", latitude: 13.628, longitude: 123.185, stopOrder: 3 },
      { stopName: "Palestina", latitude: 13.634, longitude: 123.178, stopOrder: 4 },
      { stopName: "Canaman Junction", latitude: 13.642, longitude: 123.17, stopOrder: 5 },
      { stopName: "Canaman Town Proper", latitude: 13.6487, longitude: 123.1654, stopOrder: 6 },
    ],
  },
  {
    startLocation: "Naga City Center",
    endLocation: "Milaor",
    stops: [
      { stopName: "Naga City Terminal", latitude: 13.6218, longitude: 123.1948, stopOrder: 1 },
      { stopName: "Diversion Road Naga", latitude: 13.619, longitude: 123.188, stopOrder: 2 },
      { stopName: "Pacol Junction", latitude: 13.615, longitude: 123.18, stopOrder: 3 },
      { stopName: "Del Rosario", latitude: 13.61, longitude: 123.17, stopOrder: 4 },
      { stopName: "San Antonio", latitude: 13.605, longitude: 123.16, stopOrder: 5 },
      { stopName: "Milaor Junction", latitude: 13.598, longitude: 123.152, stopOrder: 6 },
      { stopName: "Milaor Town Proper", latitude: 13.5943, longitude: 123.146, stopOrder: 7 },
    ],
  },
  {
    startLocation: "Naga City Center",
    endLocation: "SM City Naga",
    stops: [
      { stopName: "J. Miranda Avenue", latitude: 13.6248, longitude: 123.1868, stopOrder: 1 },
      { stopName: "University of Nueva Caceres", latitude: 13.624, longitude: 123.19, stopOrder: 2 },
      { stopName: "Panganiban Drive", latitude: 13.6224, longitude: 123.1927, stopOrder: 3 },
      { stopName: "Naga City Terminal", latitude: 13.6218, longitude: 123.1948, stopOrder: 4 },
      {
        stopName: "SM City Naga Transport Terminal",
        latitude: 13.62135545,
        longitude: 123.19051396,
        stopOrder: 5,
      },
    ],
  },
  {
    startLocation: "SM City Naga",
    endLocation: "Naga City Center",
    stops: [
      {
        stopName: "SM City Naga Transport Terminal",
        latitude: 13.62135545,
        longitude: 123.19051396,
        stopOrder: 1,
      },
      { stopName: "Naga City Terminal", latitude: 13.6218, longitude: 123.1948, stopOrder: 2 },
      { stopName: "Panganiban Drive", latitude: 13.6224, longitude: 123.1927, stopOrder: 3 },
      { stopName: "University of Nueva Caceres", latitude: 13.624, longitude: 123.19, stopOrder: 4 },
      { stopName: "J. Miranda Avenue", latitude: 13.6248, longitude: 123.1868, stopOrder: 5 },
    ],
  },
];

async function upsertRouteWithStops(route: (typeof ROUTE_DATA)[number]) {
  const routeName = `${route.startLocation} -> ${route.endLocation}`;
  const [existingRoute] = await db
    .select({ id: transitRoutes.id })
    .from(transitRoutes)
    .where(
      and(
        eq(transitRoutes.startLocation, route.startLocation),
        eq(transitRoutes.endLocation, route.endLocation),
      ),
    )
    .limit(1);

  const routeId =
    existingRoute?.id ??
    (
      await db
        .insert(transitRoutes)
        .values({
          routeName,
          startLocation: route.startLocation,
          endLocation: route.endLocation,
          isActive: true,
        })
        .returning({ id: transitRoutes.id })
    )[0]?.id;

  if (!routeId) {
    return null;
  }

  if (existingRoute) {
    await db
      .update(transitRoutes)
      .set({
        isActive: true,
        routeName,
        updatedAt: new Date(),
      })
      .where(eq(transitRoutes.id, routeId));

    await db.delete(stops).where(eq(stops.routeId, routeId));
  }

  await db.insert(stops).values(
    route.stops.map((stop) => ({
      routeId,
      stopName: stop.stopName,
      latitude: stop.latitude,
      longitude: stop.longitude,
      stopOrder: stop.stopOrder,
      isActive: true,
    })),
  );

  return routeId;
}

export async function seedRoutes() {
  logger.info({ msg: "Seeding transit routes and stops" });

  for (const route of ROUTE_DATA) {
    const routeId = await upsertRouteWithStops(route);

    if (!routeId) {
      continue;
    }

    logger.info({
      msg: "Route seeded",
      routeId,
      name: `${route.startLocation} -> ${route.endLocation}`,
      stopsCount: route.stops.length,
    });
  }

  logger.info({ msg: "Transit routes seeding completed" });
}

import { and, eq, isNotNull } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import { passengers, vehicleLocations } from "../../database/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ETA_NOTIFY_THRESHOLD_MINUTES = 5;
const AVG_SPEED_KPH = 18;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendBatch(messages: object[]): Promise<void> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      logger.warn({ msg: "Expo push batch failed", status: response.status });
    }
  } catch (error) {
    logger.warn({ msg: "Expo push fetch error", error });
  }
}

async function notifyPassengersAtStop(
  stopId: string,
  title: string,
  body: string,
): Promise<void> {
  const rows = await db
    .select({ expoPushToken: passengers.expoPushToken })
    .from(passengers)
    .where(
      and(
        eq(passengers.preferredStopId, stopId),
        isNotNull(passengers.expoPushToken),
      ),
    );

  const tokens = rows
    .map((r) => r.expoPushToken)
    .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (tokens.length === 0) return;

  // Expo recommends batches of <= 100
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((token) => ({
      to: token,
      title,
      body,
      sound: "default",
      priority: "high",
    }));
    await sendBatch(batch);
  }

  logger.info({ msg: "Sent nearby-stop push notifications", stopId, count: tokens.length });
}

export async function checkAndSendNearbyStopNotifications(input: {
  currentLat: number;
  currentLng: number;
  currentStopId: string | null;
  routeStops: Array<{
    id: string;
    stopOrder: number;
    latitude: number | null;
    longitude: number | null;
    stopName: string | null;
  }>;
  vehicleId: string;
  routeName: string;
}): Promise<void> {
  const { currentLat, currentLng, currentStopId, routeStops, vehicleId, routeName } = input;

  // Find the current stop's order
  const currentStopOrder = currentStopId
    ? (routeStops.find((s) => s.id === currentStopId)?.stopOrder ?? null)
    : null;

  // Next stop = lowest stopOrder greater than current
  const nextStop = routeStops
    .filter(
      (s) =>
        (currentStopOrder === null || s.stopOrder > currentStopOrder) &&
        typeof s.latitude === "number" &&
        typeof s.longitude === "number",
    )
    .sort((a, b) => a.stopOrder - b.stopOrder)[0] ?? null;

  if (!nextStop || nextStop.latitude === null || nextStop.longitude === null) return;

  const distanceKm = haversineKm(currentLat, currentLng, nextStop.latitude, nextStop.longitude);
  const estimatedMinutes = (distanceKm / AVG_SPEED_KPH) * 60;

  if (estimatedMinutes > ETA_NOTIFY_THRESHOLD_MINUTES) return;

  // Check cooldown -- don't re-notify if we already sent for this stop
  const [locationRow] = await db
    .select({ lastNearbyNotifyStopId: vehicleLocations.lastNearbyNotifyStopId })
    .from(vehicleLocations)
    .where(eq(vehicleLocations.vehicleId, vehicleId))
    .limit(1);

  if (locationRow?.lastNearbyNotifyStopId === nextStop.id) return;

  // Update cooldown marker
  await db
    .update(vehicleLocations)
    .set({ lastNearbyNotifyStopId: nextStop.id })
    .where(eq(vehicleLocations.vehicleId, vehicleId));

  const stopName = nextStop.stopName ?? "your stop";
  const etaLabel = estimatedMinutes <= 1
    ? "less than 1 minute"
    : `~${Math.round(estimatedMinutes)} minutes`;

  await notifyPassengersAtStop(
    nextStop.id,
    `${routeName} arriving soon`,
    `Your jeepney is ${etaLabel} away from ${stopName}. Head to your stop now.`,
  );
}

import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { db } from "../../database/db";
import { stopDwellTimes } from "../../database/schema";
import type { PassengerTrackingRouteStop, PassengerTrackingTripStatus } from "../passenger/passenger-trip-tracking.utils";
import { estimatePassengerEtaMinutes } from "../passenger/passenger-trip-tracking.utils";
import { fetchLegDuration, type StopCoords } from "./mapbox-directions.service";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EtaInput = {
  currentLat: number | null | undefined;
  currentLng: number | null | undefined;
  currentStopOrder: number | null;
  routeStops: PassengerTrackingRouteStop[];
  scheduledDepartureTime: Date;
  targetStopOrder: number | null;
  tripId: string;
  tripStatus: PassengerTrackingTripStatus;
};

export type EtaResult = {
  etaMinutes: number | null;
  source: "mapbox" | "fallback";
};

// ─── Dwell-time LRU (deduplicates DB queries within a single request) ────────

const dwellCache = new LRUCache<string, number>({ max: 200, ttl: 600_000 });

// ─── Manila timezone helper ───────────────────────────────────────────────────

function getManilaHourBucket(date: Date): number {
  // Asia/Manila is UTC+8 — no DST
  return (date.getUTCHours() + 8) % 24;
}

// ─── ETA calculation ──────────────────────────────────────────────────────────

/**
 * Calculates ETA using Mapbox Directions API with dwell-time averaging.
 * Falls back to the original haversine estimator transparently on any failure.
 */
export async function calculateEta(input: EtaInput): Promise<EtaResult> {
  const fallback = (): EtaResult => ({
    etaMinutes: estimatePassengerEtaMinutes({
      currentLatitude: input.currentLat,
      currentLongitude: input.currentLng,
      currentStopOrder: input.currentStopOrder,
      routeStops: input.routeStops,
      scheduledDepartureTime: input.scheduledDepartureTime,
      targetStopOrder: input.targetStopOrder,
      tripStatus: input.tripStatus,
    }),
    source: "fallback",
  });

  // Only use Mapbox for active ongoing trips with GPS fix
  if (
    input.tripStatus !== "ongoing" ||
    input.currentLat == null ||
    input.currentLng == null ||
    input.currentStopOrder == null ||
    input.targetStopOrder == null
  ) {
    return fallback();
  }

  if (input.targetStopOrder <= input.currentStopOrder) {
    return { etaMinutes: 0, source: "mapbox" };
  }

  // Build remaining stops from current position to target
  const remainingStops = input.routeStops
    .filter((s) => s.stopOrder > input.currentStopOrder! && s.stopOrder <= input.targetStopOrder!)
    .sort((a, b) => a.stopOrder - b.stopOrder);

  if (remainingStops.length === 0) {
    return fallback();
  }

  // Build waypoints: current GPS pos → each remaining stop
  const currentPos: StopCoords = {
    id: `current-${input.tripId}`,
    latitude: input.currentLat,
    longitude: input.currentLng,
  };

  // First leg: current GPS → first remaining stop
  // Subsequent legs: stop → next stop (uses segment cache across all vehicles)
  const legPairs: { from: StopCoords; to: StopCoords }[] = [];

  const firstStop = remainingStops[0];
  if (firstStop.latitude == null || firstStop.longitude == null) return fallback();

  legPairs.push({
    from: currentPos,
    to: { id: firstStop.id, latitude: firstStop.latitude, longitude: firstStop.longitude },
  });

  for (let i = 1; i < remainingStops.length; i++) {
    const from = remainingStops[i - 1];
    const to   = remainingStops[i];
    if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) {
      return fallback();
    }
    legPairs.push({
      from: { id: from.id, latitude: from.latitude, longitude: from.longitude },
      to:   { id: to.id,   latitude: to.latitude,   longitude: to.longitude   },
    });
  }

  // Fetch all legs in parallel
  const legResults = await Promise.all(legPairs.map(({ from, to }) => fetchLegDuration(from, to)));

  // If any leg returned null, fall back entirely
  if (legResults.some((r) => r === null)) {
    return fallback();
  }

  // Sum durations
  let totalSeconds = legResults.reduce((sum, r) => sum + r!.durationSeconds, 0);

  // Add dwell time for each intermediate stop (all stops except the target)
  const now = new Date();
  const hourBucket = getManilaHourBucket(now);
  const intermediateStops = remainingStops.slice(0, -1); // exclude target stop
  for (const stop of intermediateStops) {
    totalSeconds += await getAverageDwellSeconds(stop.id, hourBucket);
  }

  return { etaMinutes: Math.ceil(totalSeconds / 60), source: "mapbox" };
}

// ─── Dwell time helpers ───────────────────────────────────────────────────────

/**
 * Returns average dwell time in seconds for a stop at a given hour bucket.
 * Uses LRU cache to deduplicate DB queries within a single request.
 * Falls back to 60s default when fewer than 3 observations exist.
 */
export async function getAverageDwellSeconds(stopId: string, hourBucket: number): Promise<number> {
  const cacheKey = `${stopId}:${hourBucket}`;
  const cached = dwellCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const rows = await db
    .select({ dwellSeconds: stopDwellTimes.dwellSeconds })
    .from(stopDwellTimes)
    .where(
      and(
        eq(stopDwellTimes.stopId, stopId),
        or(
          eq(stopDwellTimes.hourBucket, hourBucket),
          eq(stopDwellTimes.hourBucket, (hourBucket + 1) % 24),
          eq(stopDwellTimes.hourBucket, (hourBucket + 23) % 24), // hourBucket - 1, wrapping
        ),
      ),
    )
    .orderBy(desc(stopDwellTimes.createdAt))
    .limit(20);

  const valid = rows.filter((r) => typeof r.dwellSeconds === "number" && r.dwellSeconds > 0);
  const result = valid.length >= 3
    ? Math.round(valid.reduce((sum, r) => sum + r.dwellSeconds!, 0) / valid.length)
    : 60;

  dwellCache.set(cacheKey, result);
  return result;
}

// ─── Stop arrival / departure recording ──────────────────────────────────────

export async function recordStopArrival(
  tripId: string,
  stopId: string,
  arrivedAt: Date,
): Promise<void> {
  await db.insert(stopDwellTimes).values({
    tripId,
    stopId,
    arrivedAt,
    hourBucket: getManilaHourBucket(arrivedAt),
  });
}

export async function recordStopDeparture(
  tripId: string,
  stopId: string,
  departedAt: Date,
): Promise<void> {
  // Find the most recent open arrival row for this (tripId, stopId)
  const [row] = await db
    .select({ id: stopDwellTimes.id, arrivedAt: stopDwellTimes.arrivedAt })
    .from(stopDwellTimes)
    .where(
      and(
        eq(stopDwellTimes.tripId, tripId),
        eq(stopDwellTimes.stopId, stopId),
        // Only rows that haven't been closed yet
        lte(stopDwellTimes.arrivedAt, departedAt),
      ),
    )
    .orderBy(desc(stopDwellTimes.arrivedAt))
    .limit(1);

  if (!row) return;

  const dwellSeconds = Math.round((departedAt.getTime() - row.arrivedAt.getTime()) / 1000);
  await db
    .update(stopDwellTimes)
    .set({ departedAt, dwellSeconds })
    .where(eq(stopDwellTimes.id, row.id));
}

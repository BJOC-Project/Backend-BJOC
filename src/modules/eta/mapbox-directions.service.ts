import { and, eq, gt, sql } from "drizzle-orm";
import { appEnv } from "../../config/env";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import { routeSegmentEtaCache, systemSettings } from "../../database/schema";

const SYSTEM_SETTINGS_ID = "maintenance";

export type StopCoords = {
  id: string;
  latitude: number;
  longitude: number;
};

export type LegDuration = {
  congestionLevel: "heavy" | "low" | "moderate";
  durationSeconds: number;
};

/**
 * Reads the mapbox-related columns from system_settings.
 * Called fresh on every invocation — no in-memory cache (Vercel serverless).
 */
async function readMapboxSettings() {
  const [row] = await db
    .select({
      mapboxEnabled:                systemSettings.mapboxEnabled,
      mapboxCircuitBreakerLimit:    systemSettings.mapboxCircuitBreakerLimit,
      mapboxSegmentCacheTtlSeconds: systemSettings.mapboxSegmentCacheTtlSeconds,
      mapboxCallsThisMonth:         systemSettings.mapboxCallsThisMonth,
      mapboxCallsMonthKey:          systemSettings.mapboxCallsMonthKey,
    })
    .from(systemSettings)
    .where(eq(systemSettings.id, SYSTEM_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}

function currentMonthKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * Fetches the Mapbox Directions road duration for a single stop-to-stop leg.
 *
 * Uses DB-backed segment cache (shared across all vehicles on the same route).
 * Manages a DB-persisted monthly call counter that auto-resets on the 1st of
 * each month — safe for Vercel serverless (no shared memory between invocations).
 *
 * Returns null on any failure so callers can fall back to haversine.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function worstCongestion(levels: string[]): "heavy" | "low" | "moderate" {
  for (const level of levels) {
    if (level === "heavy" || level === "severe") return "heavy";
  }
  for (const level of levels) {
    if (level === "moderate") return "moderate";
  }
  return "low";
}

export async function fetchLegDuration(
  fromStop: StopCoords,
  toStop: StopCoords,
): Promise<LegDuration | null> {
  const settings = await readMapboxSettings();
  if (!settings) return null;

  const { mapboxEnabled, mapboxCircuitBreakerLimit, mapboxSegmentCacheTtlSeconds,
          mapboxCallsThisMonth, mapboxCallsMonthKey } = settings;

  if (!mapboxEnabled) return null;

  const monthKey = currentMonthKey();

  // Auto-reset counter on new month
  let callsThisMonth = mapboxCallsThisMonth;
  if (mapboxCallsMonthKey !== monthKey) {
    await db
      .update(systemSettings)
      .set({ mapboxCallsThisMonth: 0, mapboxCallsMonthKey: monthKey })
      .where(eq(systemSettings.id, SYSTEM_SETTINGS_ID));
    callsThisMonth = 0;
  }

  if (callsThisMonth >= mapboxCircuitBreakerLimit) {
    logger.warn({ msg: "Mapbox circuit breaker active — falling back to haversine", callsThisMonth, limit: mapboxCircuitBreakerLimit });
    return null;
  }

  // Check DB cache for this stop pair (only when both IDs are real UUIDs)
  const canCache = isUuid(fromStop.id) && isUuid(toStop.id);
  if (canCache) {
    const ttlCutoff = new Date(Date.now() - mapboxSegmentCacheTtlSeconds * 1000);
    const [cached] = await db
      .select({ congestionLevel: routeSegmentEtaCache.congestionLevel, durationSeconds: routeSegmentEtaCache.durationSeconds })
      .from(routeSegmentEtaCache)
      .where(
        and(
          eq(routeSegmentEtaCache.fromStopId, fromStop.id),
          eq(routeSegmentEtaCache.toStopId, toStop.id),
          gt(routeSegmentEtaCache.cachedAt, ttlCutoff),
        ),
      )
      .limit(1);

    if (cached) {
      return {
        congestionLevel: (cached.congestionLevel as "heavy" | "low" | "moderate" | null) ?? "low",
        durationSeconds: cached.durationSeconds,
      };
    }
  }

  // Cache miss — call Mapbox
  const coords = `${fromStop.longitude},${fromStop.latitude};${toStop.longitude},${toStop.latitude}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?access_token=${appEnv.MAPBOX_ACCESS_TOKEN}&overview=false&annotations=congestion`;

  let durationSeconds: number;
  let congestionLevel: "heavy" | "low" | "moderate" = "low";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ msg: "Mapbox Directions API error", status: res.status, fromStopId: fromStop.id, toStopId: toStop.id });
      return null;
    }
    const data = await res.json() as { routes?: { legs?: { annotation?: { congestion?: string[] }; duration?: number }[] }[] };
    const leg = data.routes?.[0]?.legs?.[0];
    if (typeof leg?.duration !== "number") {
      logger.warn({ msg: "Mapbox response missing duration", fromStopId: fromStop.id, toStopId: toStop.id });
      return null;
    }
    durationSeconds = Math.round(leg.duration);
    congestionLevel = worstCongestion(leg.annotation?.congestion ?? []);
  } catch (err) {
    logger.warn({ msg: "Mapbox fetch failed", err, fromStopId: fromStop.id, toStopId: toStop.id });
    return null;
  }

  // Upsert cache row and increment counter (best-effort — don't fail ETA on DB error)
  try {
    if (canCache) {
      await db
        .insert(routeSegmentEtaCache)
        .values({ congestionLevel, fromStopId: fromStop.id, toStopId: toStop.id, durationSeconds, cachedAt: new Date() })
        .onConflictDoUpdate({
          target: [routeSegmentEtaCache.fromStopId, routeSegmentEtaCache.toStopId],
          set: { congestionLevel, durationSeconds, cachedAt: new Date() },
        });
    }

    await db
      .update(systemSettings)
      .set({ mapboxCallsThisMonth: sql`${systemSettings.mapboxCallsThisMonth} + 1` })
      .where(eq(systemSettings.id, SYSTEM_SETTINGS_ID));
  } catch (err) {
    logger.warn({ msg: "Failed to persist Mapbox cache/counter", err });
  }

  return { congestionLevel, durationSeconds };
}

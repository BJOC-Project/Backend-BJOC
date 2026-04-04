import { eq } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import { systemSettings, users } from "../../database/schema";
import type {
  DriverTrackingSettings,
  SystemMaintenanceSettings,
  UpdateSystemMaintenanceSettingsInput,
} from "./system-settings.types";

const SYSTEM_SETTINGS_ID = "maintenance";
const SETTINGS_CACHE_TTL_MS = 30_000;

type SystemSettingsRow = {
  createdAt: Date;
  driverTrackingDistanceMeters: number;
  driverTrackingIntervalSeconds: number;
  id: string;
  offRouteAlertCooldownSeconds: number;
  offRouteThresholdMeters: number;
  updatedAt: Date;
  updatedBy: string | null;
};

type CachedSettings = {
  expiresAt: number;
  row: SystemSettingsRow;
};

let settingsCache: CachedSettings | null = null;

function buildFullName(input: {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}) {
  const parts = [
    input.firstName,
    input.middleName,
    input.lastName,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : null;
}

function mapTrackingSettings(row: SystemSettingsRow): DriverTrackingSettings {
  return {
    driver_tracking_distance_meters: row.driverTrackingDistanceMeters,
    driver_tracking_interval_seconds: row.driverTrackingIntervalSeconds,
    off_route_alert_cooldown_seconds: row.offRouteAlertCooldownSeconds,
    off_route_threshold_meters: row.offRouteThresholdMeters,
  };
}

async function fetchSettingsRow() {
  const [row] = await db
    .select({
      createdAt: systemSettings.createdAt,
      driverTrackingDistanceMeters: systemSettings.driverTrackingDistanceMeters,
      driverTrackingIntervalSeconds: systemSettings.driverTrackingIntervalSeconds,
      id: systemSettings.id,
      offRouteAlertCooldownSeconds: systemSettings.offRouteAlertCooldownSeconds,
      offRouteThresholdMeters: systemSettings.offRouteThresholdMeters,
      updatedAt: systemSettings.updatedAt,
      updatedBy: systemSettings.updatedBy,
    })
    .from(systemSettings)
    .where(eq(systemSettings.id, SYSTEM_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}

async function ensureSettingsRow(forceFresh = false) {
  if (!forceFresh && settingsCache && settingsCache.expiresAt > Date.now()) {
    return settingsCache.row;
  }

  let row = await fetchSettingsRow();

  if (!row) {
    await db
      .insert(systemSettings)
      .values({
        id: SYSTEM_SETTINGS_ID,
      })
      .onConflictDoNothing();

    row = await fetchSettingsRow();
  }

  if (!row) {
    throw new Error("System maintenance settings could not be initialized.");
  }

  settingsCache = {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    row,
  };

  return row;
}

function cacheSettingsRow(row: SystemSettingsRow) {
  settingsCache = {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    row,
  };
}

export async function systemSettingsGetDriverTrackingSettings(forceFresh = false) {
  const row = await ensureSettingsRow(forceFresh);
  return mapTrackingSettings(row);
}

export async function systemSettingsGetMaintenanceSettings(forceFresh = false): Promise<SystemMaintenanceSettings> {
  const row = await ensureSettingsRow(forceFresh);

  let updatedByName: string | null = null;

  if (row.updatedBy) {
    const [updaterRow] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: users.middleName,
      })
      .from(users)
      .where(eq(users.id, row.updatedBy))
      .limit(1);

    if (updaterRow) {
      updatedByName = buildFullName(updaterRow);
    }
  }

  return {
    ...mapTrackingSettings(row),
    updated_at: row.updatedAt,
    updated_by_name: updatedByName,
    updated_by_user_id: row.updatedBy,
  };
}

export async function systemSettingsUpdateMaintenanceSettings(
  input: UpdateSystemMaintenanceSettingsInput,
  actorUserId?: string,
) {
  await ensureSettingsRow(true);

  const [updatedRow] = await db
    .update(systemSettings)
    .set({
      driverTrackingDistanceMeters: input.driver_tracking_distance_meters,
      driverTrackingIntervalSeconds: input.driver_tracking_interval_seconds,
      offRouteAlertCooldownSeconds: input.off_route_alert_cooldown_seconds,
      offRouteThresholdMeters: input.off_route_threshold_meters,
      updatedAt: new Date(),
      updatedBy: actorUserId ?? null,
    })
    .where(eq(systemSettings.id, SYSTEM_SETTINGS_ID))
    .returning({
      createdAt: systemSettings.createdAt,
      driverTrackingDistanceMeters: systemSettings.driverTrackingDistanceMeters,
      driverTrackingIntervalSeconds: systemSettings.driverTrackingIntervalSeconds,
      id: systemSettings.id,
      offRouteAlertCooldownSeconds: systemSettings.offRouteAlertCooldownSeconds,
      offRouteThresholdMeters: systemSettings.offRouteThresholdMeters,
      updatedAt: systemSettings.updatedAt,
      updatedBy: systemSettings.updatedBy,
    });

  if (!updatedRow) {
    throw new Error("System maintenance settings could not be updated.");
  }

  cacheSettingsRow(updatedRow);

  logger.info({
    msg: "System maintenance settings updated",
    actorUserId,
    settingsId: updatedRow.id,
  });

  return systemSettingsGetMaintenanceSettings(true);
}

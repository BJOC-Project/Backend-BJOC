import { z } from "zod";

export const systemMaintenanceSettingsBodySchema = z.object({
  driver_tracking_distance_meters: z.number().int().min(5).max(100),
  driver_tracking_interval_seconds: z.number().int().min(5).max(60),
  off_route_alert_cooldown_seconds: z.number().int().min(30).max(3600),
  off_route_threshold_meters: z.number().int().min(25).max(1000),
  mapbox_enabled: z.boolean().optional(),
  mapbox_circuit_breaker_limit: z.number().int().min(1000).max(100000).optional(),
  mapbox_segment_cache_ttl_seconds: z.number().int().min(60).max(3600).optional(),
});

export type SystemMaintenanceSettingsBody = z.infer<typeof systemMaintenanceSettingsBodySchema>;

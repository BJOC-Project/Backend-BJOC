export interface SystemMaintenanceSettings {
  driver_tracking_distance_meters: number;
  driver_tracking_interval_seconds: number;
  off_route_alert_cooldown_seconds: number;
  off_route_threshold_meters: number;
  updated_at: Date;
  updated_by_name: string | null;
  updated_by_user_id: string | null;
}

export interface DriverTrackingSettings {
  driver_tracking_distance_meters: number;
  driver_tracking_interval_seconds: number;
  off_route_alert_cooldown_seconds: number;
  off_route_threshold_meters: number;
}

export interface UpdateSystemMaintenanceSettingsInput {
  driver_tracking_distance_meters: number;
  driver_tracking_interval_seconds: number;
  off_route_alert_cooldown_seconds: number;
  off_route_threshold_meters: number;
}

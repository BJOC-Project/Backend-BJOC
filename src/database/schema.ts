import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status_enum", ["active", "inactive", "suspended"]);
export const vehicleStatusEnum = pgEnum("vehicle_status_enum", ["offline", "available", "on_route", "maintenance"]);
export const driverStatusEnum = pgEnum("driver_status_enum", ["offline", "available", "driving", "suspended"]);
export const tripStatusEnum = pgEnum("trip_status_enum", ["scheduled", "ongoing", "completed", "cancelled"]);
export const passengerTripStatusEnum = pgEnum("passenger_trip_status_enum", ["booked", "waiting", "onboard", "completed", "cancelled"]);
export const notificationTypeEnum = pgEnum("notification_type_enum", ["trip", "vehicle", "driver", "maintenance", "route", "system", "emergency", "message"]);
export const notificationSeverityEnum = pgEnum("notification_severity_enum", ["info", "success", "warning", "critical"]);
export const emergencyReasonTypeEnum = pgEnum("emergency_reason_type_enum", ["vehicle_problem", "other"]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  rolesNameUnique: uniqueIndex("roles_name_unique").on(table.name),
}));

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  profileUrl: text("profile_url"),
  contact: text("contact"),
  status: userStatusEnum("status").notNull().default("active"),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  usersEmailUnique: uniqueIndex("users_email_unique").on(table.email),
  usersRoleIndex: index("users_role_id_idx").on(table.roleId),
  usersStatusIndex: index("users_status_idx").on(table.status),
}));

export const drivers = pgTable("drivers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  licenseNumber: text("license_number"),
  status: driverStatusEnum("status").notNull().default("offline"),
  lastActive: timestamp("last_active", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  driversLicenseUnique: uniqueIndex("drivers_license_number_unique").on(table.licenseNumber),
  driversStatusIndex: index("drivers_status_idx").on(table.status),
}));

export const passengers = pgTable("passengers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  username: text("username"),
  status: userStatusEnum("status").notNull().default("active"),
  expoPushToken: text("expo_push_token"),
  preferredStopId: uuid("preferred_stop_id").references(() => stops.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  passengersUsernameUnique: uniqueIndex("passengers_username_unique").on(table.username),
  passengersStatusIndex: index("passengers_status_idx").on(table.status),
}));

export const staff = pgTable("staff", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  department: text("department"),
  position: text("position"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  plateNumber: text("plate_number"),
  model: text("model"),
  capacity: integer("capacity"),
  status: vehicleStatusEnum("status").notNull().default("offline"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  vehiclesPlateUnique: uniqueIndex("vehicles_plate_number_unique").on(table.plateNumber),
  vehiclesStatusIndex: index("vehicles_status_idx").on(table.status),
}));

export const vehicleAssignments = pgTable("vehicle_assignments", {
  vehicleId: uuid("vehicle_id").primaryKey().references(() => vehicles.id, { onDelete: "cascade" }),
  driverUserId: uuid("driver_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  vehicleAssignmentsDriverUnique: uniqueIndex("vehicle_assignments_driver_user_id_unique").on(table.driverUserId),
}));

export const transitRoutes = pgTable("routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeName: text("route_name"),
  startLocation: text("start_location"),
  endLocation: text("end_location"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  routesActiveIndex: index("routes_is_active_idx").on(table.isActive),
}));

export const stops = pgTable("stops", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeId: uuid("route_id").notNull().references(() => transitRoutes.id, { onDelete: "cascade" }),
  stopName: text("stop_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  stopOrder: integer("stop_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  stopsRouteIndex: index("stops_route_id_idx").on(table.routeId),
  stopsRouteOrderUnique: uniqueIndex("stops_route_order_unique").on(table.routeId, table.stopOrder),
}));

export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeId: uuid("route_id").notNull().references(() => transitRoutes.id, { onDelete: "restrict" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  driverUserId: uuid("driver_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  tripDate: date("trip_date").notNull(),
  scheduledDepartureTime: timestamp("scheduled_departure_time", { withTimezone: true }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  recordedPassengerCount: integer("recorded_passenger_count"),
  totalBoardedPassengers: integer("total_boarded_passengers").default(0),
  status: tripStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tripsRouteIndex: index("trips_route_id_idx").on(table.routeId),
  tripsVehicleIndex: index("trips_vehicle_id_idx").on(table.vehicleId),
  tripsDriverIndex: index("trips_driver_user_id_idx").on(table.driverUserId),
  tripsStatusDateIndex: index("trips_status_trip_date_idx").on(table.status, table.tripDate),
  tripsDriverEndTimeIndex: index("trips_driver_status_end_time_idx").on(table.driverUserId, table.status, table.endTime),
}));

export const passengerTrips = pgTable("passenger_trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  passengerUserId: uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  pickupStopId: uuid("pickup_stop_id").references(() => stops.id, { onDelete: "set null" }),
  dropoffStopId: uuid("dropoff_stop_id").references(() => stops.id, { onDelete: "set null" }),
  status: passengerTripStatusEnum("status").notNull().default("booked"),
  fare: doublePrecision("fare"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  passengerTripsTripIndex: index("passenger_trips_trip_idx").on(table.tripId),
  passengerTripsPassengerIndex: index("passenger_trips_passenger_idx").on(table.passengerUserId),
}));

export const vehicleLocations = pgTable("vehicle_locations", {
  vehicleId: uuid("vehicle_id").primaryKey().references(() => vehicles.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  currentStopId: uuid("current_stop_id").references(() => stops.id, { onDelete: "set null" }),
  isOffRoute: boolean("is_off_route").notNull().default(false),
  offRouteDistanceMeters: integer("off_route_distance_meters"),
  offRouteDetectedAt: timestamp("off_route_detected_at", { withTimezone: true }),
  lastOffRouteAlertAt: timestamp("last_off_route_alert_at", { withTimezone: true }),
  lastNearbyNotifyStopId: uuid("last_nearby_notify_stop_id").references(() => stops.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  vehicleLocationsStopIndex: index("vehicle_locations_current_stop_id_idx").on(table.currentStopId),
  vehicleLocationsOffRouteIndex: index("vehicle_locations_is_off_route_idx").on(table.isOffRoute),
}));

export const gpsLogs = pgTable("gps_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  gpsLogsVehicleRecordedIndex: index("gps_logs_vehicle_recorded_at_idx").on(table.vehicleId, table.recordedAt),
}));

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  description: text("description"),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
  performedBy: uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
  module: text("module"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  activityLogsModuleIndex: index("activity_logs_module_idx").on(table.module),
  activityLogsPerformedByIndex: index("activity_logs_performed_by_idx").on(table.performedBy),
}));

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull().default("system"),
  severity: notificationSeverityEnum("severity").notNull().default("info"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  notificationsTargetReadIndex: index("notifications_target_read_idx").on(table.targetUserId, table.isRead),
  notificationsTargetCreatedIndex: index("notifications_target_created_idx").on(table.targetUserId, table.createdAt),
  notificationsTargetTypeCreatedIndex: index("notifications_target_type_created_idx").on(table.targetUserId, table.type, table.createdAt),
}));

export const tripEmergencyReports = pgTable("trip_emergency_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  driverUserId: uuid("driver_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reasonType: emergencyReasonTypeEnum("reason_type").notNull(),
  reasonText: text("reason_text"),
  reportedPassengerCount: integer("reported_passenger_count").notNull(),
  clientActionId: text("client_action_id").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tripEmergencyReportsTripUnique: uniqueIndex("trip_emergency_reports_trip_id_unique").on(table.tripId),
  tripEmergencyReportsClientActionUnique: uniqueIndex("trip_emergency_reports_client_action_id_unique").on(table.clientActionId),
  tripEmergencyReportsDriverReportedIndex: index("trip_emergency_reports_driver_reported_at_idx").on(table.driverUserId, table.reportedAt),
}));

export const emailChangeRequests = pgTable("email_change_requests", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  pendingEmail: text("pending_email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => ({
  emailChangeRequestsPendingEmailUnique: uniqueIndex("email_change_requests_pending_email_unique").on(table.pendingEmail),
  emailChangeRequestsExpiresIndex: index("email_change_requests_expires_at_idx").on(table.expiresAt),
}));

export const appFeedback = pgTable("app_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  rating: integer("rating"),
  message: text("message"),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  appFeedbackCreatedIndex: index("app_feedback_created_at_idx").on(table.createdAt),
  appFeedbackRatingIndex: index("app_feedback_rating_idx").on(table.rating),
  appFeedbackUserIndex: index("app_feedback_user_id_idx").on(table.userId),
}));

export const stopDwellTimes = pgTable("stop_dwell_times", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  stopId: uuid("stop_id").notNull().references(() => stops.id, { onDelete: "cascade" }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull(),
  departedAt: timestamp("departed_at", { withTimezone: true }),
  dwellSeconds: integer("dwell_seconds"),
  hourBucket: integer("hour_bucket"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  stopDwellStopIdx:   index("stop_dwell_times_stop_id_idx").on(table.stopId),
  stopDwellTripIdx:   index("stop_dwell_times_trip_id_idx").on(table.tripId),
  stopDwellBucketIdx: index("stop_dwell_times_hour_bucket_idx").on(table.stopId, table.hourBucket),
}));

export const routeSegmentEtaCache = pgTable("route_segment_eta_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromStopId:      uuid("from_stop_id").notNull().references(() => stops.id, { onDelete: "cascade" }),
  toStopId:        uuid("to_stop_id").notNull().references(() => stops.id, { onDelete: "cascade" }),
  durationSeconds: integer("duration_seconds").notNull(),
  congestionLevel: text("congestion_level"),
  cachedAt:        timestamp("cached_at", { withTimezone: true }).notNull(),
}, (table) => ({
  segmentCacheIdx: uniqueIndex("route_segment_eta_cache_idx").on(table.fromStopId, table.toStopId),
}));

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey(),
  driverTrackingIntervalSeconds: integer("driver_tracking_interval_seconds").notNull().default(10),
  driverTrackingDistanceMeters: integer("driver_tracking_distance_meters").notNull().default(15),
  offRouteThresholdMeters: integer("off_route_threshold_meters").notNull().default(250),
  offRouteAlertCooldownSeconds: integer("off_route_alert_cooldown_seconds").notNull().default(180),
  mapboxEnabled:                boolean("mapbox_enabled").notNull().default(true),
  mapboxCircuitBreakerLimit:    integer("mapbox_circuit_breaker_limit").notNull().default(80000),
  mapboxSegmentCacheTtlSeconds: integer("mapbox_segment_cache_ttl_seconds").notNull().default(300),
  mapboxCallsThisMonth:         integer("mapbox_calls_this_month").notNull().default(0),
  mapboxCallsMonthKey:          text("mapbox_calls_month_key").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const schema = {
  roles,
  users,
  drivers,
  passengers,
  staff,
  vehicles,
  vehicleAssignments,
  transitRoutes,
  stops,
  trips,
  passengerTrips,
  vehicleLocations,
  gpsLogs,
  activityLogs,
  notifications,
  tripEmergencyReports,
  emailChangeRequests,
  appFeedback,
  stopDwellTimes,
  routeSegmentEtaCache,
  systemSettings,
};

export type AppRole = "admin" | "driver" | "passenger" | "staff";

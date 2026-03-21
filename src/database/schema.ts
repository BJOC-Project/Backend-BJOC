import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

export const transitRoutes = pgTable("routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeName: text("route_name").notNull(),
  startLocation: text("start_location"),
  endLocation: text("end_location"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
  status: tripStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tripsRouteIndex: index("trips_route_id_idx").on(table.routeId),
  tripsVehicleIndex: index("trips_vehicle_id_idx").on(table.vehicleId),
  tripsDriverIndex: index("trips_driver_user_id_idx").on(table.driverUserId),
  tripsStatusDateIndex: index("trips_status_trip_date_idx").on(table.status, table.tripDate),
}));

export const vehicleLocations = pgTable("vehicle_locations", {
  vehicleId: uuid("vehicle_id").primaryKey().references(() => vehicles.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  currentStopId: uuid("current_stop_id").references(() => stops.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  vehicleLocationsStopIndex: index("vehicle_locations_current_stop_id_idx").on(table.currentStopId),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  activityLogsModuleIndex: index("activity_logs_module_idx").on(table.module),
  activityLogsPerformedByIndex: index("activity_logs_performed_by_idx").on(table.performedBy),
}));

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  notificationsTargetReadIndex: index("notifications_target_read_idx").on(table.targetUserId, table.isRead),
}));

export const schema = {
  roles,
  users,
  drivers,
  passengers,
  staff,
  vehicles,
  transitRoutes,
  stops,
  trips,
  vehicleLocations,
  gpsLogs,
  activityLogs,
  notifications,
};

export type AppRole = "admin" | "driver" | "passenger" | "staff";

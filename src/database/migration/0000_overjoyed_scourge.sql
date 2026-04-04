CREATE TYPE "public"."driver_status_enum" AS ENUM('offline', 'available', 'driving', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."emergency_reason_type_enum" AS ENUM('vehicle_problem', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_severity_enum" AS ENUM('info', 'success', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_type_enum" AS ENUM('trip', 'vehicle', 'driver', 'maintenance', 'route', 'system', 'emergency', 'message');--> statement-breakpoint
CREATE TYPE "public"."passenger_trip_status_enum" AS ENUM('booked', 'waiting', 'onboard', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_status_enum" AS ENUM('scheduled', 'ongoing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_status_enum" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status_enum" AS ENUM('offline', 'available', 'on_route', 'maintenance');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"target_user_id" uuid,
	"performed_by" uuid,
	"module" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"rating" integer,
	"message" text,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"license_number" text,
	"status" "driver_status_enum" DEFAULT 'offline' NOT NULL,
	"last_active" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_change_requests" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pending_email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gps_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid,
	"latitude" double precision,
	"longitude" double precision,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type_enum" DEFAULT 'system' NOT NULL,
	"severity" "notification_severity_enum" DEFAULT 'info' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"target_user_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passenger_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passenger_user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"pickup_stop_id" uuid,
	"dropoff_stop_id" uuid,
	"status" "passenger_trip_status_enum" DEFAULT 'booked' NOT NULL,
	"fare" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"status" "user_status_enum" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"department" text,
	"position" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"stop_name" text,
	"latitude" double precision,
	"longitude" double precision,
	"stop_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_name" text,
	"start_location" text,
	"end_location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_emergency_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"reason_type" "emergency_reason_type_enum" NOT NULL,
	"reason_text" text,
	"reported_passenger_count" integer NOT NULL,
	"client_action_id" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"driver_user_id" uuid,
	"assigned_by" uuid,
	"trip_date" date NOT NULL,
	"scheduled_departure_time" timestamp with time zone NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"recorded_passenger_count" integer,
	"status" "trip_status_enum" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"profile_url" text,
	"contact" text,
	"status" "user_status_enum" DEFAULT 'active' NOT NULL,
	"suspended_until" timestamp with time zone,
	"suspension_reason" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_assignments" (
	"vehicle_id" uuid PRIMARY KEY NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_locations" (
	"vehicle_id" uuid PRIMARY KEY NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"current_stop_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plate_number" text,
	"model" text,
	"capacity" integer,
	"status" "vehicle_status_enum" DEFAULT 'offline' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_logs" ADD CONSTRAINT "gps_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passenger_trips" ADD CONSTRAINT "passenger_trips_passenger_user_id_users_id_fk" FOREIGN KEY ("passenger_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passenger_trips" ADD CONSTRAINT "passenger_trips_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passenger_trips" ADD CONSTRAINT "passenger_trips_pickup_stop_id_stops_id_fk" FOREIGN KEY ("pickup_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passenger_trips" ADD CONSTRAINT "passenger_trips_dropoff_stop_id_stops_id_fk" FOREIGN KEY ("dropoff_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stops" ADD CONSTRAINT "stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_emergency_reports" ADD CONSTRAINT "trip_emergency_reports_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_emergency_reports" ADD CONSTRAINT "trip_emergency_reports_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_current_stop_id_stops_id_fk" FOREIGN KEY ("current_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_module_idx" ON "activity_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "activity_logs_performed_by_idx" ON "activity_logs" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "app_feedback_created_at_idx" ON "app_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_feedback_rating_idx" ON "app_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "app_feedback_user_id_idx" ON "app_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_license_number_unique" ON "drivers" USING btree ("license_number");--> statement-breakpoint
CREATE INDEX "drivers_status_idx" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "email_change_requests_pending_email_unique" ON "email_change_requests" USING btree ("pending_email");--> statement-breakpoint
CREATE INDEX "email_change_requests_expires_at_idx" ON "email_change_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "gps_logs_vehicle_recorded_at_idx" ON "gps_logs" USING btree ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "notifications_target_read_idx" ON "notifications" USING btree ("target_user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_target_created_idx" ON "notifications" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_target_type_created_idx" ON "notifications" USING btree ("target_user_id","type","created_at");--> statement-breakpoint
CREATE INDEX "passenger_trips_trip_idx" ON "passenger_trips" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "passenger_trips_passenger_idx" ON "passenger_trips" USING btree ("passenger_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passengers_username_unique" ON "passengers" USING btree ("username");--> statement-breakpoint
CREATE INDEX "passengers_status_idx" ON "passengers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_unique" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "stops_route_id_idx" ON "stops" USING btree ("route_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stops_route_order_unique" ON "stops" USING btree ("route_id","stop_order");--> statement-breakpoint
CREATE INDEX "routes_is_active_idx" ON "routes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_emergency_reports_trip_id_unique" ON "trip_emergency_reports" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_emergency_reports_client_action_id_unique" ON "trip_emergency_reports" USING btree ("client_action_id");--> statement-breakpoint
CREATE INDEX "trip_emergency_reports_driver_reported_at_idx" ON "trip_emergency_reports" USING btree ("driver_user_id","reported_at");--> statement-breakpoint
CREATE INDEX "trips_route_id_idx" ON "trips" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "trips_vehicle_id_idx" ON "trips" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trips_driver_user_id_idx" ON "trips" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "trips_status_trip_date_idx" ON "trips" USING btree ("status","trip_date");--> statement-breakpoint
CREATE INDEX "trips_driver_status_end_time_idx" ON "trips" USING btree ("driver_user_id","status","end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_assignments_driver_user_id_unique" ON "vehicle_assignments" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "vehicle_locations_current_stop_id_idx" ON "vehicle_locations" USING btree ("current_stop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_plate_number_unique" ON "vehicles" USING btree ("plate_number");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");

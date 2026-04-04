CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_tracking_interval_seconds" integer DEFAULT 10 NOT NULL,
	"driver_tracking_distance_meters" integer DEFAULT 15 NOT NULL,
	"off_route_threshold_meters" integer DEFAULT 250 NOT NULL,
	"off_route_alert_cooldown_seconds" integer DEFAULT 180 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD COLUMN "is_off_route" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD COLUMN "off_route_distance_meters" integer;
--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD COLUMN "off_route_detected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD COLUMN "last_off_route_alert_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "vehicle_locations_is_off_route_idx" ON "vehicle_locations" USING btree ("is_off_route");

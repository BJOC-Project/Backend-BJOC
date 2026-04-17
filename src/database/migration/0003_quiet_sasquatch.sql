CREATE TABLE "route_segment_eta_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_stop_id" uuid NOT NULL,
	"to_stop_id" uuid NOT NULL,
	"duration_seconds" integer NOT NULL,
	"cached_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop_dwell_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"arrived_at" timestamp with time zone NOT NULL,
	"departed_at" timestamp with time zone,
	"dwell_seconds" integer,
	"hour_bucket" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "mapbox_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "mapbox_circuit_breaker_limit" integer DEFAULT 80000 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "mapbox_segment_cache_ttl_seconds" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "mapbox_calls_this_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "mapbox_calls_month_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "route_segment_eta_cache" ADD CONSTRAINT "route_segment_eta_cache_from_stop_id_stops_id_fk" FOREIGN KEY ("from_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_segment_eta_cache" ADD CONSTRAINT "route_segment_eta_cache_to_stop_id_stops_id_fk" FOREIGN KEY ("to_stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_dwell_times" ADD CONSTRAINT "stop_dwell_times_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_dwell_times" ADD CONSTRAINT "stop_dwell_times_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_segment_eta_cache_idx" ON "route_segment_eta_cache" USING btree ("from_stop_id","to_stop_id");--> statement-breakpoint
CREATE INDEX "stop_dwell_times_stop_id_idx" ON "stop_dwell_times" USING btree ("stop_id");--> statement-breakpoint
CREATE INDEX "stop_dwell_times_trip_id_idx" ON "stop_dwell_times" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "stop_dwell_times_hour_bucket_idx" ON "stop_dwell_times" USING btree ("stop_id","hour_bucket");
ALTER TABLE "passengers" ADD COLUMN "expo_push_token" text;--> statement-breakpoint
ALTER TABLE "passengers" ADD COLUMN "preferred_stop_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD COLUMN "last_nearby_notify_stop_id" uuid;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_preferred_stop_id_stops_id_fk" FOREIGN KEY ("preferred_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_last_nearby_notify_stop_id_stops_id_fk" FOREIGN KEY ("last_nearby_notify_stop_id") REFERENCES "public"."stops"("id") ON DELETE set null ON UPDATE no action;
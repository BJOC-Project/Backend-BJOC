DROP INDEX "route_segment_eta_cache_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "route_segment_eta_cache_idx" ON "route_segment_eta_cache" USING btree ("from_stop_id","to_stop_id");
CREATE INDEX "collector_profiles_authentication_health_created_at_idx" ON "collector_profiles" USING btree ("authentication_health","created_at","profile_id");--> statement-breakpoint

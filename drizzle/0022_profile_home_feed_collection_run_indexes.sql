CREATE INDEX "profile_home_feed_collection_runs_claim_idx" ON "profile_home_feed_collection_runs" USING btree ("status","requested_at","id");--> statement-breakpoint
CREATE INDEX "profile_home_feed_collection_runs_profile_history_idx" ON "profile_home_feed_collection_runs" USING btree ("profile_id","requested_at" DESC,"id" DESC);

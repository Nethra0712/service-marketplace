-- Reuses the set_updated_at() function created in 0002 for the new tables.
CREATE TRIGGER device_tokens_set_updated_at BEFORE UPDATE ON "device_tokens"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER notification_preferences_set_updated_at BEFORE UPDATE ON "notification_preferences"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON "notifications"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON "reviews"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reuses the set_updated_at() function created in 0002 for the new tables.
-- booking_provider_releases is an immutable log (no updated_at column), so it
-- gets no trigger.
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON "bookings"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER booking_quotes_set_updated_at BEFORE UPDATE ON "booking_quotes"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

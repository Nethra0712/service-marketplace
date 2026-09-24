-- Reuses the set_updated_at() function created in 0002 for the new tables.
-- admin_audit_log is an immutable log (no updated_at column), so it gets no trigger.
CREATE TRIGGER admin_users_set_updated_at BEFORE UPDATE ON "admin_users"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER admin_sessions_set_updated_at BEFORE UPDATE ON "admin_sessions"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

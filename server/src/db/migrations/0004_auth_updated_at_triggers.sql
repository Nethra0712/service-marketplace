-- Reuses the set_updated_at() function created in 0002 for the authentication tables.
CREATE TRIGGER otp_challenges_set_updated_at BEFORE UPDATE ON "otp_challenges"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER auth_sessions_set_updated_at BEFORE UPDATE ON "auth_sessions"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER refresh_tokens_set_updated_at BEFORE UPDATE ON "refresh_tokens"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

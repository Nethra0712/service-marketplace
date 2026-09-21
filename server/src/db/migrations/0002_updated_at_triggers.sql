-- Keeps updated_at correct for every UPDATE, including ones that bypass the
-- application (manual fixes, other tools). Only real changes bump it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW IS DISTINCT FROM OLD THEN
		NEW.updated_at := now();
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON "profiles"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER provider_profiles_set_updated_at BEFORE UPDATE ON "provider_profiles"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER service_categories_set_updated_at BEFORE UPDATE ON "service_categories"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER provider_services_set_updated_at BEFORE UPDATE ON "provider_services"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

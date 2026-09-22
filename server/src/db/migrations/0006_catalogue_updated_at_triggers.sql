-- Reuses the set_updated_at() function created in 0002 for the new tables.
CREATE TRIGGER cities_set_updated_at BEFORE UPDATE ON "cities"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER city_categories_set_updated_at BEFORE UPDATE ON "city_categories"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER service_category_translations_set_updated_at BEFORE UPDATE ON "service_category_translations"
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

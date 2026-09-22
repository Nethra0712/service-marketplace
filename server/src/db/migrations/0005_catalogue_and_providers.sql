CREATE TYPE "public"."provider_verification_status" AS ENUM('draft', 'submitted', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_slug_format" CHECK ("cities"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "cities_country_code_format" CHECK ("cities"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "cities_currency_format" CHECK ("cities"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cities_name_not_blank" CHECK (btrim("cities"."name") <> ''),
	CONSTRAINT "cities_timezone_not_blank" CHECK (btrim("cities"."timezone") <> '')
);
--> statement-breakpoint
CREATE TABLE "city_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"service_category_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_category_id" uuid NOT NULL,
	"language" "app_language" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_category_translations_name_not_blank" CHECK (btrim("service_category_translations"."name") <> '')
);
--> statement-breakpoint
DROP INDEX "provider_services_provider_category_uidx";--> statement-breakpoint
DROP INDEX "provider_services_category_status_idx";--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "years_of_experience" smallint;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "verification_status" "provider_verification_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "review_note" text;--> statement-breakpoint
-- Added nullable first so existing rows can be backfilled (see below).
ALTER TABLE "provider_services" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "city_categories" ADD CONSTRAINT "city_categories_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_categories" ADD CONSTRAINT "city_categories_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_category_translations" ADD CONSTRAINT "service_category_translations_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_uidx" ON "cities" USING btree ("slug");--> statement-breakpoint
-- Reference data, not sample data: Colombo is the launch city, and every
-- provider application must belong to a city. Any application that existed
-- before cities did necessarily belongs to it. Idempotent.
INSERT INTO "cities" ("slug", "name", "country_code", "timezone", "currency")
	VALUES ('colombo', 'Colombo', 'LK', 'Asia/Colombo', 'LKR')
	ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "provider_services"
	SET "city_id" = (SELECT "id" FROM "cities" WHERE "slug" = 'colombo')
	WHERE "city_id" IS NULL;--> statement-breakpoint
ALTER TABLE "provider_services" ALTER COLUMN "city_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "city_categories_city_category_uidx" ON "city_categories" USING btree ("city_id","service_category_id");--> statement-breakpoint
CREATE INDEX "city_categories_category_idx" ON "city_categories" USING btree ("service_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_category_translations_category_language_uidx" ON "service_category_translations" USING btree ("service_category_id","language");--> statement-breakpoint
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_services_provider_category_city_uidx" ON "provider_services" USING btree ("provider_profile_id","service_category_id","city_id");--> statement-breakpoint
CREATE INDEX "provider_services_city_category_status_idx" ON "provider_services" USING btree ("city_id","service_category_id","status");--> statement-breakpoint
CREATE INDEX "provider_services_category_idx" ON "provider_services" USING btree ("service_category_id");--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_bio_valid" CHECK ("provider_profiles"."bio" is null or (btrim("provider_profiles"."bio") <> '' and char_length("provider_profiles"."bio") <= 1000));--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_experience_range" CHECK ("provider_profiles"."years_of_experience" is null or ("provider_profiles"."years_of_experience" between 0 and 60));--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_submitted_has_timestamp" CHECK ("provider_profiles"."verification_status" = 'draft' or "provider_profiles"."submitted_at" is not null);--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_decision_has_timestamp" CHECK ("provider_profiles"."verification_status" not in ('verified', 'rejected') or "provider_profiles"."reviewed_at" is not null);
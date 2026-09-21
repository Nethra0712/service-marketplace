CREATE TYPE "public"."app_language" AS ENUM('en', 'si', 'ta');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('fixed', 'hourly', 'quote');--> statement-breakpoint
CREATE TYPE "public"."provider_availability" AS ENUM('offline', 'online');--> statement-breakpoint
CREATE TYPE "public"."provider_service_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "provider_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"availability" "provider_availability" DEFAULT 'offline' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"service_category_id" uuid NOT NULL,
	"status" "provider_service_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_services_decision_has_timestamp" CHECK ("provider_services"."status" = 'pending' or "provider_services"."reviewed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text,
	"preferred_language" "app_language" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_full_name_not_blank" CHECK ("profiles"."full_name" is null or btrim("profiles"."full_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pricing_model" "pricing_model" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_slug_format" CHECK ("service_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "service_categories_name_not_blank" CHECK (btrim("service_categories"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_phone_e164_format" CHECK ("users"."phone_e164" ~ '^[+][1-9][0-9]{6,14}$')
);
--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_profiles_user_id_uidx" ON "provider_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_services_provider_category_uidx" ON "provider_services" USING btree ("provider_profile_id","service_category_id");--> statement-breakpoint
CREATE INDEX "provider_services_category_status_idx" ON "provider_services" USING btree ("service_category_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_uidx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_slug_uidx" ON "service_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_e164_active_uidx" ON "users" USING btree ("phone_e164") WHERE "users"."deleted_at" is null;
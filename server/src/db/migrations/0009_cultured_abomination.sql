CREATE TYPE "public"."booking_offer_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'superseded');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "booking_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"wave" smallint NOT NULL,
	"status" "booking_offer_status" DEFAULT 'pending' NOT NULL,
	"offered_at" timestamp with time zone NOT NULL,
	"responds_by" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"distance_km" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_offers_wave_positive" CHECK ("booking_offers"."wave" > 0),
	CONSTRAINT "booking_offers_responded_at_matches_status" CHECK (("booking_offers"."status" = 'pending') = ("booking_offers"."responded_at" is null)),
	CONSTRAINT "booking_offers_responds_by_after_offered" CHECK ("booking_offers"."responds_by" > "booking_offers"."offered_at"),
	CONSTRAINT "booking_offers_distance_non_negative" CHECK ("booking_offers"."distance_km" is null or "booking_offers"."distance_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "matching_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "last_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "last_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD COLUMN "last_location_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_offers" ADD CONSTRAINT "booking_offers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_offers" ADD CONSTRAINT "booking_offers_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_offers_booking_provider_wave_uidx" ON "booking_offers" USING btree ("booking_id","provider_profile_id","wave");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_offers_booking_provider_pending_uidx" ON "booking_offers" USING btree ("booking_id","provider_profile_id") WHERE "booking_offers"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "booking_offers_booking_accepted_uidx" ON "booking_offers" USING btree ("booking_id") WHERE "booking_offers"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "booking_offers_booking_status_idx" ON "booking_offers" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "booking_offers_provider_status_idx" ON "booking_offers" USING btree ("provider_profile_id","status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_location_pair" CHECK (("bookings"."customer_latitude" is null) = ("bookings"."customer_longitude" is null));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_location_range" CHECK ("bookings"."customer_latitude" is null or
          ("bookings"."customer_latitude" between -90 and 90 and "bookings"."customer_longitude" between -180 and 180));--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_location_pair" CHECK (("provider_profiles"."last_latitude" is null) = ("provider_profiles"."last_longitude" is null) and ("provider_profiles"."last_latitude" is null) = ("provider_profiles"."last_location_at" is null));--> statement-breakpoint
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_location_range" CHECK ("provider_profiles"."last_latitude" is null or ("provider_profiles"."last_latitude" between -90 and 90 and "provider_profiles"."last_longitude" between -180 and 180));
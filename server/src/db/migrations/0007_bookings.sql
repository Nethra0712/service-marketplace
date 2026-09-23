CREATE TYPE "public"."booking_quote_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('searching', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('on_demand', 'scheduled');--> statement-breakpoint
CREATE TABLE "booking_provider_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"reason" text,
	"released_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_provider_releases_reason_valid" CHECK ("booking_provider_releases"."reason" is null or (btrim("booking_provider_releases"."reason") <> '' and char_length("booking_provider_releases"."reason") <= 500))
);
--> statement-breakpoint
CREATE TABLE "booking_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"status" "booking_quote_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_quotes_amount_positive" CHECK ("booking_quotes"."amount" > 0),
	CONSTRAINT "booking_quotes_note_valid" CHECK ("booking_quotes"."note" is null or (btrim("booking_quotes"."note") <> '' and char_length("booking_quotes"."note") <= 500)),
	CONSTRAINT "booking_quotes_responded_at_matches_status" CHECK (("booking_quotes"."status" = 'pending') = ("booking_quotes"."responded_at" is null))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_category_id" uuid NOT NULL,
	"provider_profile_id" uuid,
	"city_id" uuid NOT NULL,
	"booking_type" "booking_type" NOT NULL,
	"status" "booking_status" DEFAULT 'searching' NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"customer_notes" text,
	"service_address" text NOT NULL,
	"agreed_amount" numeric(12, 2),
	"accepted_at" timestamp with time zone,
	"en_route_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"work_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_scheduled_at_matches_type" CHECK (("bookings"."booking_type" = 'scheduled' and "bookings"."scheduled_at" is not null) or
          ("bookings"."booking_type" = 'on_demand' and "bookings"."scheduled_at" is null)),
	CONSTRAINT "bookings_service_address_valid" CHECK (btrim("bookings"."service_address") <> '' and char_length("bookings"."service_address") <= 500),
	CONSTRAINT "bookings_customer_notes_valid" CHECK ("bookings"."customer_notes" is null or
          (btrim("bookings"."customer_notes") <> '' and char_length("bookings"."customer_notes") <= 1000)),
	CONSTRAINT "bookings_agreed_amount_positive" CHECK ("bookings"."agreed_amount" is null or "bookings"."agreed_amount" > 0),
	CONSTRAINT "bookings_provider_matches_status" CHECK (("bookings"."status" <> 'searching' or "bookings"."provider_profile_id" is null) and
          ("bookings"."status" not in ('accepted', 'en_route', 'arrived', 'in_progress', 'completed') or "bookings"."provider_profile_id" is not null)),
	CONSTRAINT "bookings_accepted_at_progression" CHECK ("bookings"."status" not in ('accepted', 'en_route', 'arrived', 'in_progress', 'completed') or "bookings"."accepted_at" is not null),
	CONSTRAINT "bookings_en_route_at_progression" CHECK ("bookings"."status" not in ('en_route', 'arrived', 'in_progress', 'completed') or "bookings"."en_route_at" is not null),
	CONSTRAINT "bookings_arrived_at_progression" CHECK ("bookings"."status" not in ('arrived', 'in_progress', 'completed') or "bookings"."arrived_at" is not null),
	CONSTRAINT "bookings_work_started_at_progression" CHECK ("bookings"."status" not in ('in_progress', 'completed') or "bookings"."work_started_at" is not null),
	CONSTRAINT "bookings_completed_at_matches_status" CHECK (("bookings"."status" = 'completed') = ("bookings"."completed_at" is not null)),
	CONSTRAINT "bookings_cancellation_matches_status" CHECK (("bookings"."status" = 'cancelled') = ("bookings"."cancelled_at" is not null) and
          ("bookings"."cancelled_at" is null) = ("bookings"."cancelled_by_user_id" is null)),
	CONSTRAINT "bookings_cancellation_reason_valid" CHECK ("bookings"."cancellation_reason" is null or
          (btrim("bookings"."cancellation_reason") <> '' and char_length("bookings"."cancellation_reason") <= 500))
);
--> statement-breakpoint
ALTER TABLE "booking_provider_releases" ADD CONSTRAINT "booking_provider_releases_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_provider_releases" ADD CONSTRAINT "booking_provider_releases_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_provider_releases_booking_idx" ON "booking_provider_releases" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_provider_releases_provider_idx" ON "booking_provider_releases" USING btree ("provider_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_quotes_booking_provider_active_uidx" ON "booking_quotes" USING btree ("booking_id","provider_profile_id") WHERE "booking_quotes"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "booking_quotes_booking_accepted_uidx" ON "booking_quotes" USING btree ("booking_id") WHERE "booking_quotes"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "booking_quotes_provider_idx" ON "booking_quotes" USING btree ("provider_profile_id");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bookings_provider_idx" ON "bookings" USING btree ("provider_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bookings_open_category_city_idx" ON "bookings" USING btree ("service_category_id","city_id","created_at") WHERE "bookings"."status" = 'searching';--> statement-breakpoint
CREATE INDEX "bookings_category_idx" ON "bookings" USING btree ("service_category_id");--> statement-breakpoint
CREATE INDEX "bookings_city_idx" ON "bookings" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "bookings_cancelled_by_user_idx" ON "bookings" USING btree ("cancelled_by_user_id");
CREATE TYPE "public"."device_platform" AS ENUM('android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('booking_accepted', 'provider_en_route', 'provider_arrived', 'booking_completed', 'booking_cancelled', 'quote_created', 'quote_accepted', 'quote_rejected', 'payment_succeeded', 'payment_failed', 'payout_paid');--> statement-breakpoint
CREATE TYPE "public"."push_provider_name" AS ENUM('mock', 'fcm');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_not_blank" CHECK (btrim("device_tokens"."token") <> '')
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"booking_id" uuid,
	"payment_id" uuid,
	"payout_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_valid" CHECK (btrim("notifications"."title") <> '' and char_length("notifications"."title") <= 200),
	CONSTRAINT "notifications_body_valid" CHECK (btrim("notifications"."body") <> '' and char_length("notifications"."body") <= 1000),
	CONSTRAINT "notifications_dedupe_key_not_blank" CHECK (btrim("notifications"."dedupe_key") <> '')
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_comment_valid" CHECK ("reviews"."comment" is null or (btrim("reviews"."comment") <> '' and char_length("reviews"."comment") <= 1000)),
	CONSTRAINT "reviews_author_not_target" CHECK ("reviews"."author_user_id" <> "reviews"."target_user_id")
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payout_id_provider_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."provider_payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_uidx" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_uidx" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","created_at") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_booking_idx" ON "notifications" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "notifications_payment_idx" ON "notifications" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "notifications_payout_idx" ON "notifications" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_author_uidx" ON "reviews" USING btree ("booking_id","author_user_id");--> statement-breakpoint
CREATE INDEX "reviews_target_created_idx" ON "reviews" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");
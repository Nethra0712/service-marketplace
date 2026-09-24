CREATE TYPE "public"."payment_ledger_entry_kind" AS ENUM('created', 'succeeded', 'failed', 'cancelled', 'refunded', 'duplicate_ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_provider_name" AS ENUM('mock', 'payhere');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "payment_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" "payment_ledger_entry_kind" NOT NULL,
	"status" "payment_status" NOT NULL,
	"service_amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"gateway_fee_amount" numeric(12, 2),
	"provider_earning_amount" numeric(12, 2) NOT NULL,
	"external_reference" text NOT NULL,
	"provider_payment_id" text,
	"raw_payload" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_ledger_entries_service_amount_positive" CHECK ("payment_ledger_entries"."service_amount" > 0),
	CONSTRAINT "payment_ledger_entries_commission_amount_non_negative" CHECK ("payment_ledger_entries"."commission_amount" >= 0),
	CONSTRAINT "payment_ledger_entries_provider_earning_non_negative" CHECK ("payment_ledger_entries"."provider_earning_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" "payment_provider_name" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"service_amount" numeric(12, 2) NOT NULL,
	"commission_basis_points" integer NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"gateway_fee_amount" numeric(12, 2),
	"provider_earning_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'LKR' NOT NULL,
	"external_reference" text NOT NULL,
	"provider_payment_id" text,
	"payout_id" uuid,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_service_amount_positive" CHECK ("payments"."service_amount" > 0),
	CONSTRAINT "payments_commission_amount_non_negative" CHECK ("payments"."commission_amount" >= 0),
	CONSTRAINT "payments_commission_basis_points_range" CHECK ("payments"."commission_basis_points" between 0 and 10000),
	CONSTRAINT "payments_provider_earning_non_negative" CHECK ("payments"."provider_earning_amount" >= 0),
	CONSTRAINT "payments_gateway_fee_non_negative" CHECK ("payments"."gateway_fee_amount" is null or "payments"."gateway_fee_amount" >= 0),
	CONSTRAINT "payments_succeeded_at_matches_status" CHECK (("payments"."status" = 'succeeded') = ("payments"."succeeded_at" is not null)),
	CONSTRAINT "payments_failed_at_matches_status" CHECK (("payments"."status" = 'failed') = ("payments"."failed_at" is not null)),
	CONSTRAINT "payments_cancelled_at_matches_status" CHECK (("payments"."status" = 'cancelled') = ("payments"."cancelled_at" is not null)),
	CONSTRAINT "payments_refunded_at_matches_status" CHECK (("payments"."status" = 'refunded') = ("payments"."refunded_at" is not null)),
	CONSTRAINT "payments_payout_only_when_settled" CHECK ("payments"."payout_id" is null or "payments"."status" in ('succeeded', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "provider_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_service_amount" numeric(12, 2) NOT NULL,
	"total_commission_amount" numeric(12, 2) NOT NULL,
	"total_gateway_fee_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_provider_earning_amount" numeric(12, 2) NOT NULL,
	"payment_count" integer NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_payouts_period_valid" CHECK ("provider_payouts"."period_end" > "provider_payouts"."period_start"),
	CONSTRAINT "provider_payouts_amounts_non_negative" CHECK ("provider_payouts"."total_service_amount" >= 0 and "provider_payouts"."total_commission_amount" >= 0 and
          "provider_payouts"."total_gateway_fee_amount" >= 0 and "provider_payouts"."total_provider_earning_amount" >= 0),
	CONSTRAINT "provider_payouts_payment_count_non_negative" CHECK ("provider_payouts"."payment_count" >= 0),
	CONSTRAINT "provider_payouts_paid_at_matches_status" CHECK (("provider_payouts"."status" = 'paid') = ("provider_payouts"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "service_categories" ADD COLUMN "base_rate" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" ADD CONSTRAINT "payment_ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payout_id_provider_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."provider_payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_payouts" ADD CONSTRAINT "provider_payouts_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_ledger_entries_payment_idx" ON "payment_ledger_entries" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_external_reference_uidx" ON "payments" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payments_payout_idx" ON "payments" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_booking_active_uidx" ON "payments" USING btree ("booking_id") WHERE "payments"."status" in ('pending', 'succeeded');--> statement-breakpoint
CREATE INDEX "provider_payouts_provider_idx" ON "provider_payouts" USING btree ("provider_profile_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_payouts_provider_period_uidx" ON "provider_payouts" USING btree ("provider_profile_id","period_start","period_end");--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_base_rate_positive" CHECK ("service_categories"."base_rate" is null or "service_categories"."base_rate" > 0);--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_base_rate_matches_pricing_model" CHECK (("service_categories"."pricing_model" = 'quote') = ("service_categories"."base_rate" is null));
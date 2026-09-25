ALTER TABLE "admin_users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_failed_login_attempts_non_negative" CHECK ("admin_users"."failed_login_attempts" >= 0);
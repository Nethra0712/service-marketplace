CREATE TYPE "public"."session_revoke_reason" AS ENUM('logout', 'refresh_token_reuse');--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" "session_revoke_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_revocation_consistent" CHECK (("auth_sessions"."revoked_at" is null) = ("auth_sessions"."revoked_reason" is null)),
	CONSTRAINT "auth_sessions_expiry_after_creation" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_challenges_phone_e164_format" CHECK ("otp_challenges"."phone_e164" ~ '^[+][1-9][0-9]{6,14}$'),
	CONSTRAINT "otp_challenges_code_hash_format" CHECK ("otp_challenges"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "otp_challenges_attempts_non_negative" CHECK ("otp_challenges"."attempts" >= 0),
	CONSTRAINT "otp_challenges_expiry_after_creation" CHECK ("otp_challenges"."expires_at" > "otp_challenges"."created_at")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_format" CHECK ("refresh_tokens"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "refresh_tokens_expiry_after_creation" CHECK ("refresh_tokens"."expires_at" > "refresh_tokens"."created_at")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_created_idx" ON "otp_challenges" USING btree ("phone_e164","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_uidx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");
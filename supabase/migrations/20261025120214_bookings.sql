CREATE TYPE "public"."booking_source" AS ENUM('dashboard', 'customer');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_events_kind" CHECK ("booking_events"."kind" in ('created', 'rescheduled', 'cancelled', 'completed', 'no_show'))
);
--> statement-breakpoint
ALTER TABLE "booking_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid,
	"staff_id" uuid,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"staff_name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"buffer_minutes" integer NOT NULL,
	"price_cents" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"occupied_until" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" "booking_source" NOT NULL,
	"manage_token_hash" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_manageTokenHash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "bookings_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "bookings_time_order" CHECK ("bookings"."starts_at" < "bookings"."ends_at" and "bookings"."ends_at" <= "bookings"."occupied_until"),
	CONSTRAINT "bookings_duration_range" CHECK ("bookings"."duration_minutes" between 5 and 720 and "bookings"."buffer_minutes" between 0 and 240),
	CONSTRAINT "bookings_price_positive" CHECK ("bookings"."price_cents" >= 0),
	CONSTRAINT "bookings_notes_length" CHECK (char_length("bookings"."notes") <= 500)
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "customers_workspace_email_unique" UNIQUE("workspace_id","email"),
	CONSTRAINT "customers_name_length" CHECK (char_length("customers"."name") between 1 and 120),
	CONSTRAINT "customers_email_format" CHECK ("customers"."email" = lower("customers"."email") and char_length("customers"."email") between 3 and 254),
	CONSTRAINT "customers_phone_length" CHECK (char_length("customers"."phone") <= 40)
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"booking_id" uuid,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_log_status" CHECK ("email_log"."status" in ('sent', 'failed', 'not_sent'))
);
--> statement-breakpoint
ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "slot_step_minutes" smallint DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "min_notice_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "max_days_ahead" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "cancellation_window_hours" smallint DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "calendar_token" text DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_workspace_starts_idx" ON "bookings" USING btree ("workspace_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_staff_starts_idx" ON "bookings" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "email_log_workspace_created_idx" ON "email_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "email_log_booking_idx" ON "email_log" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_calendarToken_unique" UNIQUE("calendar_token");--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_booking_rules" CHECK ("workspaces"."slot_step_minutes" in (5, 10, 15, 20, 30, 60) and "workspaces"."min_notice_minutes" between 0 and 10080 and "workspaces"."max_days_ahead" between 1 and 365 and "workspaces"."cancellation_window_hours" between 0 and 168);--> statement-breakpoint
CREATE POLICY "booking_events_select_members" ON "booking_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("booking_events"."workspace_id"));--> statement-breakpoint
CREATE POLICY "booking_events_insert_members" ON "booking_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.is_member("booking_events"."workspace_id"));--> statement-breakpoint
CREATE POLICY "bookings_select_members" ON "bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("bookings"."workspace_id"));--> statement-breakpoint
CREATE POLICY "bookings_insert_members" ON "bookings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.is_member("bookings"."workspace_id"));--> statement-breakpoint
CREATE POLICY "bookings_update_members" ON "bookings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.is_member("bookings"."workspace_id")) WITH CHECK (private.is_member("bookings"."workspace_id"));--> statement-breakpoint
CREATE POLICY "customers_select_members" ON "customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("customers"."workspace_id"));--> statement-breakpoint
CREATE POLICY "customers_insert_members" ON "customers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.is_member("customers"."workspace_id"));--> statement-breakpoint
CREATE POLICY "customers_update_members" ON "customers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.is_member("customers"."workspace_id")) WITH CHECK (private.is_member("customers"."workspace_id"));--> statement-breakpoint
CREATE POLICY "customers_delete_managers" ON "customers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("customers"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "email_log_select_members" ON "email_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("email_log"."workspace_id"));
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "staff_name_length" CHECK (char_length("staff"."name") between 2 and 80),
	CONSTRAINT "staff_title_length" CHECK (char_length("staff"."title") <= 60),
	CONSTRAINT "staff_bio_length" CHECK (char_length("staff"."bio") <= 600)
);
--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "staff_hours_weekday" CHECK ("staff_hours"."weekday" between 1 and 7),
	CONSTRAINT "staff_hours_range" CHECK ("staff_hours"."start_minute" between 0 and 1439 and "staff_hours"."end_minute" between 1 and 1440 and "staff_hours"."start_minute" < "staff_hours"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "staff_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_services" (
	"workspace_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_services_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "staff_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_time_off_order" CHECK ("staff_time_off"."ends_at" > "staff_time_off"."starts_at"),
	CONSTRAINT "staff_time_off_note_length" CHECK (char_length("staff_time_off"."note") <= 120)
);
--> statement-breakpoint
ALTER TABLE "staff_time_off" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_hours" ADD CONSTRAINT "staff_hours_staff_fk" FOREIGN KEY ("staff_id","workspace_id") REFERENCES "public"."staff"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_fk" FOREIGN KEY ("staff_id","workspace_id") REFERENCES "public"."staff"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_fk" FOREIGN KEY ("service_id","workspace_id") REFERENCES "public"."services"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_staff_fk" FOREIGN KEY ("staff_id","workspace_id") REFERENCES "public"."staff"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_workspace_user_unique" ON "staff" USING btree ("workspace_id","user_id") WHERE user_id is not null;--> statement-breakpoint
CREATE INDEX "staff_services_service_idx" ON "staff_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "staff_time_off_staff_starts_idx" ON "staff_time_off" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE POLICY "staff_select_members" ON "staff" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("staff"."workspace_id"));--> statement-breakpoint
CREATE POLICY "staff_insert_managers" ON "staff" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("staff"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_delete_managers" ON "staff" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("staff"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_update_managers" ON "staff" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("staff"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("staff"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_hours_select_members" ON "staff_hours" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("staff_hours"."workspace_id"));--> statement-breakpoint
CREATE POLICY "staff_hours_insert_managers" ON "staff_hours" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("staff_hours"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_hours_delete_managers" ON "staff_hours" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("staff_hours"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_services_select_members" ON "staff_services" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("staff_services"."workspace_id"));--> statement-breakpoint
CREATE POLICY "staff_services_insert_managers" ON "staff_services" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("staff_services"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_services_delete_managers" ON "staff_services" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("staff_services"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_time_off_select_members" ON "staff_time_off" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("staff_time_off"."workspace_id"));--> statement-breakpoint
CREATE POLICY "staff_time_off_insert_managers" ON "staff_time_off" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("staff_time_off"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "staff_time_off_delete_managers" ON "staff_time_off" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("staff_time_off"."workspace_id", array['owner','admin']));
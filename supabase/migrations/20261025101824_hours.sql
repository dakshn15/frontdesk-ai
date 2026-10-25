CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "business_hours_weekday" CHECK ("business_hours"."weekday" between 1 and 7),
	CONSTRAINT "business_hours_range" CHECK ("business_hours"."start_minute" between 0 and 1439 and "business_hours"."end_minute" between 1 and 1440 and "business_hours"."start_minute" < "business_hours"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "business_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "closed_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closed_days_workspace_date_unique" UNIQUE("workspace_id","date"),
	CONSTRAINT "closed_days_name_length" CHECK (char_length("closed_days"."name") <= 60)
);
--> statement-breakpoint
ALTER TABLE "closed_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closed_days" ADD CONSTRAINT "closed_days_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "business_hours_select_members" ON "business_hours" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("business_hours"."workspace_id"));--> statement-breakpoint
CREATE POLICY "business_hours_insert_managers" ON "business_hours" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("business_hours"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "business_hours_delete_managers" ON "business_hours" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("business_hours"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "closed_days_select_members" ON "closed_days" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("closed_days"."workspace_id"));--> statement-breakpoint
CREATE POLICY "closed_days_insert_managers" ON "closed_days" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("closed_days"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "closed_days_delete_managers" ON "closed_days" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("closed_days"."workspace_id", array['owner','admin']));
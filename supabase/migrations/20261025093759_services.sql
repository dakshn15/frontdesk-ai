CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"price_cents" integer,
	"price_is_from" boolean DEFAULT false NOT NULL,
	"bookable_online" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "services_name_length" CHECK (char_length("services"."name") between 2 and 80),
	CONSTRAINT "services_description_length" CHECK (char_length("services"."description") <= 1000),
	CONSTRAINT "services_category_length" CHECK (char_length("services"."category") <= 40),
	CONSTRAINT "services_duration_range" CHECK ("services"."duration_minutes" between 5 and 720 and "services"."duration_minutes" % 5 = 0),
	CONSTRAINT "services_buffer_range" CHECK ("services"."buffer_minutes" between 0 and 240 and "services"."buffer_minutes" % 5 = 0),
	CONSTRAINT "services_price_positive" CHECK ("services"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "services_workspace_name_unique" ON "services" USING btree ("workspace_id",lower(name));--> statement-breakpoint
CREATE POLICY "services_select_members" ON "services" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("services"."workspace_id"));--> statement-breakpoint
CREATE POLICY "services_insert_managers" ON "services" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("services"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "services_update_managers" ON "services" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("services"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("services"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "services_delete_managers" ON "services" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("services"."workspace_id", array['owner','admin']));
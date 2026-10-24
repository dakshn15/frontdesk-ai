CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'staff');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_name_length" CHECK (char_length("workspaces"."name") between 2 and 80),
	CONSTRAINT "workspaces_slug_format" CHECK ("workspaces"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("workspaces"."slug") between 3 and 48),
	CONSTRAINT "workspaces_currency_format" CHECK ("workspaces"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_workspace_user_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_created_idx" ON "audit_log" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "profiles_select_self_or_teammates" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()) or private.shares_workspace("profiles"."id"));--> statement-breakpoint
CREATE POLICY "profiles_update_self" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "workspaces_select_members" ON "workspaces" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("workspaces"."id"));--> statement-breakpoint
CREATE POLICY "workspaces_update_managers" ON "workspaces" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("workspaces"."id", array['owner','admin'])) WITH CHECK (private.has_role("workspaces"."id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "workspaces_delete_owners" ON "workspaces" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("workspaces"."id", array['owner']));--> statement-breakpoint
CREATE POLICY "memberships_select_members" ON "memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("memberships"."workspace_id"));--> statement-breakpoint
CREATE POLICY "memberships_update_managers" ON "memberships" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("memberships"."workspace_id", array['owner']) or (private.has_role("memberships"."workspace_id", array['admin']) and "memberships"."role" <> 'owner')) WITH CHECK ("memberships"."role" <> 'owner' or private.has_role("memberships"."workspace_id", array['owner']));--> statement-breakpoint
CREATE POLICY "memberships_delete_self_or_managers" ON "memberships" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("memberships"."user_id" = (select auth.uid()) or private.has_role("memberships"."workspace_id", array['owner']) or (private.has_role("memberships"."workspace_id", array['admin']) and "memberships"."role" <> 'owner'));--> statement-breakpoint
CREATE POLICY "audit_log_select_managers" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_role("audit_log"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "audit_log_insert_members" ON "audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.is_member("audit_log"."workspace_id") and "audit_log"."actor_id" = (select auth.uid()));
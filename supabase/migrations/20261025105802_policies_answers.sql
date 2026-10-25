CREATE TYPE "public"."policy_kind" AS ENUM('cancellation', 'late_arrival', 'payment', 'parking', 'accessibility', 'custom');--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "policy_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policies_title_length" CHECK (char_length("policies"."title") between 1 and 60),
	CONSTRAINT "policies_body_length" CHECK (char_length("policies"."body") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verified_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verified_answers_question_length" CHECK (char_length("verified_answers"."question") between 5 and 300),
	CONSTRAINT "verified_answers_answer_length" CHECK (char_length("verified_answers"."answer") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "verified_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_answers" ADD CONSTRAINT "verified_answers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_answers" ADD CONSTRAINT "verified_answers_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_answers" ADD CONSTRAINT "verified_answers_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policies_workspace_kind_unique" ON "policies" USING btree ("workspace_id","kind") WHERE kind <> 'custom';--> statement-breakpoint
CREATE UNIQUE INDEX "verified_answers_workspace_question_unique" ON "verified_answers" USING btree ("workspace_id",lower(question));--> statement-breakpoint
CREATE POLICY "policies_select_members" ON "policies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("policies"."workspace_id"));--> statement-breakpoint
CREATE POLICY "policies_insert_managers" ON "policies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("policies"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "policies_delete_managers" ON "policies" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("policies"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "policies_update_managers" ON "policies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("policies"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("policies"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "verified_answers_select_members" ON "verified_answers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("verified_answers"."workspace_id"));--> statement-breakpoint
CREATE POLICY "verified_answers_insert_managers" ON "verified_answers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("verified_answers"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "verified_answers_delete_managers" ON "verified_answers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("verified_answers"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "verified_answers_update_managers" ON "verified_answers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("verified_answers"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("verified_answers"."workspace_id", array['owner','admin']));
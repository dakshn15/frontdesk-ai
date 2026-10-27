ALTER TYPE "public"."conversation_channel" ADD VALUE 'test';--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"question" text NOT NULL,
	"checks" jsonb NOT NULL,
	"must_pass" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_cases_question_length" CHECK (char_length("test_cases"."question") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "test_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"test_case_id" uuid,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"passed" boolean NOT NULL,
	"failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grader_note" text,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"started_by" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "test_runs_status" CHECK ("test_runs"."status" in ('running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "test_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_started_by_profiles_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_cases_workspace_idx" ON "test_cases" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "test_results_run_idx" ON "test_results" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "test_runs_workspace_started_idx" ON "test_runs" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE POLICY "test_cases_select_members" ON "test_cases" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("test_cases"."workspace_id"));--> statement-breakpoint
CREATE POLICY "test_cases_insert_managers" ON "test_cases" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("test_cases"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "test_cases_delete_managers" ON "test_cases" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("test_cases"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "test_cases_update_managers" ON "test_cases" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("test_cases"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("test_cases"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "test_results_select_members" ON "test_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("test_results"."workspace_id"));--> statement-breakpoint
CREATE POLICY "test_runs_select_members" ON "test_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("test_runs"."workspace_id"));
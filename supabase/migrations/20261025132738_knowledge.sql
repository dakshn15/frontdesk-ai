-- pgvector stores embeddings; the table below needs it.
create extension if not exists vector with schema extensions;--> statement-breakpoint
CREATE TYPE "public"."knowledge_kind" AS ENUM('file', 'url', 'sitemap', 'text');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"heading" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"page_url" text,
	"embedding" vector(1536),
	"fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', heading || ' ' || content)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"file_name" text,
	"content" text,
	"status" "knowledge_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "knowledge_sources_title_length" CHECK (char_length("knowledge_sources"."title") between 1 and 200),
	CONSTRAINT "knowledge_sources_content_length" CHECK (char_length("knowledge_sources"."content") <= 500000)
);
--> statement-breakpoint
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_fk" FOREIGN KEY ("source_id","workspace_id") REFERENCES "public"."knowledge_sources"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_id","position");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_workspace_idx" ON "knowledge_chunks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_fts_idx" ON "knowledge_chunks" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "knowledge_sources_workspace_idx" ON "knowledge_sources" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE POLICY "knowledge_chunks_select_members" ON "knowledge_chunks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("knowledge_chunks"."workspace_id"));--> statement-breakpoint
CREATE POLICY "knowledge_sources_select_members" ON "knowledge_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_member("knowledge_sources"."workspace_id"));--> statement-breakpoint
CREATE POLICY "knowledge_sources_insert_managers" ON "knowledge_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_role("knowledge_sources"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "knowledge_sources_update_managers" ON "knowledge_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_role("knowledge_sources"."workspace_id", array['owner','admin'])) WITH CHECK (private.has_role("knowledge_sources"."workspace_id", array['owner','admin']));--> statement-breakpoint
CREATE POLICY "knowledge_sources_delete_managers" ON "knowledge_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_role("knowledge_sources"."workspace_id", array['owner','admin']));
ALTER TABLE "conversations" ADD COLUMN "handoff_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "conversations_update_members" ON "conversations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.is_member("conversations"."workspace_id")) WITH CHECK (private.is_member("conversations"."workspace_id"));--> statement-breakpoint
CREATE POLICY "messages_insert_staff" ON "messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.is_member("messages"."workspace_id") and "messages"."role" = 'staff' and "messages"."author_id" = auth.uid());
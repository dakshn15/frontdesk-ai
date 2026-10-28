ALTER TABLE "bookings" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "tagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
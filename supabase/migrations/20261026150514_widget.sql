ALTER TYPE "public"."booking_source" ADD VALUE 'widget';--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_color" text DEFAULT '#0f766e' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_greeting" text DEFAULT 'Hi, how can I help? Ask a question or book an appointment.' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_suggestions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "widget_position" text DEFAULT 'right' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_widget_settings" CHECK ("workspaces"."widget_color" ~ '^#[0-9a-f]{6}$' and char_length("workspaces"."widget_greeting") between 1 and 300 and cardinality("workspaces"."widget_suggestions") <= 4 and "workspaces"."widget_position" in ('right', 'left') and cardinality("workspaces"."allowed_domains") <= 10);
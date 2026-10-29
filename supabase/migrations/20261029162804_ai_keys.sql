CREATE TABLE "workspace_ai_keys" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"openai_key" text,
	"google_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_ai_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_ai_keys" ADD CONSTRAINT "workspace_ai_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { updatedAt } from "./columns";
import { workspaces } from "./workspaces";

// The workspace's own AI provider keys, encrypted with AI_KEYS_SECRET. Server only: no
// policies, and the grants are revoked, so no browser session can read them.
export const workspaceAiKeys = pgTable("workspace_ai_keys", {
  workspaceId: uuid()
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  openaiKey: text(),
  googleKey: text(),
  updatedAt: updatedAt(),
}).enableRLS();

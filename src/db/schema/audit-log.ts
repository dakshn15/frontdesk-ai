import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { createdAt } from "./columns";
import { profiles } from "./profiles";
import { workspaces } from "./workspaces";

// Append-only: there are no update or delete policies.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    actorId: uuid().references(() => profiles.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetType: text(),
    targetId: uuid(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    pgPolicy("audit_log_select_managers", {
      for: "select",
      to: authenticatedRole,
      using: sql`private.has_role(${t.workspaceId}, array['owner','admin'])`,
    }),
    pgPolicy("audit_log_insert_members", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`private.is_member(${t.workspaceId}) and ${t.actorId} = ${authUid}`,
    }),
  ],
);

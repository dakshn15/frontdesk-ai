import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { createdAt } from "./columns";
import { workspaceRole } from "./enums";
import { profiles } from "./profiles";
import { workspaces } from "./workspaces";

// No insert policy: members are added only by private.create_workspace and
// private.accept_invitation. A trigger keeps at least one owner per workspace.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: workspaceRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("memberships_workspace_user_unique").on(t.workspaceId, t.userId),
    index("memberships_user_id_idx").on(t.userId),
    pgPolicy("memberships_select_members", {
      for: "select",
      to: authenticatedRole,
      using: sql`private.is_member(${t.workspaceId})`,
    }),
    // Owners change anyone; admins change everyone except owners, and can't make owners.
    pgPolicy("memberships_update_managers", {
      for: "update",
      to: authenticatedRole,
      using: sql`private.has_role(${t.workspaceId}, array['owner']) or (private.has_role(${t.workspaceId}, array['admin']) and ${t.role} <> 'owner')`,
      withCheck: sql`${t.role} <> 'owner' or private.has_role(${t.workspaceId}, array['owner'])`,
    }),
    // Anyone can leave; owners remove anyone; admins remove everyone except owners.
    pgPolicy("memberships_delete_self_or_managers", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid} or private.has_role(${t.workspaceId}, array['owner']) or (private.has_role(${t.workspaceId}, array['admin']) and ${t.role} <> 'owner')`,
    }),
  ],
);

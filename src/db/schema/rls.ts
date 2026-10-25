import { type SQL, sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// Shared row-level-security rules for workspace-owned business data: any member can read,
// only owners and admins can write. Not exported from the schema index.

export const isMember = (workspaceId: unknown): SQL =>
  sql`private.is_member(${workspaceId})`;

export const isManager = (workspaceId: unknown): SQL =>
  sql`private.has_role(${workspaceId}, array['owner','admin'])`;

/** Read for members; insert, update and delete for managers. */
export function businessDataPolicies(
  table: string,
  workspaceId: unknown,
  opts: { update?: boolean } = {},
) {
  const policies = [
    pgPolicy(`${table}_select_members`, {
      for: "select",
      to: authenticatedRole,
      using: isMember(workspaceId),
    }),
    pgPolicy(`${table}_insert_managers`, {
      for: "insert",
      to: authenticatedRole,
      withCheck: isManager(workspaceId),
    }),
    pgPolicy(`${table}_delete_managers`, {
      for: "delete",
      to: authenticatedRole,
      using: isManager(workspaceId),
    }),
  ];
  if (opts.update !== false) {
    policies.push(
      pgPolicy(`${table}_update_managers`, {
        for: "update",
        to: authenticatedRole,
        using: isManager(workspaceId),
        withCheck: isManager(workspaceId),
      }),
    );
  }
  return policies;
}

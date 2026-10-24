import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { createdAt } from "./columns";
import { workspaceRole } from "./enums";
import { profiles } from "./profiles";
import { workspaces } from "./workspaces";

// Only the SHA-256 hash of the invite token is stored. Accepting goes through
// private.accept_invitation, because the invitee isn't a member yet.
export const invitations = pgTable(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: workspaceRole().notNull(),
    tokenHash: text().notNull().unique(),
    invitedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("invitations_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check("invitations_role_not_owner", sql`${t.role} <> 'owner'`),
    uniqueIndex("invitations_one_pending_per_email")
      .on(t.workspaceId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    pgPolicy("invitations_select_managers", {
      for: "select",
      to: authenticatedRole,
      using: sql`private.has_role(${t.workspaceId}, array['owner','admin'])`,
    }),
    pgPolicy("invitations_insert_managers", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`private.has_role(${t.workspaceId}, array['owner','admin']) and ${t.invitedBy} = ${authUid}`,
    }),
    pgPolicy("invitations_update_managers", {
      for: "update",
      to: authenticatedRole,
      using: sql`private.has_role(${t.workspaceId}, array['owner','admin'])`,
      withCheck: sql`private.has_role(${t.workspaceId}, array['owner','admin'])`,
    }),
  ],
);

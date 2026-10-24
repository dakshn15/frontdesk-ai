import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";

// One row per auth user, created by a trigger on auth.users (see core_functions migration).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text().notNull(),
    fullName: text().notNull().default(""),
    avatarUrl: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    pgPolicy("profiles_select_self_or_teammates", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid} or private.shares_workspace(${t.id})`,
    }),
    pgPolicy("profiles_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

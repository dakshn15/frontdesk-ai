import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { workspaces } from "./workspaces";

const managers = (workspaceId: unknown) =>
  sql`private.has_role(${workspaceId}, array['owner','admin'])`;

// What customers can book. Prices are minor units in the workspace currency; null means
// no price is listed, so the receptionist won't quote one.
export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull().default(""),
    category: text().notNull().default(""),
    durationMinutes: integer().notNull(),
    bufferMinutes: integer().notNull().default(0),
    priceCents: integer(),
    priceIsFrom: boolean().notNull().default(false),
    bookableOnline: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Lets child rows point at (id, workspace_id), so links can't cross workspaces.
    unique("services_id_workspace_unique").on(t.id, t.workspaceId),
    uniqueIndex("services_workspace_name_unique").on(
      t.workspaceId,
      sql`lower(name)`,
    ),
    check("services_name_length", sql`char_length(${t.name}) between 2 and 80`),
    check(
      "services_description_length",
      sql`char_length(${t.description}) <= 1000`,
    ),
    check("services_category_length", sql`char_length(${t.category}) <= 40`),
    check(
      "services_duration_range",
      sql`${t.durationMinutes} between 5 and 720 and ${t.durationMinutes} % 5 = 0`,
    ),
    check(
      "services_buffer_range",
      sql`${t.bufferMinutes} between 0 and 240 and ${t.bufferMinutes} % 5 = 0`,
    ),
    check("services_price_positive", sql`${t.priceCents} >= 0`),
    pgPolicy("services_select_members", {
      for: "select",
      to: authenticatedRole,
      using: sql`private.is_member(${t.workspaceId})`,
    }),
    pgPolicy("services_insert_managers", {
      for: "insert",
      to: authenticatedRole,
      withCheck: managers(t.workspaceId),
    }),
    pgPolicy("services_update_managers", {
      for: "update",
      to: authenticatedRole,
      using: managers(t.workspaceId),
      withCheck: managers(t.workspaceId),
    }),
    pgPolicy("services_delete_managers", {
      for: "delete",
      to: authenticatedRole,
      using: managers(t.workspaceId),
    }),
  ],
);

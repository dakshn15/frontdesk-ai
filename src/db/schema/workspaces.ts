import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgPolicy,
  pgTable,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { profiles } from "./profiles";

// Created only through private.create_workspace, which also makes the caller its owner.
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    website: text(),
    timezone: text().notNull(),
    currency: text().notNull(),
    // Booking rules: the gap between offered start times, how soon and how far ahead
    // customers can book, and how close to the start they can still change a booking.
    slotStepMinutes: smallint().notNull().default(15),
    minNoticeMinutes: integer().notNull().default(120),
    maxDaysAhead: smallint().notNull().default(60),
    cancellationWindowHours: smallint().notNull().default(24),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "workspaces_name_length",
      sql`char_length(${t.name}) between 2 and 80`,
    ),
    check(
      "workspaces_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) between 3 and 48`,
    ),
    check("workspaces_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      "workspaces_booking_rules",
      sql`${t.slotStepMinutes} in (5, 10, 15, 20, 30, 60) and ${t.minNoticeMinutes} between 0 and 10080 and ${t.maxDaysAhead} between 1 and 365 and ${t.cancellationWindowHours} between 0 and 168`,
    ),
    pgPolicy("workspaces_select_members", {
      for: "select",
      to: authenticatedRole,
      using: sql`private.is_member(${t.id})`,
    }),
    pgPolicy("workspaces_update_managers", {
      for: "update",
      to: authenticatedRole,
      using: sql`private.has_role(${t.id}, array['owner','admin'])`,
      withCheck: sql`private.has_role(${t.id}, array['owner','admin'])`,
    }),
    pgPolicy("workspaces_delete_owners", {
      for: "delete",
      to: authenticatedRole,
      using: sql`private.has_role(${t.id}, array['owner'])`,
    }),
  ],
);

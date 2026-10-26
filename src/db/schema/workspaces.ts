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
import { aiProvider } from "./enums";
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
    // The receptionist: its name in the chat and which AI provider answers first.
    assistantName: text().notNull().default("Assistant"),
    aiProvider: aiProvider().notNull().default("openai"),
    // The website chat: its colour, greeting, suggested questions and corner, and the
    // sites it may load on (an empty list means any site).
    widgetColor: text().notNull().default("#0f766e"),
    widgetGreeting: text()
      .notNull()
      .default("Hi, how can I help? Ask a question or book an appointment."),
    widgetSuggestions: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    widgetPosition: text().notNull().default("right"),
    allowedDomains: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    check(
      "workspaces_assistant_name_length",
      sql`char_length(${t.assistantName}) between 1 and 40`,
    ),
    check(
      "workspaces_widget_settings",
      sql`${t.widgetColor} ~ '^#[0-9a-f]{6}$' and char_length(${t.widgetGreeting}) between 1 and 300 and cardinality(${t.widgetSuggestions}) <= 4 and ${t.widgetPosition} in ('right', 'left') and cardinality(${t.allowedDomains}) <= 10`,
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

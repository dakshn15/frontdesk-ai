import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { conversations } from "./conversations";
import { bookingSource, bookingStatus } from "./enums";
import { profiles } from "./profiles";
import { isManager, isMember } from "./rls";
import { workspaces } from "./workspaces";

const memberPolicies = (
  table: string,
  workspaceId: unknown,
  actions: ("select" | "insert" | "update")[],
) =>
  actions.map((action) =>
    pgPolicy(`${table}_${action}_members`, {
      for: action,
      to: authenticatedRole,
      ...(action === "insert"
        ? { withCheck: isMember(workspaceId) }
        : action === "update"
          ? { using: isMember(workspaceId), withCheck: isMember(workspaceId) }
          : { using: isMember(workspaceId) }),
    }),
  );

// People who have booked. Emails are stored lower-case, one customer per email per workspace.
export const customers = pgTable(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: text().notNull(),
    phone: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("customers_id_workspace_unique").on(t.id, t.workspaceId),
    unique("customers_workspace_email_unique").on(t.workspaceId, t.email),
    check(
      "customers_name_length",
      sql`char_length(${t.name}) between 1 and 120`,
    ),
    check(
      "customers_email_format",
      sql`${t.email} = lower(${t.email}) and char_length(${t.email}) between 3 and 254`,
    ),
    check("customers_phone_length", sql`char_length(${t.phone}) <= 40`),
    ...memberPolicies("customers", t.workspaceId, [
      "select",
      "insert",
      "update",
    ]),
    pgPolicy("customers_delete_managers", {
      for: "delete",
      to: authenticatedRole,
      using: isManager(t.workspaceId),
    }),
  ],
);

// Appointments. They copy the service and staff details at booking time so later edits don't
// rewrite history. The bookings_rules migration adds the links to staff, services and customers
// (each clears only its own column on delete) and the exclusion constraint that makes
// overlapping confirmed bookings for one person impossible.
export const bookings = pgTable(
  "bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid(),
    staffId: uuid(),
    serviceId: uuid(),
    serviceName: text().notNull(),
    staffName: text().notNull(),
    durationMinutes: integer().notNull(),
    bufferMinutes: integer().notNull(),
    priceCents: integer(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    // endsAt plus the buffer: the time this booking keeps the person busy.
    occupiedUntil: timestamp({ withTimezone: true }).notNull(),
    status: bookingStatus().notNull().default("confirmed"),
    notes: text().notNull().default(""),
    source: bookingSource().notNull(),
    // The customer's manage link carries the token; only its hash is stored.
    manageTokenHash: text().notNull().unique(),
    // The website chat it was booked from, if any.
    conversationId: uuid().references(() => conversations.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp({ withTimezone: true }),
    // Set when the day-before reminder goes out; cleared when the booking moves.
    reminderSentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("bookings_id_workspace_unique").on(t.id, t.workspaceId),
    check(
      "bookings_time_order",
      sql`${t.startsAt} < ${t.endsAt} and ${t.endsAt} <= ${t.occupiedUntil}`,
    ),
    check(
      "bookings_duration_range",
      sql`${t.durationMinutes} between 5 and 720 and ${t.bufferMinutes} between 0 and 240`,
    ),
    check("bookings_price_positive", sql`${t.priceCents} >= 0`),
    check("bookings_notes_length", sql`char_length(${t.notes}) <= 500`),
    index("bookings_workspace_starts_idx").on(t.workspaceId, t.startsAt),
    index("bookings_staff_starts_idx").on(t.staffId, t.startsAt),
    ...memberPolicies("bookings", t.workspaceId, [
      "select",
      "insert",
      "update",
    ]),
  ],
);

// What happened to each booking, append-only. actor_id is null for the customer.
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    bookingId: uuid().notNull(),
    kind: text().notNull(),
    actorId: uuid().references(() => profiles.id, { onDelete: "set null" }),
    details: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "booking_events_kind",
      sql`${t.kind} in ('created', 'rescheduled', 'cancelled', 'completed', 'no_show')`,
    ),
    index("booking_events_booking_idx").on(t.bookingId),
    ...memberPolicies("booking_events", t.workspaceId, ["select", "insert"]),
  ],
);

// Every email the app sends or would send. Members can read it; only the privileged mailer
// writes it. Later it doubles as the outbox demo sandboxes show instead of sending.
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bookingId: uuid().references(() => bookings.id, { onDelete: "set null" }),
    kind: text().notNull(),
    toEmail: text().notNull(),
    subject: text().notNull(),
    html: text().notNull(),
    text: text().notNull(),
    status: text().notNull(),
    providerId: text(),
    error: text(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "email_log_status",
      sql`${t.status} in ('sent', 'failed', 'not_sent')`,
    ),
    index("email_log_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("email_log_booking_idx").on(t.bookingId),
    ...memberPolicies("email_log", t.workspaceId, ["select"]),
  ],
);

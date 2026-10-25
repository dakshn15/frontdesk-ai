import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";
import { businessDataPolicies } from "./rls";
import { services } from "./services";
import { workspaces } from "./workspaces";

// The people customers can book. `user_id` optionally links a team member's login; its
// foreign key to memberships (workspace_id, user_id) lives in the staff_rules migration,
// because it clears only user_id when the member leaves.
export const staff = pgTable(
  "staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    title: text().notNull().default(""),
    bio: text().notNull().default(""),
    userId: uuid(),
    active: boolean().notNull().default(true),
    // The secret in this person's calendar feed URL. Resetting it breaks the old URL.
    calendarToken: text()
      .notNull()
      .unique()
      .default(
        sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`,
      ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("staff_id_workspace_unique").on(t.id, t.workspaceId),
    uniqueIndex("staff_workspace_user_unique")
      .on(t.workspaceId, t.userId)
      .where(sql`user_id is not null`),
    check("staff_name_length", sql`char_length(${t.name}) between 2 and 80`),
    check("staff_title_length", sql`char_length(${t.title}) <= 60`),
    check("staff_bio_length", sql`char_length(${t.bio}) <= 600`),
    ...businessDataPolicies("staff", t.workspaceId),
  ],
);

// Which services each person performs. Both links include workspace_id, so they can only
// point at staff and services in the same workspace.
export const staffServices = pgTable(
  "staff_services",
  {
    workspaceId: uuid().notNull(),
    staffId: uuid().notNull(),
    serviceId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.serviceId] }),
    foreignKey({
      name: "staff_services_staff_fk",
      columns: [t.staffId, t.workspaceId],
      foreignColumns: [staff.id, staff.workspaceId],
    }).onDelete("cascade"),
    foreignKey({
      name: "staff_services_service_fk",
      columns: [t.serviceId, t.workspaceId],
      foreignColumns: [services.id, services.workspaceId],
    }).onDelete("cascade"),
    index("staff_services_service_idx").on(t.serviceId),
    ...businessDataPolicies("staff_services", t.workspaceId, { update: false }),
  ],
);

// Weekly working hours, one row per time range, in minutes since local midnight. The
// staff_rules migration adds an exclusion constraint so ranges on one day can't overlap.
export const staffHours = pgTable(
  "staff_hours",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    staffId: uuid().notNull(),
    weekday: smallint().notNull(),
    startMinute: smallint().notNull(),
    endMinute: smallint().notNull(),
  },
  (t) => [
    foreignKey({
      name: "staff_hours_staff_fk",
      columns: [t.staffId, t.workspaceId],
      foreignColumns: [staff.id, staff.workspaceId],
    }).onDelete("cascade"),
    check("staff_hours_weekday", sql`${t.weekday} between 1 and 7`),
    check(
      "staff_hours_range",
      sql`${t.startMinute} between 0 and 1439 and ${t.endMinute} between 1 and 1440 and ${t.startMinute} < ${t.endMinute}`,
    ),
    ...businessDataPolicies("staff_hours", t.workspaceId, { update: false }),
  ],
);

export const staffTimeOff = pgTable(
  "staff_time_off",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    staffId: uuid().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    note: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "staff_time_off_staff_fk",
      columns: [t.staffId, t.workspaceId],
      foreignColumns: [staff.id, staff.workspaceId],
    }).onDelete("cascade"),
    check("staff_time_off_order", sql`${t.endsAt} > ${t.startsAt}`),
    check("staff_time_off_note_length", sql`char_length(${t.note}) <= 120`),
    index("staff_time_off_staff_starts_idx").on(t.staffId, t.startsAt),
    ...businessDataPolicies("staff_time_off", t.workspaceId, { update: false }),
  ],
);

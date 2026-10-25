import { sql } from "drizzle-orm";
import {
  check,
  date,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { businessDataPolicies } from "./rls";
import { workspaces } from "./workspaces";

// When customers can visit, one row per time range, in minutes since local midnight. The
// hours_rules migration adds an exclusion constraint so ranges on one day can't overlap.
export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(),
    startMinute: smallint().notNull(),
    endMinute: smallint().notNull(),
  },
  (t) => [
    check("business_hours_weekday", sql`${t.weekday} between 1 and 7`),
    check(
      "business_hours_range",
      sql`${t.startMinute} between 0 and 1439 and ${t.endMinute} between 1 and 1440 and ${t.startMinute} < ${t.endMinute}`,
    ),
    ...businessDataPolicies("business_hours", t.workspaceId, { update: false }),
  ],
);

// Whole days the business is closed (holidays), as local dates.
export const closedDays = pgTable(
  "closed_days",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    date: date().notNull(),
    name: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    unique("closed_days_workspace_date_unique").on(t.workspaceId, t.date),
    check("closed_days_name_length", sql`char_length(${t.name}) <= 60`),
    ...businessDataPolicies("closed_days", t.workspaceId, { update: false }),
  ],
);

import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { isMember } from "./rls";
import { workspaces } from "./workspaces";

// A workspace's Stripe subscription, kept in sync by the Stripe webhook. No row means the
// workspace never subscribed: it's on its trial, or the trial has ended.
export const subscriptions = pgTable(
  "subscriptions",
  {
    workspaceId: uuid()
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    plan: text().notNull(),
    // Stripe's subscription status: active, trialing, past_due, canceled, unpaid, ...
    status: text().notNull(),
    stripeCustomerId: text().notNull(),
    stripeSubscriptionId: text(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("subscriptions_plan", sql`${t.plan} in ('starter', 'pro')`),
    pgPolicy("subscriptions_select_members", {
      for: "select",
      to: authenticatedRole,
      using: isMember(t.workspaceId),
    }),
  ],
);

// Stripe events already handled, so a repeated delivery changes nothing. Server only.
export const stripeEvents = pgTable("stripe_events", {
  id: text().primaryKey(),
  type: text().notNull(),
  receivedAt: createdAt(),
}).enableRLS();

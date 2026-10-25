import { pgEnum } from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "staff",
]);

export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];

// Five standard policies, at most one of each per business, plus any number of custom ones.
export const policyKind = pgEnum("policy_kind", [
  "cancellation",
  "late_arrival",
  "payment",
  "parking",
  "accessibility",
  "custom",
]);

export type PolicyKind = (typeof policyKind.enumValues)[number];

// Only confirmed bookings block time.
export const bookingStatus = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export type BookingStatus = (typeof bookingStatus.enumValues)[number];

// Who made the booking: someone in the dashboard, or the customer (manage link, later the widget).
export const bookingSource = pgEnum("booking_source", [
  "dashboard",
  "customer",
]);

// Where a knowledge source's text comes from.
export const knowledgeKind = pgEnum("knowledge_kind", [
  "file",
  "url",
  "sitemap",
  "text",
]);

export type KnowledgeKind = (typeof knowledgeKind.enumValues)[number];

export const knowledgeStatus = pgEnum("knowledge_status", [
  "queued",
  "processing",
  "ready",
  "failed",
]);

export type KnowledgeStatus = (typeof knowledgeStatus.enumValues)[number];

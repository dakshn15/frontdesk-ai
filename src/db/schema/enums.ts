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

export const aiProvider = pgEnum("ai_provider", ["openai", "google"]);

export type AiProvider = (typeof aiProvider.enumValues)[number];

// Where a conversation happens: the website widget, or the owner's dashboard preview.
export const conversationChannel = pgEnum("conversation_channel", [
  "widget",
  "preview",
]);

// ai: the receptionist is answering; needs_human: it handed off; human: a person took over.
export const conversationStatus = pgEnum("conversation_status", [
  "ai",
  "needs_human",
  "human",
  "resolved",
]);

export type ConversationStatus = (typeof conversationStatus.enumValues)[number];

export const messageRole = pgEnum("message_role", ["visitor", "ai", "staff"]);

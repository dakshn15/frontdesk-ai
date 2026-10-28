import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt } from "./columns";
import { conversationChannel, conversationStatus, messageRole } from "./enums";
import { isMember } from "./rls";
import { profiles } from "./profiles";
import { workspaces } from "./workspaces";

// Everything here is written by the server with the privileged connection (the chat API
// has no signed-in user), always scoped by workspace in code. Members can read it.
const membersRead = (table: string, workspaceId: unknown) =>
  pgPolicy(`${table}_select_members`, {
    for: "select",
    to: authenticatedRole,
    using: isMember(workspaceId),
  });

/** A website visitor's chat session. The widget holds the token; only its hash is stored. */
export const visitorSessions = pgTable("visitor_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sessionId: uuid().references(() => visitorSessions.id, {
      onDelete: "set null",
    }),
    channel: conversationChannel().notNull(),
    status: conversationStatus().notNull().default("ai"),
    handoffReason: text(),
    // When the AI last handed off, and who on the team has taken the chat over.
    handoffAt: timestamp({ withTimezone: true }),
    // Set once the chat has gone quiet: what it was about and how it ended (analytics).
    topic: text(),
    outcome: text(),
    taggedAt: timestamp({ withTimezone: true }),
    assignedTo: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("conversations_id_workspace_unique").on(t.id, t.workspaceId),
    index("conversations_workspace_last_idx").on(
      t.workspaceId,
      t.lastMessageAt,
    ),
    membersRead("conversations", t.workspaceId),
    // Any member can take a chat over, hand it back or resolve it (column grants limit what).
    pgPolicy("conversations_update_members", {
      for: "update",
      to: authenticatedRole,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
  ],
);

const inConversation = (
  name: string,
  t: { conversationId: unknown; workspaceId: unknown },
) =>
  foreignKey({
    name,
    columns: [t.conversationId as never, t.workspaceId as never],
    foreignColumns: [conversations.id, conversations.workspaceId],
  }).onDelete("cascade");

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    conversationId: uuid().notNull(),
    role: messageRole().notNull(),
    content: text().notNull(),
    // What an AI answer was based on: verified answers, passages, policies.
    sources: jsonb().notNull().default([]),
    // The team member who wrote a staff reply.
    authorId: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    inConversation("messages_conversation_fk", t),
    check("messages_content_length", sql`char_length(${t.content}) <= 8000`),
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    membersRead("messages", t.workspaceId),
    // Members reply as themselves; visitor and AI messages come only from the server.
    pgPolicy("messages_insert_staff", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${isMember(t.workspaceId)} and ${t.role} = 'staff' and ${t.authorId} = auth.uid()`,
    }),
  ],
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    conversationId: uuid().notNull(),
    tool: text().notNull(),
    input: jsonb().notNull(),
    output: jsonb(),
    durationMs: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    inConversation("tool_calls_conversation_fk", t),
    index("tool_calls_conversation_idx").on(t.conversationId, t.createdAt),
    membersRead("tool_calls", t.workspaceId),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: uuid().references(() => conversations.id, {
      onDelete: "set null",
    }),
    name: text().notNull(),
    email: text().notNull(),
    phone: text().notNull().default(""),
    message: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("leads_workspace_created_idx").on(t.workspaceId, t.createdAt),
    membersRead("leads", t.workspaceId),
  ],
);

/** Tokens per model call. Cost is worked out from these later (milestone 10). */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: uuid().references(() => conversations.id, {
      onDelete: "set null",
    }),
    provider: text().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    latencyMs: integer().notNull().default(0),
    fellBack: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("usage_events_workspace_created_idx").on(t.workspaceId, t.createdAt),
    membersRead("usage_events", t.workspaceId),
  ],
);

/** Fixed-window request counters for the public chat API. Server only. */
export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
).enableRLS();

import { sql } from "drizzle-orm";
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { knowledgeKind, knowledgeStatus } from "./enums";
import { profiles } from "./profiles";
import { isManager, isMember } from "./rls";
import { workspaces } from "./workspaces";

/** Embedding size of the platform's one embedding model (OpenAI text-embedding-3-small). */
export const EMBEDDING_DIMENSIONS = 1536;

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// Documents, pages and pasted text the receptionist can search. The pipeline (privileged)
// fills in status and counts; owners and admins add, re-sync and delete.
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: knowledgeKind().notNull(),
    title: text().notNull(),
    url: text(),
    fileName: text(),
    // Uploaded and pasted text is kept here; pages are fetched at each sync.
    content: text(),
    status: knowledgeStatus().notNull().default("queued"),
    error: text(),
    pageCount: integer().notNull().default(0),
    chunkCount: integer().notNull().default(0),
    startedAt: timestamp({ withTimezone: true }),
    syncedAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("knowledge_sources_id_workspace_unique").on(t.id, t.workspaceId),
    check(
      "knowledge_sources_title_length",
      sql`char_length(${t.title}) between 1 and 200`,
    ),
    check(
      "knowledge_sources_content_length",
      sql`char_length(${t.content}) <= 500000`,
    ),
    index("knowledge_sources_workspace_idx").on(t.workspaceId, t.createdAt),
    pgPolicy("knowledge_sources_select_members", {
      for: "select",
      to: authenticatedRole,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("knowledge_sources_insert_managers", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isManager(t.workspaceId),
    }),
    // Managers can only queue a source again (status and error are the granted columns).
    pgPolicy("knowledge_sources_update_managers", {
      for: "update",
      to: authenticatedRole,
      using: isManager(t.workspaceId),
      withCheck: isManager(t.workspaceId),
    }),
    pgPolicy("knowledge_sources_delete_managers", {
      for: "delete",
      to: authenticatedRole,
      using: isManager(t.workspaceId),
    }),
  ],
);

// Searchable passages. Only the pipeline writes them.
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().notNull(),
    sourceId: uuid().notNull(),
    position: integer().notNull(),
    heading: text().notNull().default(""),
    content: text().notNull(),
    pageUrl: text(),
    // Null until an embedding model is configured; search then uses keywords only.
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    fts: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', heading || ' ' || content)`,
    ),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "knowledge_chunks_source_fk",
      columns: [t.sourceId, t.workspaceId],
      foreignColumns: [knowledgeSources.id, knowledgeSources.workspaceId],
    }).onDelete("cascade"),
    index("knowledge_chunks_source_idx").on(t.sourceId, t.position),
    index("knowledge_chunks_workspace_idx").on(t.workspaceId),
    index("knowledge_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    index("knowledge_chunks_fts_idx").using("gin", t.fts),
    pgPolicy("knowledge_chunks_select_members", {
      for: "select",
      to: authenticatedRole,
      using: isMember(t.workspaceId),
    }),
  ],
);

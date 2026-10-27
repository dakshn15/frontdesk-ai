import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { createdAt, updatedAt } from "./columns";
import { profiles } from "./profiles";
import { businessDataPolicies, isMember } from "./rls";
import { workspaces } from "./workspaces";

/** What a test expects of an answer. Every field is optional; at least one is set. */
export type TestChecks = {
  mustUseTool?: string;
  mustContain?: string[];
  mustNotContain?: string[];
  mustSayNotSure?: boolean;
  mustHandOff?: boolean;
  /** Compared by meaning, by the AI grader. */
  expectedAnswer?: string;
};

// A question the owner wants the receptionist to keep getting right.
export const testCases = pgTable(
  "test_cases",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    question: text().notNull(),
    checks: jsonb().$type<TestChecks>().notNull(),
    // The nightly evaluation fails when one of these fails.
    mustPass: boolean().notNull().default(false),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "test_cases_question_length",
      sql`char_length(${t.question}) between 1 and 500`,
    ),
    index("test_cases_workspace_idx").on(t.workspaceId, t.createdAt),
    ...businessDataPolicies("test_cases", t.workspaceId),
  ],
);

const membersRead = (table: string, workspaceId: unknown) =>
  pgPolicy(`${table}_select_members`, {
    for: "select",
    to: authenticatedRole,
    using: isMember(workspaceId),
  });

// One click of "Run all tests". Written only by the server.
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    startedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    status: text().notNull().default("running"),
    total: integer().notNull().default(0),
    passed: integer().notNull().default(0),
    failed: integer().notNull().default(0),
    model: text().notNull().default(""),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      "test_runs_status",
      sql`${t.status} in ('running', 'done', 'failed')`,
    ),
    index("test_runs_workspace_started_idx").on(t.workspaceId, t.startedAt),
    membersRead("test_runs", t.workspaceId),
  ],
).enableRLS();

// How one test went in one run. The question is copied, so history survives edits.
export const testResults = pgTable(
  "test_results",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid()
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    testCaseId: uuid().references(() => testCases.id, {
      onDelete: "set null",
    }),
    question: text().notNull(),
    answer: text().notNull().default(""),
    tools: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    passed: boolean().notNull(),
    // Plain sentences saying which checks failed.
    failures: jsonb().$type<string[]>().notNull().default([]),
    graderNote: text(),
    latencyMs: integer().notNull().default(0),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("test_results_run_idx").on(t.runId, t.createdAt),
    membersRead("test_results", t.workspaceId),
  ],
).enableRLS();

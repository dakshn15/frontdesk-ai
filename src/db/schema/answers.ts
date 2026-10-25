import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";
import { profiles } from "./profiles";
import { businessDataPolicies } from "./rls";
import { workspaces } from "./workspaces";

// Questions the team has answered themselves. The receptionist checks these first.
export const verifiedAnswers = pgTable(
  "verified_answers",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    question: text().notNull(),
    answer: text().notNull(),
    createdBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    updatedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("verified_answers_workspace_question_unique").on(
      t.workspaceId,
      sql`lower(question)`,
    ),
    check(
      "verified_answers_question_length",
      sql`char_length(${t.question}) between 5 and 300`,
    ),
    check(
      "verified_answers_answer_length",
      sql`char_length(${t.answer}) between 1 and 2000`,
    ),
    ...businessDataPolicies("verified_answers", t.workspaceId),
  ],
);

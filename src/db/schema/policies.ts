import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";
import { policyKind } from "./enums";
import { businessDataPolicies } from "./rls";
import { workspaces } from "./workspaces";

// Short rules the receptionist quotes word for word. Standard kinds keep a fixed title
// and exist at most once per workspace; custom policies have their own titles.
export const policies = pgTable(
  "policies",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: policyKind().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("policies_workspace_kind_unique")
      .on(t.workspaceId, t.kind)
      .where(sql`kind <> 'custom'`),
    check(
      "policies_title_length",
      sql`char_length(${t.title}) between 1 and 60`,
    ),
    check(
      "policies_body_length",
      sql`char_length(${t.body}) between 1 and 1000`,
    ),
    ...businessDataPolicies("policies", t.workspaceId),
  ],
);

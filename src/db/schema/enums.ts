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

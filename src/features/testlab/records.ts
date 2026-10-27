import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { testCases } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";
import { MAX_TESTS, type TestCaseInput } from "./schemas";

type Result = "ok" | "not_allowed" | "too_many";

/** Adds a test, or edits the one with `id`. Managers only; up to MAX_TESTS per workspace. */
export async function saveTestRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: TestCaseInput & { id: string | null },
): Promise<Result> {
  try {
    return await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      if (!input.id) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(testCases)
          .where(eq(testCases.workspaceId, workspaceId));
        if (total >= MAX_TESTS) return "too_many";
        await tx.insert(testCases).values({
          workspaceId,
          question: input.question,
          checks: input.checks,
          mustPass: input.mustPass,
          createdBy: claims.sub,
        });
        return "ok";
      }
      const updated = await tx
        .update(testCases)
        .set({
          question: input.question,
          checks: input.checks,
          mustPass: input.mustPass,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(testCases.id, input.id),
            eq(testCases.workspaceId, workspaceId),
          ),
        )
        .returning({ id: testCases.id });
      if (updated.length === 0) throw new Refused();
      return "ok";
    });
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    throw err;
  }
}

export async function deleteTestRecord(
  claims: AuthClaims,
  workspaceId: string,
  testId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(testCases)
      .where(
        and(eq(testCases.id, testId), eq(testCases.workspaceId, workspaceId)),
      )
      .returning({ id: testCases.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}

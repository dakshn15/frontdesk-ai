import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_UNIQUE_VIOLATION } from "@/db/errors";
import { verifiedAnswers } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";
import type { AnswerInput } from "./schemas";

/** Adds an answer, or edits the one with `id`, recording who did it. */
export async function saveAnswerRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: AnswerInput & { id: string | null },
): Promise<"ok" | "not_allowed" | "duplicate_question"> {
  const { id, question, answer } = input;
  try {
    await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      if (!id) {
        await tx.insert(verifiedAnswers).values({
          workspaceId,
          question,
          answer,
          createdBy: claims.sub,
          updatedBy: claims.sub,
        });
        return;
      }
      const updated = await tx
        .update(verifiedAnswers)
        // The database's clock, so "newest edit first" agrees with inserts.
        .set({ question, answer, updatedBy: claims.sub, updatedAt: sql`now()` })
        .where(
          and(
            eq(verifiedAnswers.id, id),
            eq(verifiedAnswers.workspaceId, workspaceId),
          ),
        )
        .returning({ id: verifiedAnswers.id });
      if (updated.length === 0) throw new Refused();
    });
    return "ok";
  } catch (err) {
    if (err instanceof Refused) return "not_allowed";
    if (getPgError(err)?.code === PG_UNIQUE_VIOLATION) {
      return "duplicate_question";
    }
    throw err;
  }
}

export async function deleteAnswerRecord(
  claims: AuthClaims,
  workspaceId: string,
  answerId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(verifiedAnswers)
      .where(
        and(
          eq(verifiedAnswers.id, answerId),
          eq(verifiedAnswers.workspaceId, workspaceId),
        ),
      )
      .returning({ id: verifiedAnswers.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}

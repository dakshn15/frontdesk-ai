import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { profiles, verifiedAnswers } from "@/db/schema";

export type VerifiedAnswer = {
  id: string;
  question: string;
  answer: string;
  updatedAt: Date;
  /** Null when that person's account is gone. */
  updatedByName: string | null;
};

/** Newest edit first. */
export async function listAnswers(
  claims: AuthClaims,
  workspaceId: string,
): Promise<VerifiedAnswer[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: verifiedAnswers.id,
        question: verifiedAnswers.question,
        answer: verifiedAnswers.answer,
        updatedAt: verifiedAnswers.updatedAt,
        updatedByName: sql<
          string | null
        >`coalesce(nullif(${profiles.fullName}, ''), ${profiles.email})`,
      })
      .from(verifiedAnswers)
      .leftJoin(profiles, eq(profiles.id, verifiedAnswers.updatedBy))
      .where(eq(verifiedAnswers.workspaceId, workspaceId))
      .orderBy(desc(verifiedAnswers.updatedAt)),
  );
}

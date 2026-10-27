import { and, asc, desc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { testCases, testResults, testRuns } from "@/db/schema";

export async function listTests(claims: AuthClaims, workspaceId: string) {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: testCases.id,
        question: testCases.question,
        checks: testCases.checks,
        mustPass: testCases.mustPass,
      })
      .from(testCases)
      .where(eq(testCases.workspaceId, workspaceId))
      .orderBy(asc(testCases.createdAt), asc(testCases.question)),
  );
}

export async function listRuns(claims: AuthClaims, workspaceId: string) {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: testRuns.id,
        status: testRuns.status,
        total: testRuns.total,
        passed: testRuns.passed,
        failed: testRuns.failed,
        model: testRuns.model,
        startedAt: testRuns.startedAt,
      })
      .from(testRuns)
      .where(eq(testRuns.workspaceId, workspaceId))
      .orderBy(desc(testRuns.startedAt))
      .limit(20),
  );
}

/** A run and its results in the order the tests ran. */
export async function getRun(
  claims: AuthClaims,
  workspaceId: string,
  runId: string,
) {
  return withRls(claims, async (tx) => {
    const [run] = await tx
      .select()
      .from(testRuns)
      .where(
        and(eq(testRuns.id, runId), eq(testRuns.workspaceId, workspaceId)),
      );
    if (!run) return null;
    const results = await tx
      .select()
      .from(testResults)
      .where(
        and(
          eq(testResults.runId, runId),
          eq(testResults.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(testResults.createdAt));
    return { run, results };
  });
}

export type ReviewQuestion = {
  conversationId: string;
  question: string;
  confidence: "low" | "none";
  askedAt: Date;
};

/**
 * Visitors' questions from the last 30 days that the knowledge search couldn't answer
 * well, newest first, leaving out ones already saved as tests. The question is the
 * visitor's message just before the search. Plain SQL: Drizzle drops table names inside
 * correlated subqueries.
 */
export async function listQuestionsToReview(
  claims: AuthClaims,
  workspaceId: string,
): Promise<ReviewQuestion[]> {
  return withRls(claims, async (tx) => {
    const rows = await tx.execute<{
      conversation_id: string;
      question: string;
      confidence: "low" | "none";
      asked_at: string;
    }>(sql`
      select distinct on (lower(q.content))
        t.conversation_id, q.content as question,
        t.output->>'confidence' as confidence, q.created_at as asked_at
      from public.tool_calls t
      join public.conversations c on c.id = t.conversation_id and c.channel = 'widget'
      cross join lateral (
        select m.content, m.created_at from public.messages m
        where m.conversation_id = t.conversation_id and m.role = 'visitor'
          and m.created_at <= t.created_at
        order by m.created_at desc limit 1
      ) q
      where t.workspace_id = ${workspaceId}
        and t.tool = 'search_knowledge'
        and t.output->>'confidence' in ('low', 'none')
        and t.created_at > now() - interval '30 days'
        and not exists (
          select 1 from public.test_cases tc
          where tc.workspace_id = t.workspace_id and lower(tc.question) = lower(q.content)
        )
      order by lower(q.content), q.created_at desc`);
    return rows
      .map((row) => ({
        conversationId: row.conversation_id,
        question: row.question,
        confidence: row.confidence,
        askedAt: new Date(row.asked_at),
      }))
      .sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime())
      .slice(0, 20);
  });
}

import "server-only";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import {
  messages,
  testCases,
  testResults,
  testRuns,
  toolCalls,
  usageEvents,
  workspaces,
} from "@/db/schema";
import { evaluateChecks } from "@/features/testlab/checks";
import { MAX_TESTS } from "@/features/testlab/schemas";
import { runAgent } from "../assistant/agent";
import { chooseGrader, chooseModel } from "../assistant/models";
import { openConversation } from "../assistant/sessions";
import { allowRequest } from "../rate-limit";
import { gradeAnswer } from "./grader";

export const RUN_LIMITS = {
  perHour: { limit: 5, windowSeconds: 3600 },
  /** A run still "running" after this long crashed; it stops blocking new runs. */
  staleMinutes: 15,
} as const;

export type StartResult =
  | { ok: true; runId: string }
  | {
      ok: false;
      error: "no_tests" | "running" | "rate_limited";
      runId?: string;
    };

/** Opens a run for every test in the workspace. One at a time, a few an hour. */
export async function startTestRun(
  workspaceId: string,
  startedBy: string | null,
  now = new Date(),
): Promise<StartResult> {
  await adminDb
    .update(testRuns)
    .set({ status: "failed", finishedAt: now })
    .where(
      and(
        eq(testRuns.workspaceId, workspaceId),
        eq(testRuns.status, "running"),
        lt(
          testRuns.startedAt,
          new Date(now.getTime() - RUN_LIMITS.staleMinutes * 60_000),
        ),
      ),
    );
  const [running] = await adminDb
    .select({ id: testRuns.id })
    .from(testRuns)
    .where(
      and(
        eq(testRuns.workspaceId, workspaceId),
        eq(testRuns.status, "running"),
      ),
    )
    .limit(1);
  if (running) return { ok: false, error: "running", runId: running.id };

  const [{ total }] = await adminDb
    .select({ total: sql<number>`count(*)::int` })
    .from(testCases)
    .where(eq(testCases.workspaceId, workspaceId));
  if (total === 0) return { ok: false, error: "no_tests" };
  const { limit, windowSeconds } = RUN_LIMITS.perHour;
  if (
    !(await allowRequest(`testlab:${workspaceId}`, limit, windowSeconds, now))
  )
    return { ok: false, error: "rate_limited" };

  const [workspace] = await adminDb
    .select({ aiProvider: workspaces.aiProvider })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const choice = chooseModel(workspace.aiProvider);
  const [run] = await adminDb
    .insert(testRuns)
    .values({
      workspaceId,
      startedBy,
      total: Math.min(total, MAX_TESTS),
      model: choice ? `${choice.provider} ${choice.modelId}` : "none",
      startedAt: now,
    })
    .returning({ id: testRuns.id });
  return { ok: true, runId: run.id };
}

type Options = {
  /** Replaces the configured model (tests and the nightly evaluation). */
  model?: { model: LanguageModelV4; provider: string; modelId: string };
  /** Replaces the configured grader; null turns grading off. */
  grader?: LanguageModelV4 | null;
};

/** What the receptionist did for one question, read back from what the agent saved. */
async function outcomeOf(workspaceId: string, conversationId: string) {
  const inConversation = (table: typeof messages | typeof toolCalls) =>
    and(
      eq(table.conversationId, conversationId),
      eq(table.workspaceId, workspaceId),
    );
  const [[reply], tools, [usage]] = await Promise.all([
    adminDb
      .select({ content: messages.content })
      .from(messages)
      .where(and(inConversation(messages), eq(messages.role, "ai")))
      .orderBy(desc(messages.createdAt))
      .limit(1),
    adminDb
      .select({ tool: toolCalls.tool })
      .from(toolCalls)
      .where(inConversation(toolCalls))
      .orderBy(asc(toolCalls.createdAt)),
    adminDb
      .select({
        input: sql<number>`coalesce(sum(${usageEvents.inputTokens}), 0)::int`,
        output: sql<number>`coalesce(sum(${usageEvents.outputTokens}), 0)::int`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.conversationId, conversationId),
          eq(usageEvents.workspaceId, workspaceId),
        ),
      ),
  ]);
  return {
    answer: reply?.content ?? "",
    tools: [...new Set(tools.map((row) => row.tool))],
    inputTokens: usage?.input ?? 0,
    outputTokens: usage?.output ?? 0,
  };
}

/**
 * Asks the receptionist every test question, one at a time, as a dry run on its own test
 * conversation, and records each result. Never throws: a crash marks the run failed.
 */
export async function executeTestRun(
  runId: string,
  options: Options = {},
): Promise<void> {
  const [run] = await adminDb
    .select({ workspaceId: testRuns.workspaceId, total: testRuns.total })
    .from(testRuns)
    .where(eq(testRuns.id, runId));
  if (!run) return;
  const { workspaceId } = run;
  const grader = options.grader === undefined ? chooseGrader() : options.grader;
  let passed = 0;
  let failed = 0;
  try {
    const cases = await adminDb
      .select()
      .from(testCases)
      .where(eq(testCases.workspaceId, workspaceId))
      .orderBy(asc(testCases.createdAt), asc(testCases.question))
      .limit(run.total);
    for (const test of cases) {
      const started = Date.now();
      let outcome = {
        answer: "",
        tools: [] as string[],
        inputTokens: 0,
        outputTokens: 0,
      };
      let failures: string[];
      let graderNote: string | null = null;
      try {
        const conversationId = await openConversation({
          workspaceId,
          channel: "test",
          sessionId: null,
        });
        const agent = await runAgent({
          workspaceId,
          conversationId,
          mode: "dry",
          text: test.question,
          model: options.model,
        });
        await agent.done;
        outcome = await outcomeOf(workspaceId, conversationId);
        failures = evaluateChecks(test.checks, outcome);
        if (test.checks.expectedAnswer) {
          if (!grader) {
            graderNote = "Skipped the meaning check: it needs an AI key.";
          } else if (outcome.answer) {
            const verdict = await gradeAnswer({
              question: test.question,
              expected: test.checks.expectedAnswer,
              answer: outcome.answer,
              model: grader,
            });
            graderNote = verdict.note;
            if (!verdict.passed)
              failures.push(`The meaning didn't match: ${verdict.note}`);
          }
        }
      } catch (error) {
        console.error("test lab: a test failed to run", error);
        failures = ["Something went wrong running this test. Try again."];
      }
      const ok = failures.length === 0;
      if (ok) passed += 1;
      else failed += 1;
      await adminDb.insert(testResults).values({
        workspaceId,
        runId,
        testCaseId: test.id,
        question: test.question,
        answer: outcome.answer,
        tools: outcome.tools,
        passed: ok,
        failures,
        graderNote,
        latencyMs: Date.now() - started,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
      });
      await adminDb
        .update(testRuns)
        .set({ passed, failed })
        .where(eq(testRuns.id, runId));
    }
    await adminDb
      .update(testRuns)
      .set({ status: "done", total: passed + failed, finishedAt: new Date() })
      .where(eq(testRuns.id, runId));
  } catch (error) {
    console.error("test lab: run failed", error);
    await adminDb
      .update(testRuns)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(testRuns.id, runId));
  }
}

import { MockLanguageModelV4 } from "ai/test";
import { and, count, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  emailLog,
  leads,
  testCases,
  testResults,
  testRuns,
} from "@/db/schema";
import { fakeModel } from "@/features/assistant/fake-model";
import { DEMO_TESTS } from "@/features/demo/content";
import { listTests } from "@/features/testlab/queries";
import { deleteTestRecord, saveTestRecord } from "@/features/testlab/records";
import { seedDemoWorkspace } from "@/privileged/demo/seed";
import { executeTestRun, startTestRun } from "@/privileged/testlab/runs";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  trackWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

const scripted = { model: fakeModel(), provider: "fake", modelId: "scripted" };
const test = {
  question: "Do you have parking?",
  checks: { mustContain: ["parking"] },
  mustPass: false,
};

/** Bookings and leads in a workspace, to show a dry run adds none. */
async function counts(workspaceId: string) {
  const [[b], [l]] = await Promise.all([
    adminDb
      .select({ n: count() })
      .from(bookings)
      .where(eq(bookings.workspaceId, workspaceId)),
    adminDb
      .select({ n: count() })
      .from(leads)
      .where(eq(leads.workspaceId, workspaceId)),
  ]);
  return { bookings: b.n, leads: l.n };
}

async function workspace() {
  const [owner, staff] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, staff, "staff");
  return { owner, staff, ws };
}

describe("saved tests", () => {
  it("managers add, edit and delete them; staff and outsiders can't", async () => {
    const { owner, staff, ws } = await workspace();
    const outsider = await createTestUser();
    expect(
      await saveTestRecord(claimsFor(staff), ws.id, { ...test, id: null }),
    ).toBe("not_allowed");
    expect(
      await saveTestRecord(claimsFor(owner), ws.id, { ...test, id: null }),
    ).toBe("ok");
    const [saved] = await listTests(claimsFor(staff), ws.id);
    expect(saved).toMatchObject(test);
    expect(await listTests(claimsFor(outsider), ws.id)).toEqual([]);
    expect(
      await saveTestRecord(claimsFor(staff), ws.id, {
        ...test,
        question: "Changed",
        id: saved.id,
      }),
    ).toBe("not_allowed");
    expect(await deleteTestRecord(claimsFor(staff), ws.id, saved.id)).toBe(
      "not_allowed",
    );
    expect(await deleteTestRecord(claimsFor(owner), ws.id, saved.id)).toBe(
      "ok",
    );
  });

  it("are limited to 50 per workspace", async () => {
    const { owner, ws } = await workspace();
    await adminDb.insert(testCases).values(
      Array.from({ length: 50 }, (_, i) => ({
        workspaceId: ws.id,
        question: `Question ${i}`,
        checks: { mustContain: ["x"] },
      })),
    );
    expect(
      await saveTestRecord(claimsFor(owner), ws.id, { ...test, id: null }),
    ).toBe("too_many");
  });
});

describe("test runs", () => {
  it("need tests, go one at a time, and a stuck run stops blocking after 15 minutes", async () => {
    const { owner, ws } = await workspace();
    expect(await startTestRun(ws.id, owner.id)).toEqual({
      ok: false,
      error: "no_tests",
    });
    await saveTestRecord(claimsFor(owner), ws.id, { ...test, id: null });
    const first = await startTestRun(ws.id, owner.id);
    expect(first.ok).toBe(true);
    expect(await startTestRun(ws.id, owner.id)).toMatchObject({
      ok: false,
      error: "running",
    });
    const later = new Date(Date.now() + 16 * 60_000);
    const second = await startTestRun(ws.id, owner.id, later);
    expect(second.ok).toBe(true);
    const [stuck] = await adminDb
      .select({ status: testRuns.status })
      .from(testRuns)
      .where(eq(testRuns.id, (first as { runId: string }).runId));
    expect(stuck.status).toBe("failed");
  });

  it("are limited to 5 an hour", async () => {
    const { owner, ws } = await workspace();
    await saveTestRecord(claimsFor(owner), ws.id, { ...test, id: null });
    for (let i = 0; i < 5; i++) {
      const run = await startTestRun(ws.id, owner.id);
      expect(run.ok).toBe(true);
      await adminDb
        .update(testRuns)
        .set({ status: "done" })
        .where(eq(testRuns.workspaceId, ws.id));
    }
    expect(await startTestRun(ws.id, owner.id)).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("run the demo salon's tests as a dry run and explain each failure", async () => {
    const owner = await createTestUser();
    const { id } = await seedDemoWorkspace(
      owner.id,
      new Date(Date.now() + 3_600_000),
    );
    trackWorkspace(id);
    const before = await counts(id);
    const started = await startTestRun(id, owner.id);
    if (!started.ok) throw new Error(started.error);
    await executeTestRun(started.runId, { model: scripted, grader: null });

    const [run] = await adminDb
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, started.runId));
    expect(run).toMatchObject({ status: "done", total: DEMO_TESTS.length });
    expect(run.passed + run.failed).toBe(DEMO_TESTS.length);
    const results = await adminDb
      .select()
      .from(testResults)
      .where(eq(testResults.runId, started.runId));
    const byQuestion = Object.fromEntries(
      results.map((result) => [result.question, result]),
    );
    // The scripted model searches the knowledge for most questions.
    expect(byQuestion["Do you have parking?"]).toMatchObject({
      passed: true,
      tools: ["search_knowledge"],
    });
    expect(byQuestion["Can I talk to a person?"]).toMatchObject({
      passed: true,
      tools: ["handoff_to_human"],
    });
    expect(byQuestion["Can I book a women's cut this week?"]).toMatchObject({
      passed: true,
    });
    expect(byQuestion["How much is balayage?"]).toMatchObject({
      passed: false,
      failures: ['The answer doesn\'t mention "$195".'],
    });
    expect(byQuestion["Do you sell gift cards?"].failures).toContain(
      "It didn't use find_verified_answer.",
    );
    // No grader: the meaning check is skipped, not failed.
    expect(
      byQuestion["Is your keratin treatment formaldehyde-free?"],
    ).toMatchObject({
      graderNote: "Skipped the meaning check: it needs an AI key.",
    });

    // Dry runs: nothing booked or saved, and every chat is on the test channel.
    expect(await counts(id)).toEqual(before);
    const emails = await adminDb
      .select({ kind: emailLog.kind })
      .from(emailLog)
      .where(and(eq(emailLog.workspaceId, id), eq(emailLog.kind, "handoff")));
    expect(emails).toEqual([]);
    const channels = await adminDb
      .selectDistinct({ channel: conversations.channel })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, id),
          eq(conversations.channel, "test"),
        ),
      );
    expect(channels).toEqual([{ channel: "test" }]);
  });

  it("grade expected answers by meaning when a grader is available", async () => {
    const { owner, ws } = await workspace();
    await saveTestRecord(claimsFor(owner), ws.id, {
      question: "Is there parking?",
      checks: { expectedAnswer: "Yes, free parking behind the salon." },
      mustPass: false,
      id: null,
    });
    const grader = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "FAIL: it doesn't mention parking." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const started = await startTestRun(ws.id, owner.id);
    if (!started.ok) throw new Error(started.error);
    await executeTestRun(started.runId, { model: scripted, grader });
    const [result] = await adminDb
      .select()
      .from(testResults)
      .where(eq(testResults.runId, started.runId));
    expect(result).toMatchObject({
      passed: false,
      graderNote: "it doesn't mention parking.",
      failures: ["The meaning didn't match: it doesn't mention parking."],
    });
  });
});

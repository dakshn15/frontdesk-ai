import { appendFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { testCases, testResults, testRuns } from "@/db/schema";
import { seedDemoWorkspace } from "@/privileged/demo/seed";
import { executeTestRun, startTestRun } from "@/privileged/testlab/runs";
import {
  cleanupTestData,
  createTestUser,
  trackWorkspace,
} from "../helpers/seed";

// The second layer of the evaluation: the demo salon's saved tests, asked of the real
// models with the AI grader on. Fails when a must-pass test fails.

afterAll(cleanupTestData);

const live = Boolean(
  process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
);

/** Adds to the GitHub Actions job summary when running there. */
function summary(markdown: string) {
  console.log(markdown);
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n+/g, " ");

describe("the demo salon, against the real models", () => {
  it.skipIf(!live)("passes every must-pass test", async () => {
    const owner = await createTestUser();
    const { id } = await seedDemoWorkspace(
      owner.id,
      new Date(Date.now() + 3_600_000),
    );
    trackWorkspace(id);
    const started = await startTestRun(id, owner.id);
    if (!started.ok) throw new Error(started.error);
    await executeTestRun(started.runId);

    const [run] = await adminDb
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, started.runId));
    const results = await adminDb
      .select({
        question: testResults.question,
        passed: testResults.passed,
        failures: testResults.failures,
        answer: testResults.answer,
        mustPass: testCases.mustPass,
      })
      .from(testResults)
      .leftJoin(testCases, eq(testCases.id, testResults.testCaseId))
      .where(eq(testResults.runId, started.runId));

    summary(
      [
        `## Demo salon evaluation: ${run.passed} of ${run.total} passed`,
        "",
        `Model: ${run.model}.`,
        "",
        "| Test | Must pass | Result | Why |",
        "| --- | --- | --- | --- |",
        ...results.map(
          (result) =>
            `| ${cell(result.question)} | ${result.mustPass ? "Yes" : ""} | ${result.passed ? "Passed" : "Failed"} | ${cell(result.failures.join(" ") || "")} |`,
        ),
      ].join("\n"),
    );
    expect(run.status).toBe("done");
    const broken = results
      .filter((result) => result.mustPass && !result.passed)
      .map((result) => ({
        question: result.question,
        failures: result.failures,
        answer: result.answer,
      }));
    expect(broken).toEqual([]);
  });

  it.skipIf(live)("is skipped without an AI key", () => {
    summary(
      "## Demo salon evaluation skipped\n\nAdd an OPENAI_API_KEY secret to run it.",
    );
  });
});

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  type ActionResult,
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/validation";
import { executeTestRun, startTestRun } from "@/privileged/testlab/runs";
import { deleteTestRecord, saveTestRecord } from "./records";
import { MAX_TESTS, testCaseSchema } from "./schemas";

const optionalId = z.union([z.literal(""), z.uuid()]);

/** Adds a test, or edits the one named by the form's testId. */
export async function saveTest(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const testId = optionalId.safeParse(formData.get("testId") ?? "");
  if (!context || !testId.success) return fail(NOT_ALLOWED);
  const parsed = testCaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await saveTestRecord(context.claims, context.workspace.id, {
    ...parsed.data,
    id: testId.data || null,
  });
  if (result === "too_many")
    return fail(`You can have up to ${MAX_TESTS} tests. Delete one first.`);
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/assistant/tests`);
  return ok();
}

export async function deleteTest(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const testId = z.uuid().safeParse(formData.get("testId"));
  if (!context || !testId.success) return fail(NOT_ALLOWED);
  const result = await deleteTestRecord(
    context.claims,
    context.workspace.id,
    testId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/assistant/tests`);
  return ok();
}

const RUN_ERRORS = {
  no_tests: "Add a test first.",
  running: "Your tests are already running.",
  rate_limited: "You've run the tests 5 times this hour. Try again later.",
} as const;

/** Starts a run of every test; the answers come in after the response, one by one. */
export async function runTests(
  slug: string,
): Promise<ActionResult<{ runId: string }>> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const started = await startTestRun(context.workspace.id, context.claims.sub);
  if (!started.ok) {
    return started.runId
      ? ok({ runId: started.runId })
      : fail(RUN_ERRORS[started.error]);
  }
  after(() => executeTestRun(started.runId));
  revalidatePath(`/w/${slug}/assistant/tests`);
  return ok({ runId: started.runId });
}

import type { TestChecks } from "@/db/schema/testlab";

// How an answer is held to its test. Each failed check becomes one plain sentence, so the
// owner can see why without reading code.

/** Phrases that count as the receptionist saying it doesn't know. */
export const NOT_SURE =
  /not sure|don't know|do not know|(can't|cannot) (answer|confirm|say)|don't have (that|this|any) information|i'm unable/i;

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

export function evaluateChecks(
  checks: TestChecks,
  outcome: { answer: string; tools: string[] },
): string[] {
  const failures: string[] = [];
  const answer = normalize(outcome.answer);
  if (!answer) failures.push("There was no answer.");
  if (checks.mustUseTool && !outcome.tools.includes(checks.mustUseTool)) {
    failures.push(`It didn't use ${checks.mustUseTool}.`);
  }
  for (const text of checks.mustContain ?? []) {
    if (!answer.includes(normalize(text)))
      failures.push(`The answer doesn't mention "${text}".`);
  }
  for (const text of checks.mustNotContain ?? []) {
    if (answer.includes(normalize(text)))
      failures.push(`The answer mentions "${text}", which it shouldn't.`);
  }
  if (checks.mustSayNotSure && !NOT_SURE.test(outcome.answer)) {
    failures.push("It didn't say it wasn't sure.");
  }
  if (checks.mustHandOff && !outcome.tools.includes("handoff_to_human")) {
    failures.push("It didn't hand the chat to the team.");
  }
  return failures;
}

/** The AI grader answers "PASS: reason" or "FAIL: reason". */
export function parseVerdict(reply: string): { passed: boolean; note: string } {
  const match = /^\s*(PASS|FAIL)\b[\s:.\-–—]*([\s\S]*)$/i.exec(reply);
  if (!match) {
    return {
      passed: false,
      note: `The grader's reply wasn't clear: ${reply.trim()}`,
    };
  }
  return {
    passed: match[1].toUpperCase() === "PASS",
    note: match[2].trim(),
  };
}

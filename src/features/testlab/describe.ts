import type { TestChecks } from "@/db/schema/testlab";

/** A test's checks as short phrases for the list: "Mentions "$195"", "Hands off". */
export function describeChecks(checks: TestChecks): string[] {
  return [
    checks.mustUseTool ? `Uses ${checks.mustUseTool}` : null,
    ...(checks.mustContain ?? []).map((text) => `Mentions "${text}"`),
    ...(checks.mustNotContain ?? []).map((text) => `Doesn't mention "${text}"`),
    checks.mustSayNotSure ? "Says it isn't sure" : null,
    checks.mustHandOff ? "Hands off to the team" : null,
    checks.expectedAnswer ? `Means: ${checks.expectedAnswer}` : null,
  ].filter((phrase): phrase is string => phrase !== null);
}

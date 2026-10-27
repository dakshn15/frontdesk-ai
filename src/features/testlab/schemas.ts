import { z } from "zod";
import type { TestChecks } from "@/db/schema/testlab";
import { TOOL_LABEL } from "@/features/inbox/constants";

export const MAX_TESTS = 50;
export const TOOL_NAMES = Object.keys(TOOL_LABEL);

/** One phrase per line, blank lines dropped, up to 5. */
const phrases = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z
          .string()
          .max(100, { error: "Keep each phrase under 100 characters." }),
      )
      .max(5, { error: "Add up to 5 phrases." }),
  );

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

/** The test form: a question and the checks its answer must pass. */
export const testCaseSchema = z
  .object({
    question: z
      .string({ error: "Add the question." })
      .trim()
      .min(1, { error: "Add the question." })
      .max(500, { error: "Use 500 characters or fewer." }),
    mustUseTool: z
      .union([z.literal(""), z.enum(TOOL_NAMES, { error: "Pick a tool." })])
      .default(""),
    mustContain: phrases,
    mustNotContain: phrases,
    mustSayNotSure: checkbox,
    mustHandOff: checkbox,
    expectedAnswer: z
      .string()
      .trim()
      .max(1000, { error: "Use 1,000 characters or fewer." })
      .default(""),
    mustPass: checkbox,
  })
  .transform((input, ctx) => {
    const checks: TestChecks = {};
    if (input.mustUseTool) checks.mustUseTool = input.mustUseTool;
    if (input.mustContain.length) checks.mustContain = input.mustContain;
    if (input.mustNotContain.length)
      checks.mustNotContain = input.mustNotContain;
    if (input.mustSayNotSure) checks.mustSayNotSure = true;
    if (input.mustHandOff) checks.mustHandOff = true;
    if (input.expectedAnswer) checks.expectedAnswer = input.expectedAnswer;
    if (Object.keys(checks).length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["checks"],
        message: "Add at least one check.",
      });
      return z.NEVER;
    }
    return { question: input.question, checks, mustPass: input.mustPass };
  });

export type TestCaseInput = z.output<typeof testCaseSchema>;

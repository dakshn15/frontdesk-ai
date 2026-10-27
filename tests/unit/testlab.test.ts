import { describe, expect, it } from "vitest";
import { evaluateChecks, parseVerdict } from "@/features/testlab/checks";
import { testCaseSchema } from "@/features/testlab/schemas";

describe("evaluateChecks", () => {
  const outcome = {
    answer: "Balayage starts at $195 and takes about 3 hours.",
    tools: ["get_services"],
  };

  it("passes when every check holds, ignoring case and spacing", () => {
    expect(
      evaluateChecks(
        {
          mustUseTool: "get_services",
          mustContain: ["$195", "3   HOURS"],
          mustNotContain: ["discount"],
        },
        outcome,
      ),
    ).toEqual([]);
  });

  it("says plainly which checks failed", () => {
    expect(
      evaluateChecks(
        {
          mustUseTool: "search_knowledge",
          mustContain: ["$150"],
          mustNotContain: ["$195"],
          mustSayNotSure: true,
          mustHandOff: true,
        },
        outcome,
      ),
    ).toEqual([
      "It didn't use search_knowledge.",
      'The answer doesn\'t mention "$150".',
      'The answer mentions "$195", which it shouldn\'t.',
      "It didn't say it wasn't sure.",
      "It didn't hand the chat to the team.",
    ]);
  });

  it("recognises an honest 'not sure' and a handoff", () => {
    expect(
      evaluateChecks(
        { mustSayNotSure: true, mustHandOff: true },
        {
          answer:
            "I'm not sure about that. I can pass your question to the team.",
          tools: ["search_knowledge", "handoff_to_human"],
        },
      ),
    ).toEqual([]);
    expect(
      evaluateChecks(
        { mustSayNotSure: true },
        { answer: "I don't have that information.", tools: [] },
      ),
    ).toEqual([]);
  });

  it("fails when there was no answer at all", () => {
    expect(evaluateChecks({ mustContain: ["x"] }, { answer: " ", tools: [] }))
      .toEqual(["There was no answer.", 'The answer doesn\'t mention "x".']);
  });
});

describe("parseVerdict", () => {
  it("reads PASS or FAIL and the reason", () => {
    expect(parseVerdict("PASS: says it's formaldehyde-free.")).toEqual({
      passed: true,
      note: "says it's formaldehyde-free.",
    });
    expect(parseVerdict("fail - quotes the wrong price")).toEqual({
      passed: false,
      note: "quotes the wrong price",
    });
  });

  it("treats anything else as a failure, with the reply as the note", () => {
    expect(parseVerdict("Maybe?")).toEqual({
      passed: false,
      note: "The grader's reply wasn't clear: Maybe?",
    });
  });
});

describe("testCaseSchema", () => {
  const form = {
    question: "  How much is balayage? ",
    mustUseTool: "get_services",
    mustContain: "$195\n\n from \n",
    mustNotContain: "",
    expectedAnswer: "",
  };

  it("reads the form into a question and its checks", () => {
    expect(testCaseSchema.parse({ ...form, mustPass: "on" })).toEqual({
      question: "How much is balayage?",
      mustPass: true,
      checks: { mustUseTool: "get_services", mustContain: ["$195", "from"] },
    });
    expect(
      testCaseSchema.parse({
        question: "Extensions?",
        mustSayNotSure: "on",
        mustHandOff: "on",
        expectedAnswer: "We don't do extensions.",
      }),
    ).toEqual({
      question: "Extensions?",
      mustPass: false,
      checks: {
        mustSayNotSure: true,
        mustHandOff: true,
        expectedAnswer: "We don't do extensions.",
      },
    });
  });

  it("needs a question, a known tool and at least one check", () => {
    const result = testCaseSchema.safeParse({
      question: "",
      mustUseTool: "delete_everything",
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path[0]);
    expect(paths).toContain("question");
    expect(paths).toContain("mustUseTool");
    const empty = testCaseSchema.safeParse({ question: "Hi" });
    expect(empty.error!.issues).toMatchObject([
      { path: ["checks"], message: "Add at least one check." },
    ]);
  });
});

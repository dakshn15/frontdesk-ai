import { describe, expect, it } from "vitest";
import { answerInputSchema } from "@/features/answers/schemas";
import { policyInputSchema } from "@/features/policies/schemas";

const errorsOf = (result: { success: boolean; error?: unknown }) =>
  result.success
    ? {}
    : (
        result.error as {
          flatten: () => { fieldErrors: Record<string, string[]> };
        }
      ).flatten().fieldErrors;

describe("policyInputSchema", () => {
  it("refuses a custom policy without a title", () => {
    const result = policyInputSchema.safeParse({
      kind: "custom",
      title: "  ",
      body: "Children under 12 need an adult with them.",
    });
    expect(errorsOf(result)).toEqual({ title: ["Add a title."] });
  });

  it("gives standard kinds their fixed title", () => {
    const result = policyInputSchema.parse({
      kind: "cancellation",
      title: "Something else",
      body: " Cancel 24 hours ahead. ",
    });
    expect(result).toEqual({
      id: null,
      kind: "cancellation",
      title: "Cancellations",
      body: "Cancel 24 hours ahead.",
    });
  });

  it("keeps a custom policy's id and title", () => {
    const id = "5b0c1f2e-8d5a-4b63-9a39-2f6f9d0c7e11";
    expect(
      policyInputSchema.parse({
        id,
        kind: "custom",
        title: "Children",
        body: "Children are welcome.",
      }),
    ).toEqual({
      id,
      kind: "custom",
      title: "Children",
      body: "Children are welcome.",
    });
  });

  it("refuses an empty policy and an unknown kind", () => {
    expect(
      errorsOf(policyInputSchema.safeParse({ kind: "parking", body: " " })),
    ).toEqual({ body: ["Write the policy."] });
    expect(
      policyInputSchema.safeParse({ kind: "pets", body: "No pets." }).success,
    ).toBe(false);
  });
});

describe("answerInputSchema", () => {
  it("trims and checks lengths", () => {
    expect(
      answerInputSchema.parse({
        question: " Do you do bridal hair? ",
        answer: " Yes, with a trial first. ",
      }),
    ).toEqual({
      question: "Do you do bridal hair?",
      answer: "Yes, with a trial first.",
    });
    expect(
      errorsOf(answerInputSchema.safeParse({ question: "Hi", answer: "" })),
    ).toEqual({
      question: ["Use 5 to 300 characters."],
      answer: ["Write the answer."],
    });
  });
});

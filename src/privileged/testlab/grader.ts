import "server-only";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { generateText } from "ai";
import { parseVerdict } from "@/features/testlab/checks";

const INSTRUCTIONS = `You grade a receptionist's answer against the answer the business expects.
Pass it when it says the same thing in substance, even in other words or with extra helpful detail.
Fail it when it contradicts the expected answer, leaves out its key fact, or makes something up.
Reply with PASS or FAIL, a colon, and one short sentence saying why.`;

/** Whether `answer` means the same as `expected`, with a one-sentence reason. */
export async function gradeAnswer(input: {
  question: string;
  expected: string;
  answer: string;
  model: LanguageModelV4;
}): Promise<{ passed: boolean; note: string }> {
  const { text } = await generateText({
    model: input.model,
    instructions: INSTRUCTIONS,
    prompt: `Question: ${input.question}\n\nExpected answer: ${input.expected}\n\nReceptionist's answer: ${input.answer}`,
  });
  return parseVerdict(text);
}

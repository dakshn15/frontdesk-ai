import { z } from "zod";

const QUESTION_ERROR = "Use 5 to 300 characters.";

export const answerInputSchema = z.object({
  question: z
    .string({ error: QUESTION_ERROR })
    .trim()
    .min(5, { error: QUESTION_ERROR })
    .max(300, { error: QUESTION_ERROR }),
  answer: z
    .string({ error: "Write the answer." })
    .trim()
    .min(1, { error: "Write the answer." })
    .max(2000, { error: "Use 2,000 characters or fewer." }),
});

export type AnswerInput = z.output<typeof answerInputSchema>;

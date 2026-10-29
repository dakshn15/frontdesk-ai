import { z } from "zod";

export const receptionistSettingsSchema = z.object({
  assistantName: z
    .string()
    .trim()
    .min(1, { error: "Give it a name." })
    .max(40, { error: "Use 40 characters or fewer." }),
  aiProvider: z.enum(["openai", "google"], { error: "Pick a provider." }),
});

/** A pasted provider key: OpenAI keys start with "sk-"; Gemini keys are checked live. */
export const aiKeySchema = (provider: "openai" | "google") =>
  z
    .string({ error: "Paste your key." })
    .trim()
    .min(1, { error: "Paste your key." })
    .max(300, { error: "That's too long for an API key." })
    .refine((key) => !/\s/.test(key), { error: "Keys don't contain spaces." })
    .refine((key) => provider !== "openai" || key.startsWith("sk-"), {
      error: 'OpenAI keys start with "sk-".',
    });

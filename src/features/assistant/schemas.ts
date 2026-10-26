import { z } from "zod";

export const receptionistSettingsSchema = z.object({
  assistantName: z
    .string()
    .trim()
    .min(1, { error: "Give it a name." })
    .max(40, { error: "Use 40 characters or fewer." }),
  aiProvider: z.enum(["openai", "google"], { error: "Pick a provider." }),
});

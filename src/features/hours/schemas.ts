import { z } from "zod";

export const closedDaySchema = z.object({
  date: z.iso.date({ error: "Pick a date." }),
  name: z
    .string()
    .trim()
    .max(60, { error: "Use 60 characters or fewer." })
    .default(""),
});

export type ClosedDayInput = z.output<typeof closedDaySchema>;

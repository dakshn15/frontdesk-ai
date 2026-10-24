import { z } from "zod";

/** Zod errors keyed by field name, the shape forms display under each input. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

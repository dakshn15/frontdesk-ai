import { z } from "zod";
import { parsePrice } from "@/lib/money";

const NAME_ERROR = "Use 2 to 80 characters.";
const DURATION_ERROR = "Use 5 to 720 minutes, in steps of 5.";
const BUFFER_ERROR = "Use 0 to 240 minutes, in steps of 5.";
const PRICE_ERROR = "Enter a price like 45 or 45.50.";

// Checkboxes send "on" when ticked and nothing when not.
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

const minutes = (min: number, max: number, error: string) =>
  z.coerce
    .number({ error })
    .int({ error })
    .min(min, { error })
    .max(max, { error })
    .refine((value) => value % 5 === 0, { error });

/** A service form, with the price read in the workspace's currency. */
export function serviceInputSchema(currency: string) {
  return z
    .object({
      name: z
        .string({ error: NAME_ERROR })
        .trim()
        .min(2, { error: NAME_ERROR })
        .max(80, { error: NAME_ERROR }),
      description: z
        .string()
        .trim()
        .max(1000, { error: "Use 1,000 characters or fewer." })
        .default(""),
      category: z
        .string()
        .trim()
        .max(40, { error: "Use 40 characters or fewer." })
        .default(""),
      durationMinutes: minutes(5, 720, DURATION_ERROR),
      bufferMinutes: minutes(0, 240, BUFFER_ERROR),
      price: z
        .string()
        .default("")
        .transform((value, ctx) => {
          const result = parsePrice(value, currency);
          if (!result.ok) {
            ctx.addIssue({ code: "custom", message: PRICE_ERROR });
            return z.NEVER;
          }
          return result.cents;
        }),
      priceIsFrom: checkbox,
      bookableOnline: checkbox,
    })
    .transform(({ price, ...rest }) => ({ ...rest, priceCents: price }));
}

export type ServiceInput = z.output<ReturnType<typeof serviceInputSchema>>;

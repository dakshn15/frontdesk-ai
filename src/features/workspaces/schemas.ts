import { z } from "zod";
import { isValidCurrency, isValidTimeZone } from "@/lib/locale-options";

const NAME_ERROR = "Use 2 to 80 characters.";
const WEBSITE_ERROR = "Enter a full website address, like bloomsalon.com.";
const TIME_ZONE_ERROR = "Choose a time zone from the list.";
const CURRENCY_ERROR = "Choose a currency from the list.";

/** Accepts "bloomsalon.com" or a full http(s) URL; an empty value means no website. */
export function parseWebsite(
  input: string,
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: null };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false };
  if (!url.hostname.includes(".")) return { ok: false };

  const isBareOrigin = url.pathname === "/" && !url.search && !url.hash;
  return { ok: true, value: isBareOrigin ? url.origin : url.href };
}

export const workspaceDetailsSchema = z.object({
  name: z
    .string({ error: NAME_ERROR })
    .trim()
    .min(2, { error: NAME_ERROR })
    .max(80, { error: NAME_ERROR }),
  website: z
    .string()
    .default("")
    .transform((value, ctx) => {
      const result = parseWebsite(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: WEBSITE_ERROR });
        return z.NEVER;
      }
      return result.value;
    }),
  timezone: z
    .string({ error: TIME_ZONE_ERROR })
    .refine(isValidTimeZone, { error: TIME_ZONE_ERROR }),
  currency: z
    .string({ error: CURRENCY_ERROR })
    .trim()
    .toUpperCase()
    .refine(isValidCurrency, { error: CURRENCY_ERROR }),
});

export type WorkspaceDetails = z.output<typeof workspaceDetailsSchema>;

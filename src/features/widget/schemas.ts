import { z } from "zod";
import { normalizeDomain } from "./domains";

export const MAX_SUGGESTIONS = 4;
export const MAX_DOMAINS = 10;

/** One entry per line, blank lines dropped. */
const lines = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

export const widgetSettingsSchema = z.object({
  widgetColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, { error: "Pick a colour like #0f766e." })
    .transform((value) => value.toLowerCase()),
  widgetGreeting: z
    .string()
    .trim()
    .min(1, { error: "Add a greeting." })
    .max(300, { error: "Use 300 characters or fewer." }),
  widgetSuggestions: lines.pipe(
    z
      .array(
        z
          .string()
          .max(80, { error: "Keep each question under 80 characters." }),
      )
      .max(MAX_SUGGESTIONS, {
        error: `Add up to ${MAX_SUGGESTIONS} questions.`,
      }),
  ),
  widgetPosition: z.enum(["right", "left"], { error: "Pick a corner." }),
  allowedDomains: lines
    .transform((entries, ctx) => {
      const domains = new Set<string>();
      for (const entry of entries) {
        const domain = normalizeDomain(entry);
        if (!domain) {
          ctx.addIssue({
            code: "custom",
            message: `“${entry}” isn't a domain. Use one like bloomsalon.com.`,
          });
          return z.NEVER;
        }
        domains.add(domain);
      }
      return [...domains];
    })
    .pipe(
      z
        .array(z.string())
        .max(MAX_DOMAINS, { error: `Add up to ${MAX_DOMAINS} domains.` }),
    ),
});

export type WidgetSettings = z.output<typeof widgetSettingsSchema>;

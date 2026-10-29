import { z } from "zod";

type Source = Record<string, string | undefined>;

const siteUrl = z.url().transform((value) => value.replace(/\/$/, ""));
const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const clientShape = {
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: siteUrl,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: flag,
  // Cloudflare Turnstile on the demo's guest sign-in; Supabase checks the token. Optional.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
};

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  // Without a Resend key, emails are written to email_log as not sent.
  RESEND_API_KEY: z.string().min(1).optional(),
  // Vercel Cron sends it as a bearer token; the reminder route refuses calls without it.
  CRON_SECRET: z.string().min(16).optional(),
  EMAIL_FROM: z.string().min(3).default("FrontDesk AI <onboarding@resend.dev>"),
  // Without an OpenAI key, knowledge is stored without embeddings and searched by keyword.
  OPENAI_API_KEY: z.string().min(1).optional(),
  // Optional second provider; the receptionist falls back to it if the first fails.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  // Encrypts the AI keys workspaces paste in Settings. Without it, they can't save keys.
  AI_KEYS_SECRET: z.string().min(32).optional(),
  // Who can open the platform admin page: comma-separated emails. Nobody when unset.
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  // Stripe test mode. Without the secret key, the Billing page shows plans but can't subscribe.
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  // The Stripe price ids of the Starter and Pro monthly prices.
  STRIPE_PRICE_STARTER: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_PRO: z.string().startsWith("price_").optional(),
  // "1" swaps in a scripted model for end-to-end tests. Ignored on Vercel.
  AI_FAKE: z.enum(["0", "1"]).default("0"),
  ...clientShape,
});

const clientSchema = z.object(clientShape);

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function parse<T extends z.ZodType>(schema: T, source: Source): z.infer<T> {
  // Empty strings count as unset, so a blank line in .env.local reads as missing.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = String(issue.path[0]);
    return `${name} (${cleaned[name] === undefined ? "missing" : issue.message})`;
  });
  throw new Error(
    `Missing or invalid environment variables: ${problems.join(", ")}`,
  );
}

export function parseServerEnv(source: Source): ServerEnv {
  return parse(serverSchema, source);
}

export function parseClientEnv(source: Source): ClientEnv {
  return parse(clientSchema, source);
}

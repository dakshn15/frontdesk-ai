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
};

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
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

// Prints the app's environment variables for the running local Supabase stack.
// Used by `npm run env:local` (writes .env.local) and by CI (appends to $GITHUB_ENV).
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type Vars = Record<string, string | undefined>;

const DEFAULT_MAIL_URL = "http://127.0.0.1:54324";

export function parseEnvOutput(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    vars[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return vars;
}

export function mapSupabaseStatus(vars: Vars): Record<string, string> {
  const publishableKey = vars.PUBLISHABLE_KEY ?? vars.ANON_KEY;
  const secretKey = vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY;
  if (!vars.API_URL || !vars.DB_URL || !publishableKey || !secretKey) {
    throw new Error(
      "Local Supabase isn't running. Start Docker Desktop, then run npm run db:start.",
    );
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: vars.API_URL,
    DATABASE_URL: vars.DB_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    MAILPIT_URL: vars.MAILPIT_URL ?? vars.INBUCKET_URL ?? DEFAULT_MAIL_URL,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const output = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env = mapSupabaseStatus(parseEnvOutput(output));
  process.stdout.write(
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
}

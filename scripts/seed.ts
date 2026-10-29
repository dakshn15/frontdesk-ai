// npm run db:seed: deletes the showcase workspace and recreates it in the default demo state.
// Runs with tsx and the react-server condition, so `server-only` and the @/ aliases resolve.
//
//   --slug <slug>          workspace slug           (SEED_WORKSPACE_SLUG, default bloom-hair-beauty)
//   --email <email>        owner's email            (SEED_OWNER_EMAIL, default demo@frontdesk.test locally)
//   --password <password>  only to create a new local owner (SEED_OWNER_PASSWORD); never printed
//   --env-file <path>      env file to load         (default .env.local; the shell's variables win)
//   --dry-run              say what would happen, change nothing
//   --yes                  required for a database that isn't local, or a workspace someone else owns
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: flags } = parseArgs({
  options: {
    slug: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    "env-file": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const envFile = flags["env-file"] ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
else if (flags["env-file"]) fail(`${envFile} doesn't exist.`);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostOf(url: string | undefined, name: string): string {
  if (!url) fail(`${name} is not set. Run npm run env:local, or set it.`);
  try {
    return new URL(url).hostname;
  } catch {
    fail(`${name} isn't a valid URL.`);
  }
}

const dbHost = hostOf(process.env.DATABASE_URL, "DATABASE_URL");
const local = LOCAL_HOSTS.has(dbHost);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  supabaseUrl &&
  local !== LOCAL_HOSTS.has(hostOf(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"))
) {
  fail(
    "DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at different projects (one local, one not).",
  );
}

const slug =
  flags.slug ?? process.env.SEED_WORKSPACE_SLUG ?? "bloom-hair-beauty";
const email: string =
  flags.email ??
  process.env.SEED_OWNER_EMAIL ??
  (local
    ? "demo@frontdesk.test"
    : fail(
        "Set SEED_OWNER_EMAIL (or --email) to seed a database that isn't local.",
      ));
const password = flags.password ?? process.env.SEED_OWNER_PASSWORD;

async function main() {
  const seeder = await import("./seed-showcase");
  try {
    console.log(`Database: ${dbHost}${local ? " (local)" : " (NOT LOCAL)"}`);
    console.log(`Workspace: ${slug}`);
    console.log(`Owner: ${email}`);

    const userId = await seeder.findUserId(email);
    const existing = await seeder.findWorkspace(slug);
    const plan: string[] = [];
    if (existing) {
      plan.push(
        `Delete "${existing.name}" (${slug}): ${existing.services} services, ${existing.bookings} bookings, ` +
          `${existing.conversations} chats and everything else in it. Owners: ${existing.owners.join(", ") || "none"}.`,
      );
    } else {
      plan.push(`No workspace has the slug ${slug} yet.`);
    }
    if (!userId) {
      if (!local) {
        fail(
          `${email} has no account there. Sign up in the app first, then run this again.`,
        );
      }
      if (!password && !flags["dry-run"]) {
        fail(
          `${email} doesn't exist yet. Set SEED_OWNER_PASSWORD (or --password) to create it.`,
        );
      }
      plan.push(
        `Create the user ${email} (email confirmed${password ? "" : "; needs SEED_OWNER_PASSWORD"}).`,
      );
    }
    plan.push(
      `Seed Bloom Hair & Beauty at ${slug}, owned by ${email}, with no demo expiry, on Pro (active, ${seeder.SHOWCASE_CUSTOMER_ID}).`,
    );
    console.log("\nThis will:");
    for (const step of plan) console.log(`  - ${step}`);

    const someoneElses =
      existing !== null &&
      !existing.owners.some(
        (owner) => owner.toLowerCase() === email.toLowerCase(),
      );
    if (flags["dry-run"]) {
      console.log("\nDry run: nothing changed.");
    } else if ((!local || someoneElses) && !flags.yes) {
      fail(
        !local
          ? "This database isn't local. Check the plan above, then run again with --yes."
          : `${slug} belongs to someone else. Check the plan above, then run again with --yes.`,
      );
    } else {
      const ownerId = userId ?? (await seeder.createOwner(email, password!));
      const started = Date.now();
      const result = await seeder.resetShowcase(slug, ownerId);
      const seeded = await seeder.findWorkspace(result.slug);
      console.log(
        `\n✓ Seeded ${result.slug} in ${((Date.now() - started) / 1000).toFixed(1)}s: ` +
          `${seeded?.services} services, ${seeded?.bookings} bookings, ${seeded?.conversations} chats, on Pro.`,
      );
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      if (site) console.log(`  Sign in as ${email} at ${site}/sign-in`);
    }
  } finally {
    await seeder.closeDatabase();
  }
}

void main();

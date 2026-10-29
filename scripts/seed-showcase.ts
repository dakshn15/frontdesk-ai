// Puts the showcase workspace back to the default demo state: a permanent copy of Bloom Hair &
// Beauty on an active Pro subscription. Used by scripts/seed.ts (npm run db:seed) and its test.
// Imports the database, so the environment must be loaded before this module is.
import { createClient } from "@supabase/supabase-js";
import { and, count, eq, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  memberships,
  profiles,
  services,
  workspaces,
} from "@/db/schema";
import { seedDemoWorkspace } from "@/privileged/demo/seed";

export const DEFAULT_SLUG = "bloom-hair-beauty";
export const DEFAULT_LOCAL_EMAIL = "demo@frontdesk.test";
// Obviously fake, so nobody mistakes it for a Stripe customer.
export const SHOWCASE_CUSTOMER_ID = "cus_showcase_seed";

export type Existing = {
  id: string;
  name: string;
  owners: string[];
  services: number;
  bookings: number;
  conversations: number;
};

/** The workspace that has `slug` now, with enough detail to say what a reset deletes. */
export async function findWorkspace(slug: string): Promise<Existing | null> {
  const [ws] = await adminDb
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  if (!ws) return null;
  const rows = async (table: typeof services) =>
    (
      await adminDb
        .select({ n: count() })
        .from(table)
        .where(eq(table.workspaceId, ws.id))
    )[0].n;
  const owners = await adminDb
    .select({ email: profiles.email })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .where(
      and(eq(memberships.workspaceId, ws.id), eq(memberships.role, "owner")),
    );
  return {
    ...ws,
    owners: owners.map((owner) => owner.email),
    services: await rows(services),
    bookings: await rows(bookings as never),
    conversations: await rows(conversations as never),
  };
}

/** The auth user with this email, if there is one. */
export async function findUserId(email: string): Promise<string | null> {
  const rows = await adminDb.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = lower(${email}) limit 1`,
  );
  return rows[0]?.id ?? null;
}

/** Creates a confirmed email-and-password user with the Supabase admin API. */
export async function createOwner(
  email: string,
  password: string,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Creating the owner needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
  const { data, error } = await admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Bloom Demo Owner" },
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${email}: ${error?.message}`);
  }
  return data.user.id;
}

/** Deletes any workspace with `slug` and seeds it again for `userId`, in one transaction. */
export async function resetShowcase(
  slug: string,
  userId: string,
  now = new Date(),
): Promise<{ id: string; slug: string }> {
  return seedDemoWorkspace(userId, null, now, {
    slug,
    subscription: {
      plan: "pro",
      status: "active",
      stripeCustomerId: SHOWCASE_CUSTOMER_ID,
    },
  });
}

export async function closeDatabase(): Promise<void> {
  await adminDb.$client.end();
}

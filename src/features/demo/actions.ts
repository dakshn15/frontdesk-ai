"use server";

import { headers } from "next/headers";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { getAuthClaims } from "@/lib/auth/session";
import { startSandbox } from "@/privileged/demo/sandboxes";

const MESSAGES = {
  not_anonymous:
    "You're signed in to an account. Sign out first to try the demo as a guest.",
  rate_limited:
    "You've started a few demos already. Try again in an hour, or carry on with the one you have.",
  full: "The demo is busy right now. Try again in a few minutes.",
} as const;

/** The guest's own copy of the demo salon, made right after their guest sign-in. */
export async function startDemo(): Promise<ActionResult<{ slug: string }>> {
  const claims = await getAuthClaims();
  if (!claims) return fail("Your guest session didn't start. Try again.");
  const forwarded = (await headers()).get("x-forwarded-for");
  const result = await startSandbox({
    userId: claims.sub,
    isAnonymous: claims.is_anonymous === true,
    ip: forwarded?.split(",")[0]?.trim() || "unknown",
  });
  return result.ok ? ok({ slug: result.slug }) : fail(MESSAGES[result.error]);
}

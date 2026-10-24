import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { AuthClaims } from "@/db";
import {
  getMembershipBySlug,
  type Membership,
} from "@/features/workspaces/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The verified claims of the signed-in user, or null. One check per request. */
export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { ...claims, sub: claims.sub, email: claims.email };
});

export async function requireUser(
  nextPath = "/dashboard",
): Promise<AuthClaims> {
  const claims = await getAuthClaims();
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return claims;
}

/** The signed-in user's membership in this workspace. Anyone else gets a 404, not a hint it exists. */
export async function requireMembership(
  slug: string,
): Promise<{ claims: AuthClaims; membership: Membership }> {
  const claims = await requireUser(`/w/${slug}`);
  const membership = await getMembershipBySlug(claims, slug);
  if (!membership) notFound();
  return { claims, membership };
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthClaims } from "@/db";
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

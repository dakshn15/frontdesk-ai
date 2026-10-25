import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/env/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getAuthClaims } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google sign-in and auth emails return here. Supabase's default emails and Google bring a
// one-time code to exchange for a session; a token-hash email link (/auth/confirm) has
// already signed the person in and only needs sending on to `next`.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeRedirectPath(
    params.get("next"),
    getServerEnv().NEXT_PUBLIC_SITE_URL,
  );

  let signedIn = false;
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    signedIn = !error;
  } else {
    signedIn = Boolean(await getAuthClaims());
  }
  redirect(signedIn ? next : "/auth/error?reason=callback");
}

import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/env/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google sign-in returns here with a one-time code.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  let destination = "/auth/error?reason=oauth";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      destination = safeRedirectPath(
        params.get("next"),
        getServerEnv().NEXT_PUBLIC_SITE_URL,
      );
    }
  }
  redirect(destination);
}

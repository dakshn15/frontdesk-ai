import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/env/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // An optional `next` field brings someone back, e.g. to an invite meant for another account.
  const form = await request.formData().catch(() => null);
  const next = form?.get("next");
  const destination = safeRedirectPath(
    typeof next === "string" ? next : null,
    getServerEnv().NEXT_PUBLIC_SITE_URL,
    "/",
  );
  // 303 so the browser follows with a GET.
  return NextResponse.redirect(new URL(destination, request.url), 303);
}

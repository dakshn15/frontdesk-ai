import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/env/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The link in confirmation and password-reset emails lands here.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let destination = "/auth/error?reason=link";
  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      destination =
        type === "recovery"
          ? "/account/update-password"
          : safeRedirectPath(
              params.get("next"),
              getServerEnv().NEXT_PUBLIC_SITE_URL,
            );
    }
  }
  redirect(destination);
}

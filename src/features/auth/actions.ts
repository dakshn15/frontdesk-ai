"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerEnv } from "@/env/server";
import { fail, type FormState, ok } from "@/lib/action-result";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EMAIL_NOT_CONFIRMED,
  emailOnlySchema,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

const TRY_AGAIN = "Something went wrong. Try again in a moment.";
const CHECK_FIELDS = "Check the highlighted fields.";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/** Where confirmation emails send people back to: a path on this site with no query string. */
function emailRedirect(next: string | undefined): string {
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const path = safeRedirectPath(next, siteUrl).split(/[?#]/)[0];
  return `${siteUrl}${path}`;
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, fieldErrors(parsed.error));
  const { fullName, email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirect(next),
      data: { full_name: fullName },
    },
  });
  // Supabase answers an already-registered email the same way, so this never reveals accounts.
  if (error?.code === "weak_password") {
    return fail(CHECK_FIELDS, { password: ["Choose a stronger password."] });
  }
  if (error) return fail(TRY_AGAIN);
  return ok();
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, fieldErrors(parsed.error));
  const { email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error?.code === "invalid_credentials") {
    return fail("That email and password don't match.");
  }
  if (error?.code === EMAIL_NOT_CONFIRMED) {
    return fail("Confirm your email first.", undefined, EMAIL_NOT_CONFIRMED);
  }
  if (error) return fail(TRY_AGAIN);
  redirect(safeRedirectPath(next, getServerEnv().NEXT_PUBLIC_SITE_URL));
}

export async function resendConfirmation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailOnlySchema
    .extend({ next: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, fieldErrors(parsed.error));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: emailRedirect(parsed.data.next) },
  });
  if (error) return fail(TRY_AGAIN);
  return ok();
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, fieldErrors(parsed.error));

  const supabase = await createSupabaseServerClient();
  // The result is ignored on purpose: the reply is the same whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getServerEnv().NEXT_PUBLIC_SITE_URL}/account/update-password`,
  });
  return ok();
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, fieldErrors(parsed.error));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error?.code === "same_password") {
    return fail(CHECK_FIELDS, {
      password: ["Use a password you haven't used here before."],
    });
  }
  if (error?.code === "weak_password") {
    return fail(CHECK_FIELDS, { password: ["Choose a stronger password."] });
  }
  if (error) return fail(TRY_AGAIN);
  redirect("/dashboard");
}

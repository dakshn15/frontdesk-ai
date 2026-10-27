"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthClaims } from "@/db";
import { getPgError } from "@/db/errors";
import { fail, type FormState, ok } from "@/lib/action-result";
import { getAuthClaims } from "@/lib/auth/session";
import { zodFieldErrors } from "@/lib/validation";
import { canDeleteWorkspace, canEditWorkspace } from "./permissions";
import { getMembershipBySlug } from "./queries";
import {
  createWorkspaceRecord,
  deleteWorkspaceRecord,
  updateWorkspaceRecord,
} from "./records";
import { workspaceDetailsSchema } from "./schemas";

const TRY_AGAIN = "Something went wrong. Try again in a moment.";
const CHECK_FIELDS = "Check the highlighted fields.";
const NOT_ALLOWED = "You don't have permission to do that.";

async function claimsOrSignIn(nextPath: string): Promise<AuthClaims> {
  const claims = await getAuthClaims();
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return claims;
}

export async function createWorkspace(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn("/onboarding");
  const parsed = workspaceDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));

  let slug: string;
  try {
    ({ slug } = await createWorkspaceRecord(claims, parsed.data));
  } catch (err) {
    if (getPgError(err)?.message === "anonymous_user")
      return fail(
        "You're using the demo. Sign out and create an account to make your own workspace.",
      );
    console.error("createWorkspace failed", err);
    return fail(TRY_AGAIN);
  }
  redirect(`/w/${slug}`);
}

export async function updateWorkspaceDetails(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn(`/w/${slug}/settings`);
  const membership = await getMembershipBySlug(claims, slug);
  if (!membership || !canEditWorkspace(membership.role)) {
    return fail(NOT_ALLOWED);
  }
  const parsed = workspaceDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));

  const result = await updateWorkspaceRecord(
    claims,
    membership.workspace.id,
    parsed.data,
  );
  if (result === "not_allowed") return fail(NOT_ALLOWED);
  // The name also shows in the sidebar, so refresh the whole workspace layout.
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

export async function deleteWorkspace(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn(`/w/${slug}/settings`);
  const membership = await getMembershipBySlug(claims, slug);
  if (!membership || !canDeleteWorkspace(membership.role)) {
    return fail(NOT_ALLOWED);
  }
  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed !== membership.workspace.name) {
    return fail(CHECK_FIELDS, {
      confirmName: ["Type the workspace name exactly to confirm."],
    });
  }
  const result = await deleteWorkspaceRecord(claims, membership.workspace.id);
  if (result === "not_allowed") return fail(NOT_ALLOWED);
  redirect("/dashboard");
}

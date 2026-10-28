"use server";

import { canAddSeat } from "@/privileged/billing/limits";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthClaims } from "@/db";
import { getServerEnv } from "@/env/server";
import { emailOnlySchema } from "@/features/auth/schemas";
import { getMembershipBySlug } from "@/features/workspaces/queries";
import { fail, type FormState, ok } from "@/lib/action-result";
import { getAuthClaims } from "@/lib/auth/session";
import { zodFieldErrors } from "@/lib/validation";
import { teamErrorMessage } from "./messages";
import { getInvitePreview } from "./queries";
import {
  acceptInviteRecord,
  changeRoleRecord,
  createInviteRecord,
  removeMemberRecord,
  revokeInviteRecord,
} from "./records";

const CHECK_FIELDS = "Check the highlighted fields.";

const inviteSchema = emailOnlySchema.extend({
  role: z.enum(["admin", "staff"], { error: "Choose a role." }),
});
const roleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(["owner", "admin", "staff"]),
});
const idSchema = (name: string) => z.object({ [name]: z.uuid() });

async function claimsOrSignIn(nextPath: string): Promise<AuthClaims> {
  const claims = await getAuthClaims();
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return claims;
}

/** The caller's claims and this workspace's id, or null when they aren't a member. */
async function workspaceContext(slug: string) {
  const claims = await claimsOrSignIn(`/w/${slug}/team`);
  const membership = await getMembershipBySlug(claims, slug);
  return membership
    ? {
        claims,
        workspaceId: membership.workspace.id,
        demo: membership.workspace.demoExpiresAt !== null,
      }
    : null;
}

export async function inviteMember(
  slug: string,
  _prev: FormState<{ inviteUrl: string; email: string }>,
  formData: FormData,
): Promise<FormState<{ inviteUrl: string; email: string }>> {
  const context = await workspaceContext(slug);
  if (!context) return fail(teamErrorMessage("not_allowed"));
  if (context.demo) return fail(teamErrorMessage("demo_workspace"));
  if (!(await canAddSeat(context.workspaceId)))
    return fail(
      "Your plan's team seats are full. Remove someone or upgrade your plan in Billing.",
    );
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));

  const result = await createInviteRecord(
    context.claims,
    context.workspaceId,
    parsed.data,
  );
  if (!result.ok) {
    return result.error === "already_member"
      ? fail(CHECK_FIELDS, { email: [teamErrorMessage("already_member")] })
      : fail(teamErrorMessage(result.error));
  }
  revalidatePath(`/w/${slug}/team`);
  const inviteUrl = `${getServerEnv().NEXT_PUBLIC_SITE_URL}/invite/${result.token}`;
  return ok({ inviteUrl, email: parsed.data.email });
}

export async function revokeInvite(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await workspaceContext(slug);
  const parsed = idSchema("inviteId").safeParse(Object.fromEntries(formData));
  if (!context || !parsed.success) return fail(teamErrorMessage("not_allowed"));
  const result = await revokeInviteRecord(
    context.claims,
    context.workspaceId,
    String(parsed.data.inviteId),
  );
  if (result !== "ok") return fail(teamErrorMessage(result));
  revalidatePath(`/w/${slug}/team`);
  return ok();
}

export async function changeMemberRole(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await workspaceContext(slug);
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!context || !parsed.success) return fail(teamErrorMessage("not_allowed"));
  const result = await changeRoleRecord(
    context.claims,
    context.workspaceId,
    parsed.data.membershipId,
    parsed.data.role,
  );
  if (result !== "ok") return fail(teamErrorMessage(result));
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

export async function removeMember(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await workspaceContext(slug);
  const parsed = idSchema("membershipId").safeParse(
    Object.fromEntries(formData),
  );
  if (!context || !parsed.success) return fail(teamErrorMessage("not_allowed"));
  const membershipId = String(parsed.data.membershipId);
  const membership = await getMembershipBySlug(context.claims, slug);
  const leaving = membership?.membershipId === membershipId;

  const result = await removeMemberRecord(
    context.claims,
    context.workspaceId,
    membershipId,
  );
  if (result !== "ok") return fail(teamErrorMessage(result));
  if (leaving) redirect("/dashboard");
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

// Bound to the token on the invite page; the form sends no other fields.
export async function acceptInvite(token: string): Promise<FormState> {
  const claims = await claimsOrSignIn(`/invite/${token}`);
  const result = await acceptInviteRecord(claims, token);
  if (!result.ok) {
    const preview = await getInvitePreview(claims, token);
    return fail(teamErrorMessage(result.error, { email: preview?.email }));
  }
  redirect(`/w/${result.slug}`);
}

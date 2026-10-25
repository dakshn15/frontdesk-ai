import "server-only";
import type { AuthClaims } from "@/db";
import { getAuthClaims } from "@/lib/auth/session";
import { canEditWorkspace } from "./permissions";
import { getMembershipBySlug, type Membership } from "./queries";

/**
 * For server actions on owner-and-admin pages: the caller and the workspace, or null when
 * they're signed out, not a member, or staff. Row level security still checks every write.
 */
export async function getManagerContext(
  slug: string,
): Promise<{ claims: AuthClaims; workspace: Membership["workspace"] } | null> {
  const claims = await getAuthClaims();
  if (!claims) return null;
  const membership = await getMembershipBySlug(claims, slug);
  if (!membership || !canEditWorkspace(membership.role)) return null;
  return { claims, workspace: membership.workspace };
}

/** For server actions any member may use (the calendar): the caller, workspace and role. */
export async function getMemberContext(slug: string): Promise<{
  claims: AuthClaims;
  workspace: Membership["workspace"];
  role: Membership["role"];
} | null> {
  const claims = await getAuthClaims();
  if (!claims) return null;
  const membership = await getMembershipBySlug(claims, slug);
  if (!membership) return null;
  return { claims, workspace: membership.workspace, role: membership.role };
}

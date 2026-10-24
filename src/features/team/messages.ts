const MESSAGES: Record<string, string> = {
  already_member: "That person is already in this workspace.",
  last_owner:
    "A workspace needs at least one owner. Make someone else an owner first.",
  not_allowed: "You don't have permission to do that.",
  invite_not_found: "This invite link isn't valid.",
  invite_revoked: "This invite was cancelled.",
  invite_used: "This invite has already been used.",
  invite_expired: "This invite has expired. Ask for a new one.",
};

/** What to tell someone when a team action or invite fails. */
export function teamErrorMessage(
  code: string,
  vars: { email?: string } = {},
): string {
  if (code === "invite_email_mismatch") {
    return `This invite was sent to ${vars.email ?? "a different email"}. Sign in with that email to accept it.`;
  }
  return MESSAGES[code] ?? "Something went wrong. Try again in a moment.";
}

export const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
} as const;

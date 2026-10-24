import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

/** The token goes in the invite link; only its hash is stored. */
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

// Must match the SQL in private.accept_invitation: encode(sha256(convert_to(token, 'UTF8')), 'hex').
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// Same precedence as private.invitation_preview: accepted, revoked, expired, then pending.
export function inviteStatus(
  invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

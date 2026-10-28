import type { AuthClaims } from "@/db";

/** Whether this user runs the platform: their email is in PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdmin(
  claims: AuthClaims | null,
  allowList: string,
): boolean {
  if (!claims || claims.is_anonymous === true) return false;
  const email = claims.email?.trim().toLowerCase();
  if (!email) return false;
  return allowList
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

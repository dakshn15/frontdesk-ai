/**
 * Turns an untrusted `next` value into a same-site path, so sign-in and email links can
 * never send someone to another website. Accepts a path ("/w/bloom") or a full URL on
 * this site; anything else gives `fallback`.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  siteUrl: string,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  const site = new URL(siteUrl);

  const isPath =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  const isSiteUrl = next === site.origin || next.startsWith(`${site.origin}/`);
  if (!isPath && !isSiteUrl) return fallback;

  const url = new URL(next, site);
  if (url.origin !== site.origin) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Where auth emails send people back to. /auth/callback signs them in, either with the
 * one-time code from Supabase's default emails or with the session the token-hash link
 * already created, then continues to `next`, which is made safe first.
 */
export function authCallbackUrl(
  siteUrl: string,
  next: string | null | undefined,
): string {
  const path = safeRedirectPath(next, siteUrl);
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(path)}`;
}

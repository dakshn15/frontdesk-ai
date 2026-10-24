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

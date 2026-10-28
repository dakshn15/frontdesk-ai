const SIGNED_IN_ONLY = [
  "/dashboard",
  "/onboarding",
  "/w",
  "/account",
  "/admin",
];
const SIGNED_OUT_ONLY = ["/sign-in", "/sign-up", "/forgot-password"];

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

// Matches whole path segments, so "/w" covers "/w/bloom" but not "/wizard".
function within(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Decides, in the proxy, whether a request may continue or must be redirected. */
export function routeDecision(
  pathname: string,
  search: string,
  isSignedIn: boolean,
): RouteDecision {
  if (!isSignedIn && within(pathname, SIGNED_IN_ONLY)) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return { type: "redirect", to: `/sign-in?next=${next}` };
  }
  if (isSignedIn && within(pathname, SIGNED_OUT_ONLY)) {
    return { type: "redirect", to: "/dashboard" };
  }
  return { type: "next" };
}

/**
 * Supabase sends people to the home page when an email link fails, with `error_code` in
 * the query, and with a one-time `code` when the return address isn't on its allowed
 * list. Both should end somewhere useful instead of the landing page.
 */
export function authReturnRedirect(
  pathname: string,
  params: URLSearchParams,
): string | null {
  if (pathname !== "/") return null;
  if (params.has("error_code") || params.has("error")) {
    const expired = params.get("error_code") === "otp_expired";
    return `/auth/error?reason=${expired ? "link" : "callback"}`;
  }
  const code = params.get("code");
  if (code) {
    return `/auth/callback?code=${encodeURIComponent(code)}&next=%2Fdashboard`;
  }
  return null;
}

/**
 * Whether a request is Next prefetching a link in the background. Those must not change
 * anything the person didn't choose, like the workspace remembered for /dashboard.
 */
export function isPrefetch(headers: Headers): boolean {
  return (
    headers.has("next-router-prefetch") ||
    headers.has("next-router-segment-prefetch")
  );
}

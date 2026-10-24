const SIGNED_IN_ONLY = ["/dashboard", "/onboarding", "/w", "/account"];
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

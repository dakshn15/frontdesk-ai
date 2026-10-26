import { type NextRequest, NextResponse } from "next/server";
import { LAST_WORKSPACE_COOKIE } from "@/lib/auth/home";
import { authReturnRedirect, routeDecision } from "@/lib/auth/routing";
import { updateSession } from "@/lib/supabase/proxy";
import { frameAncestors } from "@/features/widget/domains";
import { getWidgetConfig } from "@/privileged/widget/guard";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"];
const WORKSPACE_PATH = /^\/w\/([a-z0-9-]+)(?:\/|$)/;

// Public chat routes have no signed-in user, so they skip the Supabase session refresh.
const PUBLIC_CHAT = /^\/(?:embed\.js$|api\/chat(?:\/|$)|api\/widget\/)/;
const WIDGET_PAGE = /^\/widget\/([a-z0-9-]+)\/?$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_CHAT.test(pathname)) return NextResponse.next();
  const widget = WIDGET_PAGE.exec(pathname)?.[1];
  if (widget) {
    // Only the business's own sites may show its chat.
    const response = NextResponse.next();
    const config = await getWidgetConfig(widget);
    const policy = config ? frameAncestors(config.allowedDomains) : null;
    if (policy) response.headers.set("content-security-policy", policy);
    return response;
  }

  const { response, isSignedIn } = await updateSession(request);
  const authReturn = authReturnRedirect(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  );
  const decision = authReturn
    ? ({ type: "redirect", to: authReturn } as const)
    : routeDecision(
        request.nextUrl.pathname,
        request.nextUrl.search,
        isSignedIn,
      );
  if (decision.type === "next") {
    // /dashboard checks this against the user's memberships before using it.
    const workspace = WORKSPACE_PATH.exec(request.nextUrl.pathname)?.[1];
    if (workspace) {
      response.cookies.set(LAST_WORKSPACE_COOKIE, workspace, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  // A redirect must carry the refreshed session cookies and no-cache headers too.
  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of CACHE_HEADERS) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

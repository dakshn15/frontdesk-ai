import { type NextRequest, NextResponse } from "next/server";
import { routeDecision } from "@/lib/auth/routing";
import { updateSession } from "@/lib/supabase/proxy";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"];

export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await updateSession(request);
  const decision = routeDecision(
    request.nextUrl.pathname,
    request.nextUrl.search,
    isSignedIn,
  );
  if (decision.type === "next") return response;

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

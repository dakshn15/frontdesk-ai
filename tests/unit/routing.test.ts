import { describe, expect, it } from "vitest";
import { authReturnRedirect, routeDecision } from "@/lib/auth/routing";

const toSignIn = (next: string) => ({
  type: "redirect",
  to: `/sign-in?next=${encodeURIComponent(next)}`,
});

describe("routeDecision", () => {
  it.each([
    ["/dashboard", "", false, toSignIn("/dashboard")],
    ["/w/bloom/team", "?tab=1", false, toSignIn("/w/bloom/team?tab=1")],
    ["/onboarding", "", false, toSignIn("/onboarding")],
    [
      "/account/update-password",
      "",
      false,
      toSignIn("/account/update-password"),
    ],
    ["/wizard", "", false, { type: "next" }],
    ["/invite/abc", "", false, { type: "next" }],
    ["/", "", false, { type: "next" }],
    ["/sign-in", "", true, { type: "redirect", to: "/dashboard" }],
    ["/sign-up", "", true, { type: "redirect", to: "/dashboard" }],
    ["/forgot-password", "", true, { type: "redirect", to: "/dashboard" }],
    ["/sign-in", "", false, { type: "next" }],
    ["/dashboard", "", true, { type: "next" }],
  ])("routeDecision(%s%s, signedIn=%s)", (path, search, signedIn, expected) => {
    expect(routeDecision(path, search, signedIn)).toEqual(expected);
  });
});

// Supabase sends people to the home page when an email link fails (expired, already used),
// and with a one-time code when the return address isn't on its allowed list.
describe("authReturnRedirect", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("sends an expired or used email link to a clear error", () => {
    expect(
      authReturnRedirect(
        "/",
        params(
          "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        ),
      ),
    ).toBe("/auth/error?reason=link");
  });

  it("sends any other sign-in error to the general error", () => {
    expect(
      authReturnRedirect(
        "/",
        params("error=server_error&error_code=unexpected_failure"),
      ),
    ).toBe("/auth/error?reason=callback");
  });

  it("finishes sign-in when a one-time code lands on the home page", () => {
    expect(authReturnRedirect("/", params("code=abc123"))).toBe(
      "/auth/callback?code=abc123&next=%2Fdashboard",
    );
  });

  it("leaves normal requests alone", () => {
    expect(authReturnRedirect("/", params(""))).toBeNull();
    expect(authReturnRedirect("/sign-in", params("error=x"))).toBeNull();
    expect(authReturnRedirect("/w/bloom", params("code=abc"))).toBeNull();
  });
});

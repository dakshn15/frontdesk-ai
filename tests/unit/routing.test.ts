import { describe, expect, it } from "vitest";
import { routeDecision } from "@/lib/auth/routing";

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

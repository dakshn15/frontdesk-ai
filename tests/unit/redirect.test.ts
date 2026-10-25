import { describe, expect, it } from "vitest";
import { authCallbackUrl, safeRedirectPath } from "@/lib/auth/redirect";

const site = "http://localhost:3300";

describe("safeRedirectPath", () => {
  it.each([
    ["/w/bloom", "/w/bloom"],
    ["/invite/abc?x=1", "/invite/abc?x=1"],
    ["http://localhost:3300/invite/abc", "/invite/abc"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["https://evil.com/w/x", "/dashboard"],
    ["http://localhost:3300.evil.com/w/x", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["w/bloom", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
    [undefined, "/dashboard"],
  ])("safeRedirectPath(%j) gives %s", (next, expected) => {
    expect(safeRedirectPath(next, site)).toBe(expected);
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("//evil.com", site, "/onboarding")).toBe(
      "/onboarding",
    );
  });
});

// Auth emails send people to /auth/callback, which signs them in (with Supabase's one-time
// code, or the session the token-hash link already created) and then continues to `next`.
describe("authCallbackUrl", () => {
  it.each([
    [undefined, "http://localhost:3300/auth/callback?next=%2Fdashboard"],
    ["/invite/abc", "http://localhost:3300/auth/callback?next=%2Finvite%2Fabc"],
    [
      "/account/update-password",
      "http://localhost:3300/auth/callback?next=%2Faccount%2Fupdate-password",
    ],
    ["//evil.com", "http://localhost:3300/auth/callback?next=%2Fdashboard"],
    [
      "https://evil.com/x",
      "http://localhost:3300/auth/callback?next=%2Fdashboard",
    ],
  ])("authCallbackUrl(%j) gives %s", (next, expected) => {
    expect(authCallbackUrl(site, next)).toBe(expected);
  });
});

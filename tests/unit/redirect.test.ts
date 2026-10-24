import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";

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

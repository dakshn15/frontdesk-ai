import { describe, expect, it } from "vitest";
import { navItems } from "@/components/app-shell/nav-items";

describe("navItems", () => {
  it("hides Settings from staff", () => {
    expect(navItems("bloom", "staff").map((item) => item.label)).toEqual([
      "Overview",
      "Team",
    ]);
  });

  it("shows Settings to owners and admins", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(navItems("bloom", role).map((item) => item.href)).toEqual([
        "/w/bloom",
        "/w/bloom/team",
        "/w/bloom/settings",
      ]);
    }
  });
});

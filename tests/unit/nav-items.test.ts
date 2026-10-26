import { describe, expect, it } from "vitest";
import { navItems } from "@/components/app-shell/nav-items";

describe("navItems", () => {
  it("shows staff the overview, calendar and team", () => {
    expect(navItems("bloom", "staff").map((item) => item.label)).toEqual([
      "Overview",
      "Calendar",
      "Team",
    ]);
  });

  it("shows owners and admins the business pages", () => {
    for (const role of ["owner", "admin"] as const) {
      const items = navItems("bloom", role);
      expect(items.map((item) => item.label)).toEqual([
        "Overview",
        "Calendar",
        "Services",
        "Staff",
        "Opening hours",
        "Policies",
        "Answers",
        "Knowledge",
        "Assistant",
        "Team",
        "Settings",
      ]);
      expect(items.map((item) => item.href)).toEqual([
        "/w/bloom",
        "/w/bloom/calendar",
        "/w/bloom/services",
        "/w/bloom/staff",
        "/w/bloom/hours",
        "/w/bloom/policies",
        "/w/bloom/answers",
        "/w/bloom/knowledge",
        "/w/bloom/assistant",
        "/w/bloom/team",
        "/w/bloom/settings",
      ]);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canDeleteWorkspace,
  canEditWorkspace,
  canManageTeam,
  canRemoveMember,
} from "@/features/workspaces/permissions";

describe("workspace permissions", () => {
  it("only owners and admins edit and manage the team; only owners delete", () => {
    expect([
      canEditWorkspace("owner"),
      canEditWorkspace("admin"),
      canEditWorkspace("staff"),
    ]).toEqual([true, true, false]);
    expect([
      canManageTeam("owner"),
      canManageTeam("admin"),
      canManageTeam("staff"),
    ]).toEqual([true, true, false]);
    expect([
      canDeleteWorkspace("owner"),
      canDeleteWorkspace("admin"),
      canDeleteWorkspace("staff"),
    ]).toEqual([true, false, false]);
  });

  it.each([
    ["owner", "staff", "admin", true],
    ["owner", "admin", "owner", true],
    ["owner", "owner", "admin", true],
    ["admin", "staff", "admin", true],
    ["admin", "admin", "staff", true],
    ["admin", "owner", "admin", false],
    ["admin", "staff", "owner", false],
    ["staff", "staff", "admin", false],
  ] as const)(
    "canChangeRole(%s changes %s to %s) is %s",
    (actor, target, next, expected) => {
      expect(canChangeRole(actor, target, next)).toBe(expected);
    },
  );

  it.each([
    ["staff", "staff", true, true],
    ["staff", "admin", false, false],
    ["admin", "staff", false, true],
    ["admin", "admin", false, true],
    ["admin", "owner", false, false],
    ["owner", "owner", false, true],
    ["owner", "admin", false, true],
  ] as const)(
    "canRemoveMember(%s removes %s, self=%s) is %s",
    (actor, target, isSelf, expected) => {
      expect(canRemoveMember(actor, target, isSelf)).toBe(expected);
    },
  );
});

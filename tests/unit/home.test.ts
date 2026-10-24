import { describe, expect, it } from "vitest";
import { pickHomeWorkspace } from "@/lib/auth/home";

const list = [{ slug: "north" }, { slug: "south" }];

describe("pickHomeWorkspace", () => {
  it("returns the last workspace when the user still belongs to it", () => {
    expect(pickHomeWorkspace(list, "south")).toBe("south");
  });

  it("falls back to the first workspace", () => {
    expect(pickHomeWorkspace(list, "gone")).toBe("north");
    expect(pickHomeWorkspace(list, undefined)).toBe("north");
  });

  it("returns null when there are no workspaces", () => {
    expect(pickHomeWorkspace([], "south")).toBeNull();
  });
});

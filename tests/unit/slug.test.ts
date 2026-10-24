import { describe, expect, it } from "vitest";
import { slugify, withRandomSuffix } from "@/features/workspaces/slug";

describe("slugify", () => {
  it.each([
    ["Bloom Hair & Beauty", "bloom-hair-beauty"],
    ["Café Lumière", "cafe-lumiere"],
    ["  --Hello--  ", "hello"],
    ["Nail   Bar 24/7", "nail-bar-24-7"],
    ["美容室", "workspace"],
    ["Hi", "workspace"],
    ["A".repeat(60), "a".repeat(40)],
    ["abcdefghi ".repeat(6), "abcdefghi-abcdefghi-abcdefghi-abcdefghi"],
  ])("slugify(%j) gives %s", (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });
});

describe("withRandomSuffix", () => {
  it("adds a 4-character suffix", () => {
    expect(withRandomSuffix("bloom-hair-beauty")).toMatch(
      /^bloom-hair-beauty-[a-z0-9]{4}$/,
    );
  });

  it("stays within 48 characters and never leaves a double hyphen", () => {
    const long = withRandomSuffix("a".repeat(48));
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long).toMatch(/^a+-[a-z0-9]{4}$/);
    expect(withRandomSuffix(`${"a".repeat(42)}-b`)).toMatch(
      /^a{42}-[a-z0-9]{4}$/,
    );
  });
});

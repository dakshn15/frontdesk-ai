import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  parseWebsite,
  workspaceDetailsSchema,
} from "@/features/workspaces/schemas";

describe("parseWebsite", () => {
  it.each([
    ["", { ok: true, value: null }],
    ["  ", { ok: true, value: null }],
    ["bloomsalon.com", { ok: true, value: "https://bloomsalon.com" }],
    ["http://bloom.com/about", { ok: true, value: "http://bloom.com/about" }],
    ["not a url", { ok: false }],
    ["ftp://bloom.com", { ok: false }],
    ["javascript:alert(1)", { ok: false }],
    ["localhost", { ok: false }],
  ])("parseWebsite(%j)", (input, expected) => {
    expect(parseWebsite(input)).toEqual(expected);
  });
});

describe("workspaceDetailsSchema", () => {
  it("normalises valid details", () => {
    expect(
      workspaceDetailsSchema.parse({
        name: " Bloom ",
        website: "",
        timezone: "America/Chicago",
        currency: "usd",
      }),
    ).toEqual({
      name: "Bloom",
      website: null,
      timezone: "America/Chicago",
      currency: "USD",
    });
  });

  it("accepts UTC", () => {
    expect(
      workspaceDetailsSchema.safeParse({
        name: "Bloom",
        website: "",
        timezone: "UTC",
        currency: "GBP",
      }).success,
    ).toBe(true);
  });

  it("rejects bad details with the exact messages", () => {
    const r = workspaceDetailsSchema.safeParse({
      name: "B",
      website: "nope",
      timezone: "Mars/Olympus",
      currency: "ABC",
    });
    expect(z.flattenError(r.error!).fieldErrors).toEqual({
      name: ["Use 2 to 80 characters."],
      website: ["Enter a full website address, like bloomsalon.com."],
      timezone: ["Choose a time zone from the list."],
      currency: ["Choose a currency from the list."],
    });
  });
});

import { describe, expect, it } from "vitest";
import { formatPrice, parsePrice } from "@/lib/money";

describe("parsePrice", () => {
  it.each([
    ["45", "USD", { ok: true, cents: 4500 }],
    ["$45.50", "USD", { ok: true, cents: 4550 }],
    ["1,200", "USD", { ok: true, cents: 120000 }],
    [" ", "USD", { ok: true, cents: null }],
    ["4500", "JPY", { ok: true, cents: 4500 }],
    ["45.5", "JPY", { ok: false }],
    ["-5", "USD", { ok: false }],
    ["45.505", "USD", { ok: false }],
    ["abc", "USD", { ok: false }],
    ["1000001", "USD", { ok: false }],
  ])("parsePrice(%j, %s)", (input, currency, expected) => {
    expect(parsePrice(input, currency)).toEqual(expected);
  });
});

describe("formatPrice", () => {
  it.each([
    [18000, "USD", false, "$180"],
    [4550, "USD", false, "$45.50"],
    [18000, "USD", true, "From $180"],
    [null, "USD", false, "No price listed"],
    [4500, "JPY", false, "¥4,500"],
  ] as const)(
    "formatPrice(%j, %s, from=%s) is %s",
    (cents, currency, isFrom, expected) => {
      expect(formatPrice(cents, currency, isFrom)).toBe(expected);
    },
  );
});

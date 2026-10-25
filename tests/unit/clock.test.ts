import { describe, expect, it } from "vitest";
import {
  clockToMinutes,
  formatClock,
  minutesToClock,
  zonedDateTimeToUtc,
} from "@/lib/clock";

describe("clock helpers", () => {
  it("converts minutes to and from HH:MM", () => {
    expect(minutesToClock(570)).toBe("09:30");
    expect(minutesToClock(1440)).toBe("24:00");
    expect(clockToMinutes("09:30")).toBe(570);
    expect(clockToMinutes("9:30")).toBe(570);
    expect(clockToMinutes("24:00")).toBe(1440);
    expect(clockToMinutes("24:30")).toBeNull();
    expect(clockToMinutes("ab")).toBeNull();
  });

  it("formats times for people", () => {
    expect(formatClock(570)).toBe("9:30 AM");
    expect(formatClock(780)).toBe("1:00 PM");
    expect(formatClock(0)).toBe("12:00 AM");
  });
});

describe("zonedDateTimeToUtc", () => {
  // US daylight saving ends on 1 November 2026: 31 Oct is UTC-5, 2 Nov is UTC-6.
  it("uses the business's offset on each side of a daylight-saving change", () => {
    expect(
      zonedDateTimeToUtc(
        "2026-10-31",
        "09:00",
        "America/Chicago",
      ).toISOString(),
    ).toBe("2026-10-31T14:00:00.000Z");
    expect(
      zonedDateTimeToUtc(
        "2026-11-02",
        "09:00",
        "America/Chicago",
      ).toISOString(),
    ).toBe("2026-11-02T15:00:00.000Z");
  });

  it("handles half-hour offsets", () => {
    expect(
      zonedDateTimeToUtc("2026-10-31", "09:00", "Asia/Kolkata").toISOString(),
    ).toBe("2026-10-31T03:30:00.000Z");
  });
});

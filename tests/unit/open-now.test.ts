import { describe, expect, it } from "vitest";
import { isOpenAt } from "@/features/inbox/open-now";

const TZ = "America/Chicago";
// Monday to Friday, 9:00 to 17:00.
const hours = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 540,
  endMinute: 1020,
}));

describe("isOpenAt", () => {
  it("is open inside the day's hours in the business's time zone", () => {
    // Monday 26 October 2026, 10:00 in Chicago (15:00 UTC).
    expect(isOpenAt(hours, [], TZ, new Date("2026-10-26T15:00:00Z"))).toBe(
      true,
    );
    // 8:59 and 17:00 are outside.
    expect(isOpenAt(hours, [], TZ, new Date("2026-10-26T13:59:00Z"))).toBe(
      false,
    );
    expect(isOpenAt(hours, [], TZ, new Date("2026-10-26T22:00:00Z"))).toBe(
      false,
    );
  });

  it("is closed at weekends and on closed days", () => {
    // Sunday 25 October, 10:00.
    expect(isOpenAt(hours, [], TZ, new Date("2026-10-25T15:00:00Z"))).toBe(
      false,
    );
    expect(
      isOpenAt(hours, ["2026-10-26"], TZ, new Date("2026-10-26T15:00:00Z")),
    ).toBe(false);
  });

  it("counts as open when no hours are set, rather than guessing", () => {
    expect(isOpenAt([], [], TZ, new Date("2026-10-25T03:00:00Z"))).toBe(true);
  });
});

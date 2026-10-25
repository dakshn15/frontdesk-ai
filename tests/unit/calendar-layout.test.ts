import { describe, expect, it } from "vitest";
import {
  blockPosition,
  gridRange,
  localMinutes,
} from "@/features/bookings/calendar-layout";

describe("gridRange", () => {
  it("defaults to 9 to 5 when nobody works and nothing is booked", () => {
    expect(gridRange([], [])).toEqual({ start: 540, end: 1020 });
  });

  it("covers every working range and booking, rounded out to whole hours", () => {
    expect(
      gridRange(
        [
          { start: 570, end: 1050 },
          { start: 600, end: 840 },
        ],
        [{ start: 1080, end: 1125 }],
      ),
    ).toEqual({ start: 540, end: 1140 });
  });
});

describe("blockPosition", () => {
  it("places a block by its share of the visible range", () => {
    const range = { start: 540, end: 1020 };
    expect(blockPosition(range, 600, 660)).toEqual({ top: 12.5, height: 12.5 });
  });

  it("clips blocks that start before or end after the range", () => {
    const range = { start: 540, end: 600 };
    expect(blockPosition(range, 500, 660)).toEqual({ top: 0, height: 100 });
  });
});

describe("localMinutes", () => {
  it("reads minutes since midnight in the business's time zone", () => {
    expect(
      localMinutes(new Date("2026-11-02T15:30:00Z"), "America/Chicago"),
    ).toBe(570);
  });
});

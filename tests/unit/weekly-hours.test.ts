import { describe, expect, it } from "vitest";
import {
  emptyWeek,
  parseWeeklyHours,
  rowsToWeek,
  type TimeRange,
  weekToRows,
} from "@/features/hours/weekly-hours";

const monday = (ranges: TimeRange[]) =>
  JSON.stringify({ ...emptyWeek(), 1: ranges });

describe("parseWeeklyHours", () => {
  it("accepts a day with a break and sorts the ranges", () => {
    const result = parseWeeklyHours(
      monday([
        { start: 780, end: 1020 },
        { start: 540, end: 720 },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      hours: {
        ...emptyWeek(),
        1: [
          { start: 540, end: 720 },
          { start: 780, end: 1020 },
        ],
      },
    });
  });

  it("allows back-to-back ranges", () => {
    expect(
      parseWeeklyHours(
        monday([
          { start: 540, end: 720 },
          { start: 720, end: 780 },
        ]),
      ).ok,
    ).toBe(true);
  });

  it.each([
    [
      [
        { start: 540, end: 720 },
        { start: 660, end: 840 },
      ],
      "Times on the same day can't overlap.",
    ],
    [[{ start: 780, end: 720 }], "End time must be after start time."],
    [[{ start: -10, end: 60 }], "Use times between 00:00 and 24:00."],
    [[{ start: 60, end: 1450 }], "Use times between 00:00 and 24:00."],
    [
      [
        { start: 0, end: 60 },
        { start: 120, end: 180 },
        { start: 240, end: 300 },
        { start: 360, end: 420 },
        { start: 480, end: 540 },
      ],
      "Add up to 4 time ranges a day.",
    ],
  ])("refuses %j", (ranges, error) => {
    expect(parseWeeklyHours(monday(ranges))).toEqual({ ok: false, error });
  });

  it("refuses input it can't read", () => {
    const unreadable = {
      ok: false,
      error: "Those hours couldn't be read. Try again.",
    };
    expect(parseWeeklyHours("not json")).toEqual(unreadable);
    const missingSunday: Record<string, unknown> = { ...emptyWeek() };
    delete missingSunday["7"];
    expect(parseWeeklyHours(JSON.stringify(missingSunday))).toEqual(unreadable);
  });
});

describe("weekToRows and rowsToWeek", () => {
  it("round-trip a week, sorting each day's ranges", () => {
    const week = {
      ...emptyWeek(),
      2: [{ start: 780, end: 1080 }, { start: 540, end: 720 }],
      7: [{ start: 600, end: 1440 }],
    };
    const rows = weekToRows(week);
    expect(rows).toEqual([
      { weekday: 2, startMinute: 780, endMinute: 1080 },
      { weekday: 2, startMinute: 540, endMinute: 720 },
      { weekday: 7, startMinute: 600, endMinute: 1440 },
    ]);
    expect(rowsToWeek(rows)).toEqual({
      ...emptyWeek(),
      2: [{ start: 540, end: 720 }, { start: 780, end: 1080 }],
      7: [{ start: 600, end: 1440 }],
    });
  });
});

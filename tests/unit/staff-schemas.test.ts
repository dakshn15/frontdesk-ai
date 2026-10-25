import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  staffProfileSchema,
  staffServicesSchema,
  timeOffRange,
  timeOffSchema,
} from "@/features/staff/schemas";

describe("staffProfileSchema", () => {
  it("reads the profile form", () => {
    expect(
      staffProfileSchema.parse({
        name: " Maya Chen ",
        title: "Senior stylist",
        userId: "",
        active: "on",
      }),
    ).toEqual({
      name: "Maya Chen",
      title: "Senior stylist",
      bio: "",
      userId: null,
      active: true,
    });
  });
});

describe("staffServicesSchema", () => {
  it("refuses ids that aren't ids", () => {
    expect(
      staffServicesSchema.safeParse({ serviceIds: ["not-a-uuid"] }).success,
    ).toBe(false);
  });
});

describe("timeOffSchema", () => {
  const errors = (input: Record<string, string>) =>
    z.flattenError(timeOffSchema.safeParse(input).error!).fieldErrors;

  it("refuses an end before the start", () => {
    expect(
      errors({ startDate: "2026-12-26", endDate: "2026-12-24", allDay: "on" }),
    ).toEqual({ endDate: ["End must be after start."] });
    expect(
      errors({
        startDate: "2026-12-24",
        endDate: "2026-12-24",
        startTime: "14:00",
        endTime: "10:00",
      }),
    ).toEqual({ endDate: ["End must be after start."] });
  });

  it("needs times when it isn't all day", () => {
    expect(errors({ startDate: "2026-12-24", endDate: "2026-12-24" })).toEqual({
      startTime: ["Add a start and end time, or choose All day."],
    });
  });
});

describe("timeOffRange", () => {
  it("covers whole days in the business's time zone", () => {
    const input = timeOffSchema.parse({
      startDate: "2026-12-24",
      endDate: "2026-12-26",
      allDay: "on",
      note: "Holiday",
    });
    const range = timeOffRange(input, "America/Chicago");
    expect(range.startsAt.toISOString()).toBe("2026-12-24T06:00:00.000Z");
    expect(range.endsAt.toISOString()).toBe("2026-12-27T06:00:00.000Z");
  });

  it("uses the given times otherwise", () => {
    const input = timeOffSchema.parse({
      startDate: "2026-12-24",
      endDate: "2026-12-24",
      startTime: "13:00",
      endTime: "17:30",
    });
    const range = timeOffRange(input, "America/Chicago");
    expect(range.startsAt.toISOString()).toBe("2026-12-24T19:00:00.000Z");
    expect(range.endsAt.toISOString()).toBe("2026-12-24T23:30:00.000Z");
  });
});

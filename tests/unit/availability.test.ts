import { describe, expect, it } from "vitest";
import {
  availableSlots,
  type BookingRules,
  DEFAULT_BOOKING_RULES,
  occupiedUntil,
  type StaffAvailability,
} from "@/features/bookings/availability";
import { emptyWeek } from "@/features/hours/weekly-hours";
import { zonedDateTimeToUtc } from "@/lib/clock";

const TZ = "America/Chicago";
// Monday 2 November 2026, Chicago (UTC-6 after the clocks change on 1 November).
const DATE = "2026-11-02";
const at = (time: string, date = DATE) => zonedDateTimeToUtc(date, time, TZ);
const local = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const mondays = (ranges: { start: number; end: number }[]) => ({
  ...emptyWeek(),
  1: ranges,
  7: ranges,
});

function staffMember(
  staffId: string,
  ranges = [{ start: 540, end: 720 }],
  blocked: StaffAvailability["blocked"] = [],
): StaffAvailability {
  return { staffId, hours: mondays(ranges), blocked };
}

const RULES: BookingRules = { ...DEFAULT_BOOKING_RULES, minNoticeMinutes: 0 };
const EARLY = new Date("2026-10-30T12:00:00Z");

function slots(
  overrides: Partial<Parameters<typeof availableSlots>[0]> = {},
): string[] {
  return availableSlots({
    date: DATE,
    timeZone: TZ,
    durationMinutes: 60,
    bufferMinutes: 0,
    staff: [staffMember("maya")],
    closedDates: [],
    rules: RULES,
    now: EARLY,
    ...overrides,
  }).map((slot) => `${slot.staffId} ${local(slot.startsAt)}`);
}

describe("availableSlots", () => {
  it("steps through working hours while the service fits", () => {
    expect(slots()).toEqual([
      "maya 09:00",
      "maya 09:15",
      "maya 09:30",
      "maya 09:45",
      "maya 10:00",
      "maya 10:15",
      "maya 10:30",
      "maya 10:45",
      "maya 11:00",
    ]);
  });

  it("uses the business's step and leaves out a break", () => {
    const split = [
      { start: 540, end: 720 },
      { start: 780, end: 900 },
    ];
    expect(
      slots({
        staff: [staffMember("maya", split)],
        rules: { ...RULES, slotStepMinutes: 60 },
      }),
    ).toEqual([
      "maya 09:00",
      "maya 10:00",
      "maya 11:00",
      "maya 13:00",
      "maya 14:00",
    ]);
  });

  it("keeps the buffer clear of time off and other bookings", () => {
    const booked = {
      start: at("10:00"),
      end: occupiedUntil(at("10:00"), 60, 15),
    };
    const result = slots({
      bufferMinutes: 15,
      rules: { ...RULES, slotStepMinutes: 30 },
      staff: [staffMember("maya", [{ start: 540, end: 780 }], [booked])],
    });
    // 09:00 + 60 + 15 runs to 10:15, into the 10:00 booking; 11:00 is free only from 11:15.
    expect(result).toEqual(["maya 11:30", "maya 12:00"]);
  });

  it("gives nothing on a closed date or when the service is too long", () => {
    expect(slots({ closedDates: [DATE] })).toEqual([]);
    expect(slots({ durationMinutes: 240 })).toEqual([]);
  });

  it("applies minimum notice and days ahead, unless told to ignore them", () => {
    const now = at("09:40");
    expect(slots({ now, rules: { ...RULES, minNoticeMinutes: 60 } })).toEqual([
      "maya 10:45",
      "maya 11:00",
    ]);
    expect(
      slots({
        now,
        rules: { ...RULES, minNoticeMinutes: 60 },
        ignoreWindow: true,
      }),
    ).toHaveLength(9);
    // Booking opens 60 days ahead: 2 November is too far from 1 September.
    const september = new Date("2026-09-01T15:00:00Z");
    expect(slots({ now: september })).toEqual([]);
    expect(slots({ now: september, ignoreWindow: true })).toHaveLength(9);
  });

  it("lists several staff in time order", () => {
    const result = slots({
      rules: { ...RULES, slotStepMinutes: 60 },
      staff: [
        staffMember("maya", [{ start: 600, end: 720 }]),
        staffMember("jo", [{ start: 540, end: 660 }]),
      ],
    });
    expect(result).toEqual([
      "jo 09:00",
      "maya 10:00",
      "jo 10:00",
      "maya 11:00",
    ]);
  });

  it("uses local times on the day the clocks change", () => {
    // Sunday 1 November 2026: Chicago goes from UTC-5 to UTC-6 at 02:00.
    const [first] = availableSlots({
      date: "2026-11-01",
      timeZone: TZ,
      durationMinutes: 60,
      bufferMinutes: 0,
      staff: [staffMember("maya")],
      closedDates: [],
      rules: RULES,
      now: EARLY,
    });
    expect(first.startsAt.toISOString()).toBe("2026-11-01T15:00:00.000Z");
  });
});

describe("occupiedUntil", () => {
  it("adds the duration and buffer", () => {
    expect(
      occupiedUntil(new Date("2026-11-02T15:00:00Z"), 60, 15).toISOString(),
    ).toBe("2026-11-02T16:15:00.000Z");
  });
});

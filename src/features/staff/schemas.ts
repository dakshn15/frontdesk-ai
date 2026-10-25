import { z } from "zod";
import { zonedDateTimeToUtc } from "@/lib/clock";

const NAME_ERROR = "Use 2 to 80 characters.";
const ORDER_ERROR = "End must be after start.";
const TIMES_ERROR = "Add a start and end time, or choose All day.";

const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

export const staffProfileSchema = z.object({
  name: z
    .string({ error: NAME_ERROR })
    .trim()
    .min(2, { error: NAME_ERROR })
    .max(80, { error: NAME_ERROR }),
  title: z
    .string()
    .trim()
    .max(60, { error: "Use 60 characters or fewer." })
    .default(""),
  bio: z
    .string()
    .trim()
    .max(600, { error: "Use 600 characters or fewer." })
    .default(""),
  // "" means "Not linked".
  userId: z
    .union([z.literal(""), z.uuid()])
    .default("")
    .transform((value) => value || null),
  active: checkbox,
});

export type StaffProfile = z.output<typeof staffProfileSchema>;

export const staffServicesSchema = z.object({
  serviceIds: z.array(
    z.uuid({ error: "Those services couldn't be read. Try again." }),
  ),
});

const time = z
  .string()
  .default("")
  .transform((value) => value.trim() || null)
  .refine((value) => value === null || /^\d{2}:\d{2}$/.test(value), {
    error: TIMES_ERROR,
  });

export const timeOffSchema = z
  .object({
    startDate: z.iso.date({ error: "Pick a start date." }),
    endDate: z.iso.date({ error: "Pick an end date." }),
    allDay: checkbox,
    startTime: time,
    endTime: time,
    note: z
      .string()
      .trim()
      .max(120, { error: "Use 120 characters or fewer." })
      .default(""),
  })
  .superRefine((value, ctx) => {
    if (value.allDay) {
      if (value.endDate < value.startDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: ORDER_ERROR,
        });
      }
      return;
    }
    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: TIMES_ERROR,
      });
      return;
    }
    // ISO dates and HH:MM times compare correctly as text.
    if (
      `${value.endDate} ${value.endTime}` <=
      `${value.startDate} ${value.startTime}`
    ) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: ORDER_ERROR });
    }
  });

export type TimeOffInput = z.output<typeof timeOffSchema>;

function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

/** The exact start and end of a time-off entry, in the business's time zone. All day runs to midnight after the end date. */
export function timeOffRange(
  input: TimeOffInput,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  if (input.allDay) {
    return {
      startsAt: zonedDateTimeToUtc(input.startDate, "00:00", timeZone),
      endsAt: zonedDateTimeToUtc(nextDay(input.endDate), "00:00", timeZone),
    };
  }
  return {
    startsAt: zonedDateTimeToUtc(input.startDate, input.startTime!, timeZone),
    endsAt: zonedDateTimeToUtc(input.endDate, input.endTime!, timeZone),
  };
}

import { describe, expect, it } from "vitest";
import {
  bookingRulesSchema,
  customerSchema,
  newBookingSchema,
} from "@/features/bookings/schemas";

describe("booking schemas", () => {
  it("lower-cases a customer's email and trims the rest", () => {
    expect(
      customerSchema.parse({
        name: " Ana Ruiz ",
        email: " Ana@Example.COM ",
        phone: " 512 555 0100 ",
      }),
    ).toEqual({
      name: "Ana Ruiz",
      email: "ana@example.com",
      phone: "512 555 0100",
    });
    expect(
      customerSchema.safeParse({ name: "Ana", email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("reads a slot's start as a UTC instant and accepts any available", () => {
    const parsed = newBookingSchema.parse({
      serviceId: "5b0c1f2e-8d5a-4b63-9a39-2f6f9d0c7e11",
      staffId: "any",
      startsAt: "2026-11-02T15:00:00.000Z",
    });
    expect(parsed.startsAt.toISOString()).toBe("2026-11-02T15:00:00.000Z");
    expect(parsed.notes).toBe("");
  });

  it("stores notice in minutes and refuses steps that aren't offered", () => {
    expect(
      bookingRulesSchema.parse({
        slotStepMinutes: "30",
        minNoticeHours: "2",
        maxDaysAhead: "90",
        cancellationWindowHours: "24",
      }),
    ).toEqual({
      slotStepMinutes: 30,
      minNoticeMinutes: 120,
      maxDaysAhead: 90,
      cancellationWindowHours: 24,
    });
    expect(
      bookingRulesSchema.safeParse({
        slotStepMinutes: "7",
        minNoticeHours: "2",
        maxDaysAhead: "90",
        cancellationWindowHours: "24",
      }).success,
    ).toBe(false);
  });
});

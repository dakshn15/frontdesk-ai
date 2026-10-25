import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { bookings, emailLog } from "@/db/schema";
import { localMinutes } from "@/features/bookings/calendar-layout";
import {
  cancelBookingRecord,
  createBookingRecord,
  rescheduleBookingRecord,
} from "@/features/bookings/records";
import { sendDueReminders } from "@/jobs/reminders";
import {
  claimsFor,
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  linkTestStaffService,
  setTestStaffHours,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

const TZ = "America/Chicago";
const HOUR = 3_600_000;

/** A quarter-hour start about `hours` from now, before 23:00 local so a 60-minute slot fits. */
function startAbout(hours: number): Date {
  const quarter = 15 * 60_000;
  let start = new Date(
    Math.ceil((Date.now() + hours * HOUR) / quarter) * quarter,
  );
  if (localMinutes(start, TZ) >= 23 * 60)
    start = new Date(start.getTime() + 2 * HOUR);
  return start;
}

async function salon() {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Bloom Studio" });
  const { id: cut } = await createTestService(ws.id, owner, { name: "Cut" });
  const { id: maya } = await createTestStaff(ws.id, owner, { name: "Maya" });
  await setTestStaffHours(
    ws.id,
    owner,
    maya,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMinute: 0,
      endMinute: 1440,
    })),
  );
  await linkTestStaffService(ws.id, owner, maya, cut);
  return { owner, ws, cut, maya };
}

async function book(
  owner: TestUser,
  wsId: string,
  cut: string,
  maya: string,
  startsAt: Date,
) {
  const result = await createBookingRecord(claimsFor(owner), wsId, {
    serviceId: cut,
    staffId: maya,
    startsAt,
    customer: { name: "Ana Ruiz", email: "ana@example.com", phone: "" },
    notes: "",
  });
  if (!result.ok)
    throw new Error(`${result.error} at ${startsAt.toISOString()}`);
  return result.id;
}

async function reminders(bookingId: string) {
  return adminDb
    .select({ subject: emailLog.subject, text: emailLog.text })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.bookingId, bookingId),
        eq(emailLog.kind, "booking_reminder"),
      ),
    );
}

describe("sendDueReminders", () => {
  it("reminds bookings 12 to 36 hours away, once, and skips cancelled ones", async () => {
    const { owner, ws, cut, maya } = await salon();
    const tomorrow = await book(owner, ws.id, cut, maya, startAbout(24));
    const later = await book(owner, ws.id, cut, maya, startAbout(48));
    const soon = await book(owner, ws.id, cut, maya, startAbout(6));
    const cancelled = await book(owner, ws.id, cut, maya, startAbout(20));
    await cancelBookingRecord(claimsFor(owner), ws.id, cancelled);

    await sendDueReminders();
    await sendDueReminders();

    const [reminder, ...extra] = await reminders(tomorrow);
    expect(extra).toEqual([]);
    expect(reminder.subject).toBe(
      "Your appointment at Bloom Studio is coming up",
    );
    expect(reminder.text).toContain("use the link in your booking email");
    for (const id of [later, soon, cancelled]) {
      expect(await reminders(id)).toEqual([]);
    }
  });

  it("a moved booking is reminded again for its new time", async () => {
    const { owner, ws, cut, maya } = await salon();
    const id = await book(owner, ws.id, cut, maya, startAbout(24));
    await sendDueReminders();
    expect(
      await rescheduleBookingRecord(claimsFor(owner), ws.id, id, {
        staffId: maya,
        startsAt: startAbout(27),
      }),
    ).toBe("ok");
    const [row] = await adminDb
      .select({ reminderSentAt: bookings.reminderSentAt })
      .from(bookings)
      .where(eq(bookings.id, id));
    expect(row.reminderSentAt).toBeNull();
    await sendDueReminders();
    expect(await reminders(id)).toHaveLength(2);
  });
});

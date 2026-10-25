import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { bookings, emailLog, staff } from "@/db/schema";
import { createBookingRecord } from "@/features/bookings/records";
import { resetCalendarTokenRecord } from "@/features/staff/records";
import {
  addDays,
  isoWeekday,
  localDate,
  zonedDateTimeToUtc,
} from "@/lib/clock";
import { createSecretToken } from "@/lib/secret-token";
import { sendBookingEmail } from "@/privileged/booking-emails";
import { staffCalendarFeed } from "@/privileged/calendar-feed";
import { sendEmail } from "@/privileged/mailer";
import {
  cancelManagedBooking,
  getManagedBooking,
  rescheduleManagedBooking,
} from "@/privileged/manage";
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

/** A Monday one to two weeks from now: inside the default 60-day booking window. */
function comingMonday(): string {
  let date = addDays(localDate(TZ), 7);
  while (isoWeekday(date) !== 1) date = addDays(date, 1);
  return date;
}
const DATE = comingMonday();
const at = (time: string) => zonedDateTimeToUtc(DATE, time, TZ);

async function salon() {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Bloom Studio" });
  const { id: cut } = await createTestService(ws.id, owner, { name: "Cut" });
  const people: Record<string, string> = {};
  for (const name of ["Maya", "Jo"]) {
    const { id } = await createTestStaff(ws.id, owner, { name });
    await setTestStaffHours(ws.id, owner, id, [
      { weekday: 1, startMinute: 540, endMinute: 1020 },
    ]);
    await linkTestStaffService(ws.id, owner, id, cut);
    people[name] = id;
  }
  return { owner, ws, cut, maya: people.Maya, jo: people.Jo };
}

async function book(
  owner: TestUser,
  wsId: string,
  serviceId: string,
  staffId: string,
  startsAt: Date,
) {
  const result = await createBookingRecord(claimsFor(owner), wsId, {
    serviceId,
    staffId,
    startsAt,
    customer: { name: "Ana Ruiz", email: "ana@example.com", phone: "" },
    notes: "",
  });
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function emailsFor(bookingId: string) {
  return adminDb
    .select()
    .from(emailLog)
    .where(eq(emailLog.bookingId, bookingId))
    .orderBy(emailLog.createdAt);
}

describe("emails", () => {
  it("logs an email it can't send when no provider key is set", async () => {
    const { ws } = await salon();
    expect(
      await sendEmail({
        workspaceId: ws.id,
        kind: "test",
        to: "ana@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    ).toBe("not_sent");
    const [row] = await adminDb
      .select({ status: emailLog.status, kind: emailLog.kind })
      .from(emailLog)
      .where(eq(emailLog.workspaceId, ws.id));
    expect(row).toEqual({ status: "not_sent", kind: "test" });
  });

  it("a confirmation carries a manage link that opens the booking", async () => {
    const { owner, ws, cut, maya } = await salon();
    const booked = await book(owner, ws.id, cut, maya, at("09:00"));
    await sendBookingEmail({
      bookingId: booked.id,
      kind: "confirmed",
      manageToken: booked.manageToken,
    });
    const [email] = await emailsFor(booked.id);
    expect(email).toMatchObject({
      kind: "booking_confirmed",
      toEmail: "ana@example.com",
      subject: "Your appointment at Bloom Studio is booked",
    });
    expect(email.text).toContain(`/b/${booked.manageToken}`);
    expect(email.text).toContain("Cut with Maya");

    const view = await getManagedBooking(booked.manageToken);
    expect(view).toMatchObject({
      business: "Bloom Studio",
      serviceName: "Cut",
      staffName: "Maya",
      state: "open",
    });
    expect(await getManagedBooking("not-a-real-token")).toBeNull();
  });
});

describe("manage links", () => {
  it("cancels once, then shows the booking as cancelled", async () => {
    const { owner, ws, cut, maya } = await salon();
    const booked = await book(owner, ws.id, cut, maya, at("09:00"));
    expect(await cancelManagedBooking(booked.manageToken)).toBe("ok");
    expect(await getManagedBooking(booked.manageToken)).toMatchObject({
      state: "cancelled",
    });
    expect(await cancelManagedBooking(booked.manageToken)).toBe("not_allowed");
    const kinds = (await emailsFor(booked.id)).map((e) => e.kind);
    expect(kinds).toEqual(["booking_cancelled"]);
  });

  it("refuses changes inside the cancellation window and after the start", async () => {
    const { ws, maya } = await salon();
    const soon = createSecretToken();
    const past = createSecretToken();
    const row = (startsAt: Date, hash: string) => ({
      workspaceId: ws.id,
      staffId: maya,
      serviceName: "Cut",
      staffName: "Maya",
      durationMinutes: 60,
      bufferMinutes: 0,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
      occupiedUntil: new Date(startsAt.getTime() + 3_600_000),
      source: "dashboard" as const,
      manageTokenHash: hash,
    });
    const now = Date.now();
    await adminDb
      .insert(bookings)
      .values([
        row(new Date(now + 3 * 3_600_000), soon.hash),
        row(new Date(now - 48 * 3_600_000), past.hash),
      ]);
    expect(await getManagedBooking(soon.token)).toMatchObject({
      state: "too_late",
    });
    expect(await cancelManagedBooking(soon.token)).toBe("too_late");
    expect(await getManagedBooking(past.token)).toMatchObject({
      state: "passed",
    });
    expect(await cancelManagedBooking(past.token)).toBe("not_allowed");
  });

  it("reschedules only into free time and keeps the same link", async () => {
    const { owner, ws, cut, maya } = await salon();
    const a = await book(owner, ws.id, cut, maya, at("09:00"));
    await book(owner, ws.id, cut, maya, at("11:00"));
    expect(await rescheduleManagedBooking(a.manageToken, at("11:00"))).toBe(
      "slot_taken",
    );
    expect(await rescheduleManagedBooking(a.manageToken, at("13:00"))).toBe(
      "ok",
    );
    expect(await getManagedBooking(a.manageToken)).toMatchObject({
      startsAt: at("13:00"),
      state: "open",
    });
    const [moved] = await emailsFor(a.id);
    expect(moved.kind).toBe("booking_rescheduled");
    expect(moved.text).toContain(`/b/${a.manageToken}`);
  });
});

describe("calendar feeds", () => {
  it("shows only that person's confirmed bookings", async () => {
    const { owner, ws, cut, maya, jo } = await salon();
    const other = await salon();
    const mine = await book(owner, ws.id, cut, maya, at("09:00"));
    const theirs = await book(owner, ws.id, cut, jo, at("09:00"));
    const elsewhere = await book(
      other.owner,
      other.ws.id,
      other.cut,
      other.maya,
      at("10:00"),
    );
    const [{ token }] = await adminDb
      .select({ token: staff.calendarToken })
      .from(staff)
      .where(eq(staff.id, maya));
    const feed = await staffCalendarFeed(token);
    expect(feed).toContain(`UID:${mine.id}@frontdesk-ai`);
    expect(feed).not.toContain(theirs.id);
    expect(feed).not.toContain(elsewhere.id);
    expect(feed).toContain("X-WR-CALNAME:Maya at Bloom Studio");
    expect(await staffCalendarFeed("unknown")).toBeNull();
  });

  it("resetting the link stops the old one working", async () => {
    const { owner, ws, maya } = await salon();
    const [{ token: before }] = await adminDb
      .select({ token: staff.calendarToken })
      .from(staff)
      .where(and(eq(staff.id, maya), eq(staff.workspaceId, ws.id)));
    const after = await resetCalendarTokenRecord(claimsFor(owner), ws.id, maya);
    expect(after).toEqual(expect.any(String));
    expect(after).not.toBe(before);
    expect(await staffCalendarFeed(before)).toBeNull();
    expect(await staffCalendarFeed(after as string)).not.toBeNull();
  });
});

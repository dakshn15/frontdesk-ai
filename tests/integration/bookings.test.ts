import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import { getPgError } from "@/db/errors";
import { bookingEvents, bookings, services } from "@/db/schema";
import { listBookingsForDay } from "@/features/bookings/queries";
import {
  cancelBookingRecord,
  createBookingRecord,
  getSlotsRecord,
  rescheduleBookingRecord,
  setBookingStatusRecord,
} from "@/features/bookings/records";
import { deleteStaffRecord } from "@/features/staff/records";
import { zonedDateTimeToUtc } from "@/lib/clock";
import {
  addTestMember,
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
// A Monday well in the future, so "upcoming" checks hold for years.
const DATE = "2030-03-04";
const at = (time: string) => zonedDateTimeToUtc(DATE, time, TZ);
const MONDAY_9_TO_5 = [{ weekday: 1, startMinute: 540, endMinute: 1020 }];

async function pgErrorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return getPgError(err);
  }
  throw new Error("expected the query to fail");
}

async function bookableStaff(
  wsId: string,
  owner: TestUser,
  name: string,
  serviceId: string | null,
) {
  const { id } = await createTestStaff(wsId, owner, { name });
  await setTestStaffHours(wsId, owner, id, MONDAY_9_TO_5);
  if (serviceId) await linkTestStaffService(wsId, owner, id, serviceId);
  return id;
}

/** A salon with a 60-minute cut (15-minute buffer) that Maya and Jo do; Lee doesn't. */
async function salon() {
  const [owner, member, outsider] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  const { id: cut } = await createTestService(ws.id, owner, {
    name: "Cut",
    durationMinutes: 60,
    bufferMinutes: 15,
    priceCents: 4500,
  });
  const maya = await bookableStaff(ws.id, owner, "Maya", cut);
  const jo = await bookableStaff(ws.id, owner, "Jo", cut);
  const lee = await bookableStaff(ws.id, owner, "Lee", null);
  return { owner, member, outsider, ws, cut, maya, jo, lee };
}

const ana = { name: "Ana Ruiz", email: "Ana@Example.com", phone: "" };

function book(
  user: TestUser,
  wsId: string,
  input: { serviceId: string; staffId: string; startsAt: Date },
) {
  return createBookingRecord(claimsFor(user), wsId, {
    ...input,
    customer: ana,
    notes: "",
  });
}

/** A booking row written straight to the table, as a signed-in user. */
function rawInsert(
  user: TestUser,
  wsId: string,
  staffId: string,
  startsAt: Date,
  minutes: number,
) {
  const end = new Date(startsAt.getTime() + minutes * 60_000);
  return withRls(claimsFor(user), (tx) =>
    tx.insert(bookings).values({
      workspaceId: wsId,
      staffId,
      serviceName: "Cut",
      staffName: "Maya",
      durationMinutes: minutes,
      bufferMinutes: 0,
      startsAt,
      endsAt: end,
      occupiedUntil: end,
      source: "dashboard",
      manageTokenHash: crypto.randomUUID(),
    }),
  );
}

describe("bookings", () => {
  it("members book; outsiders can neither book nor see bookings", async () => {
    const { owner, member, outsider, ws, cut, maya } = await salon();
    const created = await book(member, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    expect(created).toMatchObject({
      ok: true,
      manageToken: expect.any(String),
    });

    const day = await listBookingsForDay(claimsFor(owner), ws.id, DATE, TZ);
    expect(day).toEqual([
      expect.objectContaining({
        staffId: maya,
        staffName: "Maya",
        serviceName: "Cut",
        customerName: "Ana Ruiz",
        customerEmail: "ana@example.com",
        status: "confirmed",
        startsAt: at("09:00"),
        endsAt: at("10:00"),
      }),
    ]);
    expect(
      await listBookingsForDay(claimsFor(outsider), ws.id, DATE, TZ),
    ).toEqual([]);
    expect(
      await book(outsider, ws.id, {
        serviceId: cut,
        staffId: maya,
        startsAt: at("11:00"),
      }),
    ).toEqual({ ok: false, error: "not_allowed" });
  });

  it("two bookings for the same slot at once: exactly one succeeds", async () => {
    const { owner, member, ws, cut, maya } = await salon();
    const input = { serviceId: cut, staffId: maya, startsAt: at("10:00") };
    const results = await Promise.all([
      book(owner, ws.id, input),
      book(member, ws.id, input),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error: "slot_taken",
    });
  });

  it("the database refuses overlaps including the buffer, but not cancelled bookings", async () => {
    const { owner, ws, cut, maya } = await salon();
    const first = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("10:00"),
    });
    if (!first.ok) throw new Error(first.error);
    // 10:00 + 60 minutes + 15 buffer blocks until 11:15.
    const err = await pgErrorOf(rawInsert(owner, ws.id, maya, at("11:00"), 30));
    expect(err?.code).toBe("23P01");
    expect(await cancelBookingRecord(claimsFor(owner), ws.id, first.id)).toBe(
      "ok",
    );
    await rawInsert(owner, ws.id, maya, at("11:00"), 30);
  });

  it("offers only free times", async () => {
    const { owner, ws, cut, maya } = await salon();
    await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    const slots = await getSlotsRecord(claimsFor(owner), ws.id, {
      serviceId: cut,
      staffId: maya,
      date: DATE,
    });
    // 09:00 + 60 + 15 runs to 10:15; the last start that ends by 17:00 is 16:00.
    expect(slots[0]).toEqual({
      staffId: maya,
      staffName: "Maya",
      startsAt: at("10:15"),
    });
    expect(slots.at(-1)?.startsAt).toEqual(at("16:00"));
  });

  it("any available goes to the less busy qualified person", async () => {
    const { owner, ws, cut, maya, jo } = await salon();
    await book(owner, ws.id, {
      serviceId: cut,
      staffId: jo,
      startsAt: at("09:00"),
    });
    const first = await book(owner, ws.id, {
      serviceId: cut,
      staffId: "any",
      startsAt: at("13:00"),
    });
    const second = await book(owner, ws.id, {
      serviceId: cut,
      staffId: "any",
      startsAt: at("13:00"),
    });
    const third = await book(owner, ws.id, {
      serviceId: cut,
      staffId: "any",
      startsAt: at("13:00"),
    });
    const day = await listBookingsForDay(claimsFor(owner), ws.id, DATE, TZ);
    const staffAt = (id: string) => day.find((b) => b.id === id)?.staffId;
    // Maya had no bookings and Jo one; Lee doesn't do cuts, so a third is refused.
    expect(first.ok && staffAt(first.id)).toBe(maya);
    expect(second.ok && staffAt(second.id)).toBe(jo);
    expect(third).toEqual({ ok: false, error: "slot_taken" });
  });

  it("rescheduling into a taken slot keeps the old time", async () => {
    const { owner, ws, cut, maya, jo } = await salon();
    const a = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("11:00"),
    });
    if (!a.ok) throw new Error(a.error);
    expect(
      await rescheduleBookingRecord(claimsFor(owner), ws.id, a.id, {
        staffId: maya,
        startsAt: at("11:00"),
      }),
    ).toBe("slot_taken");
    expect(
      await rescheduleBookingRecord(claimsFor(owner), ws.id, a.id, {
        staffId: jo,
        startsAt: at("11:00"),
      }),
    ).toBe("ok");
    const day = await listBookingsForDay(claimsFor(owner), ws.id, DATE, TZ);
    expect(day.find((b) => b.id === a.id)).toMatchObject({
      staffId: jo,
      staffName: "Jo",
      startsAt: at("11:00"),
    });
    const events = await adminDb
      .select({ kind: bookingEvents.kind })
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, a.id))
      .orderBy(bookingEvents.createdAt);
    expect(events.map((e) => e.kind)).toEqual(["created", "rescheduled"]);
  });

  it("keeps the service details from booking time", async () => {
    const { owner, ws, cut, maya } = await salon();
    const created = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    if (!created.ok) throw new Error(created.error);
    await adminDb
      .update(services)
      .set({ name: "Haircut", priceCents: 9900 })
      .where(eq(services.id, cut));
    const [row] = await adminDb
      .select()
      .from(bookings)
      .where(eq(bookings.id, created.id));
    expect(row).toMatchObject({
      serviceName: "Cut",
      priceCents: 4500,
      durationMinutes: 60,
      bufferMinutes: 15,
    });
  });

  it("status changes follow the rules", async () => {
    const { owner, ws, cut, maya } = await salon();
    const created = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    if (!created.ok) throw new Error(created.error);
    const claims = claimsFor(owner);
    expect(
      await setBookingStatusRecord(claims, ws.id, created.id, "completed"),
    ).toBe("ok");
    expect(await cancelBookingRecord(claims, ws.id, created.id)).toBe(
      "not_allowed",
    );
    expect(
      await setBookingStatusRecord(claims, ws.id, created.id, "no_show"),
    ).toBe("ok");
  });

  it("users can't move a booking to another workspace or change its price", async () => {
    const { owner, ws, cut, maya } = await salon();
    const other = await createTestWorkspace(owner);
    const created = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    if (!created.ok) throw new Error(created.error);
    for (const change of [{ workspaceId: other.id }, { priceCents: 1 }]) {
      const err = await pgErrorOf(
        withRls(claimsFor(owner), (tx) =>
          tx.update(bookings).set(change).where(eq(bookings.id, created.id)),
        ),
      );
      expect(err?.code).toBe("42501");
    }
  });

  it("staff with upcoming bookings can't be deleted; past bookings keep their name", async () => {
    const { owner, ws, cut, maya } = await salon();
    const upcoming = await book(owner, ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: at("09:00"),
    });
    if (!upcoming.ok) throw new Error(upcoming.error);
    expect(await deleteStaffRecord(claimsFor(owner), ws.id, maya)).toBe(
      "has_upcoming_bookings",
    );
    await cancelBookingRecord(claimsFor(owner), ws.id, upcoming.id);
    const past = new Date("2026-01-05T15:00:00Z");
    const [old] = await adminDb
      .insert(bookings)
      .values({
        workspaceId: ws.id,
        staffId: maya,
        serviceName: "Cut",
        staffName: "Maya",
        durationMinutes: 60,
        bufferMinutes: 0,
        startsAt: past,
        endsAt: new Date(past.getTime() + 3_600_000),
        occupiedUntil: new Date(past.getTime() + 3_600_000),
        status: "completed",
        source: "dashboard",
        manageTokenHash: crypto.randomUUID(),
      })
      .returning({ id: bookings.id });
    expect(await deleteStaffRecord(claimsFor(owner), ws.id, maya)).toBe("ok");
    const [kept] = await adminDb
      .select({ staffId: bookings.staffId, staffName: bookings.staffName })
      .from(bookings)
      .where(eq(bookings.id, old.id));
    expect(kept).toEqual({ staffId: null, staffName: "Maya" });
  });
});

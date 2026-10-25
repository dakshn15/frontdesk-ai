import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import { getPgError } from "@/db/errors";
import { businessHours, closedDays } from "@/db/schema";
import { emptyWeek } from "@/features/hours/weekly-hours";
import { getOpeningHours, listClosedDays } from "@/features/hours/queries";
import {
  addClosedDayRecord,
  deleteClosedDayRecord,
  replaceOpeningHoursRecord,
} from "@/features/hours/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

async function pgErrorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return getPgError(err);
  }
  throw new Error("expected the query to fail");
}

/** Today's date ("2026-10-25") in a time zone. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

async function ownerAndStaff() {
  const [owner, member] = await Promise.all([
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  return { owner, member, ws };
}

describe("opening hours", () => {
  it("staff can't replace opening hours", async () => {
    const { member, ws } = await ownerAndStaff();
    const week = { ...emptyWeek(), 2: [{ start: 540, end: 1080 }] };
    expect(
      await replaceOpeningHoursRecord(claimsFor(member), ws.id, week),
    ).toBe("not_allowed");
    expect(await getOpeningHours(claimsFor(member), ws.id)).toEqual(
      emptyWeek(),
    );
  });

  it("the database refuses overlapping ranges", async () => {
    const { owner, ws } = await ownerAndStaff();
    const err = await pgErrorOf(
      withRls(claimsFor(owner), (tx) =>
        tx.insert(businessHours).values([
          { workspaceId: ws.id, weekday: 3, startMinute: 540, endMinute: 720 },
          { workspaceId: ws.id, weekday: 3, startMinute: 660, endMinute: 840 },
        ]),
      ),
    );
    expect(err?.code).toBe("23P01");
  });

  it("replaces the whole week, and a range can end at midnight", async () => {
    const { owner, member, ws } = await ownerAndStaff();
    const first = {
      ...emptyWeek(),
      1: [{ start: 540, end: 1020 }],
      5: [{ start: 540, end: 720 }, { start: 780, end: 1080 }],
    };
    expect(await replaceOpeningHoursRecord(claimsFor(owner), ws.id, first)).toBe(
      "ok",
    );
    const late = { ...emptyWeek(), 6: [{ start: 1080, end: 1440 }] };
    expect(await replaceOpeningHoursRecord(claimsFor(owner), ws.id, late)).toBe(
      "ok",
    );
    // Any member can read them.
    expect(await getOpeningHours(claimsFor(member), ws.id)).toEqual(late);
  });
});

describe("closed days", () => {
  it("a duplicate date gives duplicate_date", async () => {
    const { owner, ws } = await ownerAndStaff();
    const christmas = { date: "2099-12-25", name: "Christmas Day" };
    expect(await addClosedDayRecord(claimsFor(owner), ws.id, christmas)).toBe(
      "ok",
    );
    expect(
      await addClosedDayRecord(claimsFor(owner), ws.id, {
        date: "2099-12-25",
        name: "",
      }),
    ).toBe("duplicate_date");
  });

  it("staff can't add or delete closed days", async () => {
    const { owner, member, ws } = await ownerAndStaff();
    expect(
      await addClosedDayRecord(claimsFor(member), ws.id, {
        date: "2099-01-01",
        name: "",
      }),
    ).toBe("not_allowed");
    await addClosedDayRecord(claimsFor(owner), ws.id, {
      date: "2099-01-01",
      name: "New Year",
    });
    const [day] = await listClosedDays(claimsFor(member), ws.id, "UTC");
    expect(await deleteClosedDayRecord(claimsFor(member), ws.id, day.id)).toBe(
      "not_allowed",
    );
    expect(await deleteClosedDayRecord(claimsFor(owner), ws.id, day.id)).toBe(
      "ok",
    );
    expect(await listClosedDays(claimsFor(owner), ws.id, "UTC")).toEqual([]);
  });

  it("days before today in the workspace's time zone aren't listed", async () => {
    const { owner, ws } = await ownerAndStaff();
    // UTC-11 and UTC+14 are always on different dates, so "today" depends on the zone.
    const west = "Pacific/Pago_Pago";
    const east = "Pacific/Kiritimati";
    const westToday = todayIn(west);
    const eastToday = todayIn(east);
    const dates = [addDays(westToday, -1), westToday, eastToday];
    await adminDb
      .insert(closedDays)
      .values(dates.map((date) => ({ workspaceId: ws.id, date })));

    const westList = await listClosedDays(claimsFor(owner), ws.id, west);
    expect(westList.map((d) => d.date)).toEqual([westToday, eastToday]);
    const eastList = await listClosedDays(claimsFor(owner), ws.id, east);
    expect(eastList.map((d) => d.date)).toEqual([eastToday]);
    expect(eastList[0]).toEqual({ id: expect.any(String), date: eastToday, name: "" });

  });
});

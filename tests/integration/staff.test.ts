import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import { getPgError } from "@/db/errors";
import {
  memberships,
  services,
  staff,
  staffHours,
  staffServices,
  staffTimeOff,
} from "@/db/schema";
import { emptyWeek } from "@/features/hours/weekly-hours";
import { listServices } from "@/features/services/queries";
import { getStaffDetail, listStaff } from "@/features/staff/queries";
import {
  addTimeOffRecord,
  createStaffRecord,
  deleteStaffRecord,
  replaceStaffHoursRecord,
  setStaffServicesRecord,
  updateStaffProfileRecord,
} from "@/features/staff/records";
import { removeMemberRecord } from "@/features/team/records";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestService,
  createTestStaff,
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

/** A workspace owned by ana, with ben as admin and cara as staff. */
async function team() {
  const [ana, ben, cara] = await Promise.all([
    createTestUser({ fullName: "Ana Lopez" }),
    createTestUser({ fullName: "Ben Ito" }),
    createTestUser({ fullName: "Cara Diaz" }),
  ]);
  const ws = await createTestWorkspace(ana);
  await addTestMember(ws.id, ben, "admin");
  await addTestMember(ws.id, cara, "staff");
  return { ana, ben, cara, ws };
}

const profile = (name: string, userId: string | null = null) => ({
  name,
  title: "",
  bio: "",
  userId,
  active: true,
});

const nineToFive = { ...emptyWeek(), 1: [{ start: 540, end: 1020 }] };

async function countRows(
  table: typeof staffHours | typeof staffTimeOff | typeof staffServices,
  staffId: string,
) {
  const [row] = await adminDb
    .select({ n: count() })
    .from(table)
    .where(eq(table.staffId, staffId));
  return row.n;
}

describe("staff", () => {
  it("members read staff; staff-role members can't create them", async () => {
    const { ana, cara, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana, { name: "Maya Chen" });
    expect(
      await withRls(claimsFor(cara), (tx) =>
        tx.select({ id: staff.id }).from(staff),
      ),
    ).toEqual([{ id }]);
    expect(
      await createStaffRecord(claimsFor(cara), ws.id, profile("Sneaky")),
    ).toEqual({ ok: false, error: "not_allowed" });
  });

  it("managers create staff and edit their profile", async () => {
    const { ben, ws } = await team();
    const created = await createStaffRecord(
      claimsFor(ben),
      ws.id,
      profile("Maya Chen"),
    );
    if (!created.ok) throw new Error(created.error);
    expect(
      await updateStaffProfileRecord(claimsFor(ben), ws.id, created.id, {
        ...profile("Maya Chen"),
        title: "Senior stylist",
      }),
    ).toBe("ok");
    expect(await listStaff(claimsFor(ben), ws.id)).toEqual([
      {
        id: created.id,
        name: "Maya Chen",
        title: "Senior stylist",
        active: true,
        userId: null,
        serviceCount: 0,
        hasHours: false,
      },
    ]);
  });

  it("the database refuses overlapping hours", async () => {
    const { ana, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana);
    const err = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx.insert(staffHours).values([
          {
            workspaceId: ws.id,
            staffId: id,
            weekday: 1,
            startMinute: 540,
            endMinute: 720,
          },
          {
            workspaceId: ws.id,
            staffId: id,
            weekday: 1,
            startMinute: 660,
            endMinute: 840,
          },
        ]),
      ),
    );
    expect(err?.code).toBe("23P01");
  });

  it("cross-workspace links are refused", async () => {
    const { ana, ws } = await team();
    const other = await createTestWorkspace(ana);
    const { id: staffId } = await createTestStaff(ws.id, ana);
    const { id: otherService } = await createTestService(other.id, ana);
    const crossLink = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx
          .insert(staffServices)
          .values({ workspaceId: ws.id, staffId, serviceId: otherService }),
      ),
    );
    expect(crossLink?.code).toBe("23503");

    const outsider = await createTestUser();
    const notMember = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx.insert(staff).values({
          workspaceId: ws.id,
          name: "Outsider",
          userId: outsider.id,
        }),
      ),
    );
    expect(notMember?.code).toBe("23503");
  });

  it("replaceStaffHoursRecord swaps a whole week atomically", async () => {
    const { ana, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana);
    expect(
      await replaceStaffHoursRecord(claimsFor(ana), ws.id, id, nineToFive),
    ).toBe("ok");
    const overlapping = {
      ...emptyWeek(),
      2: [
        { start: 540, end: 720 },
        { start: 600, end: 800 },
      ],
    };
    await expect(
      replaceStaffHoursRecord(claimsFor(ana), ws.id, id, overlapping),
    ).rejects.toThrow();
    const detail = await getStaffDetail(claimsFor(ana), ws.id, id);
    expect(detail?.hours).toEqual(nineToFive);
  });

  it("setStaffServicesRecord replaces the set", async () => {
    const { ana, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana);
    const [s1, s2] = await Promise.all([
      createTestService(ws.id, ana),
      createTestService(ws.id, ana),
    ]);
    await setStaffServicesRecord(claimsFor(ana), ws.id, id, [s1.id, s2.id]);
    await setStaffServicesRecord(claimsFor(ana), ws.id, id, [s2.id]);
    const detail = await getStaffDetail(claimsFor(ana), ws.id, id);
    expect(detail?.serviceIds).toEqual([s2.id]);
  });

  it("deleting a staff member removes their hours, time off and services", async () => {
    const { ana, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana);
    const service = await createTestService(ws.id, ana);
    await setStaffServicesRecord(claimsFor(ana), ws.id, id, [service.id]);
    await replaceStaffHoursRecord(claimsFor(ana), ws.id, id, nineToFive);
    await addTimeOffRecord(claimsFor(ana), ws.id, id, {
      startsAt: new Date("2026-12-24T06:00:00Z"),
      endsAt: new Date("2026-12-27T06:00:00Z"),
      note: "Holiday",
    });
    expect(await deleteStaffRecord(claimsFor(ana), ws.id, id)).toBe("ok");
    expect(await countRows(staffHours, id)).toBe(0);
    expect(await countRows(staffTimeOff, id)).toBe(0);
    expect(await countRows(staffServices, id)).toBe(0);
    const [stillThere] = await adminDb
      .select({ id: services.id })
      .from(services)
      .where(eq(services.id, service.id));
    expect(stillThere).toEqual({ id: service.id });
  });

  it("a member leaving keeps the staff profile", async () => {
    const { ana, cara, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana, { userId: cara.id });
    const [caraMembership] = await adminDb
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, ws.id),
          eq(memberships.userId, cara.id),
        ),
      );
    expect(
      await removeMemberRecord(claimsFor(cara), ws.id, caraMembership.id),
    ).toBe("ok");
    const [row] = await adminDb
      .select({ id: staff.id, userId: staff.userId })
      .from(staff)
      .where(eq(staff.id, id));
    expect(row).toEqual({ id, userId: null });
  });

  it("an admin can't move a staff member to another workspace", async () => {
    const { ana, ben, ws } = await team();
    const other = await createTestWorkspace(ana);
    const { id } = await createTestStaff(ws.id, ana);
    const err = await pgErrorOf(
      withRls(claimsFor(ben), (tx) =>
        tx.update(staff).set({ workspaceId: other.id }).where(eq(staff.id, id)),
      ),
    );
    expect(err?.code).toBe("42501");
  });

  it("a team member can be linked to only one staff profile", async () => {
    const { ana, cara, ws } = await team();
    await createTestStaff(ws.id, ana, { userId: cara.id });
    expect(
      await createStaffRecord(
        claimsFor(ana),
        ws.id,
        profile("Cara again", cara.id),
      ),
    ).toEqual({ ok: false, error: "member_already_linked" });
  });

  it("time off shows on the staff detail, oldest first", async () => {
    const { ana, ws } = await team();
    const { id } = await createTestStaff(ws.id, ana);
    await addTimeOffRecord(claimsFor(ana), ws.id, id, {
      startsAt: new Date("2027-01-10T06:00:00Z"),
      endsAt: new Date("2027-01-11T06:00:00Z"),
      note: "",
    });
    await addTimeOffRecord(claimsFor(ana), ws.id, id, {
      startsAt: new Date("2026-12-24T06:00:00Z"),
      endsAt: new Date("2026-12-27T06:00:00Z"),
      note: "Holiday",
    });
    const detail = await getStaffDetail(claimsFor(ana), ws.id, id);
    expect(detail?.timeOff.map((t) => t.note)).toEqual(["Holiday", ""]);
  });

  it("staff can't read hours through a crafted query on another workspace", async () => {
    const { ana, ws } = await team();
    const outsider = await createTestUser();
    const { id } = await createTestStaff(ws.id, ana);
    await replaceStaffHoursRecord(claimsFor(ana), ws.id, id, nineToFive);
    const rows = await withRls(claimsFor(outsider), (tx) =>
      tx.execute(sql`select count(*)::int as n from public.staff_hours`),
    );
    expect(rows[0]).toEqual({ n: 0 });
  });

  it("services count the staff who perform them", async () => {
    const { ana, ws } = await team();
    const { id: maya } = await createTestStaff(ws.id, ana);
    const { id: jo } = await createTestStaff(ws.id, ana);
    const { id: cut } = await createTestService(ws.id, ana, { name: "Cut" });
    const { id: colour } = await createTestService(ws.id, ana, {
      name: "Colour",
    });
    await setStaffServicesRecord(claimsFor(ana), ws.id, maya, [cut, colour]);
    await setStaffServicesRecord(claimsFor(ana), ws.id, jo, [cut]);
    const counts = (await listServices(claimsFor(ana), ws.id)).map((s) => [
      s.name,
      s.staffCount,
    ]);
    expect(counts).toEqual([
      ["Colour", 1],
      ["Cut", 2],
    ]);
  });

  it("the list shows who has hours and how many services", async () => {
    const { ana, ws } = await team();
    const { id: maya } = await createTestStaff(ws.id, ana, { name: "Maya" });
    await createTestStaff(ws.id, ana, { name: "Jo" });
    const { id: cut } = await createTestService(ws.id, ana);
    await replaceStaffHoursRecord(claimsFor(ana), ws.id, maya, nineToFive);
    await setStaffServicesRecord(claimsFor(ana), ws.id, maya, [cut]);
    const summary = (await listStaff(claimsFor(ana), ws.id)).map((s) => [
      s.name,
      s.hasHours,
      s.serviceCount,
    ]);
    expect(summary).toEqual([
      ["Jo", false, 0],
      ["Maya", true, 1],
    ]);
    const detail = await getStaffDetail(claimsFor(ana), ws.id, maya);
    expect(detail?.profile).toMatchObject({ hasHours: true, serviceCount: 1 });
  });
});

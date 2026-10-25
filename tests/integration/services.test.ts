import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { getPgError } from "@/db/errors";
import { services } from "@/db/schema";
import { listServices } from "@/features/services/queries";
import {
  createServiceRecord,
  deleteServiceRecord,
  updateServiceRecord,
} from "@/features/services/records";
import type { ServiceInput } from "@/features/services/schemas";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestService,
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
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(ana);
  await addTestMember(ws.id, ben, "admin");
  await addTestMember(ws.id, cara, "staff");
  return { ana, ben, cara, ws };
}

const balayage: ServiceInput = {
  name: "Balayage",
  description: "",
  category: "Colour",
  durationMinutes: 180,
  bufferMinutes: 15,
  priceCents: 18000,
  priceIsFrom: true,
  bookableOnline: true,
};

describe("services", () => {
  it("members can read services; staff can't change them", async () => {
    const { ana, cara, ws } = await team();
    const { id } = await createTestService(ws.id, ana, { name: "Trim" });
    const seen = await withRls(claimsFor(cara), (tx) =>
      tx.select({ id: services.id }).from(services),
    );
    expect(seen).toEqual([{ id }]);

    expect(await createServiceRecord(claimsFor(cara), ws.id, balayage)).toEqual(
      { ok: false, error: "not_allowed" },
    );
    expect(
      await updateServiceRecord(claimsFor(cara), ws.id, id, balayage),
    ).toBe("not_allowed");
    expect(await deleteServiceRecord(claimsFor(cara), ws.id, id)).toBe(
      "not_allowed",
    );
    const insert = await pgErrorOf(
      withRls(claimsFor(cara), (tx) =>
        tx
          .insert(services)
          .values({ workspaceId: ws.id, name: "Sneaky", durationMinutes: 30 }),
      ),
    );
    expect(insert?.code).toBe("42501");
  });

  it("managers create, edit and delete services", async () => {
    const { ben, ws } = await team();
    const created = await createServiceRecord(claimsFor(ben), ws.id, balayage);
    if (!created.ok) throw new Error(created.error);
    expect(
      await updateServiceRecord(claimsFor(ben), ws.id, created.id, {
        ...balayage,
        priceCents: 19550,
      }),
    ).toBe("ok");
    const [listed] = await listServices(claimsFor(ben), ws.id);
    expect(listed).toMatchObject({
      id: created.id,
      name: "Balayage",
      priceCents: 19550,
      priceIsFrom: true,
    });
    expect(await deleteServiceRecord(claimsFor(ben), ws.id, created.id)).toBe(
      "ok",
    );
    expect(await listServices(claimsFor(ben), ws.id)).toEqual([]);
  });

  it("names are unique per workspace, ignoring case", async () => {
    const { ana, ws } = await team();
    await createServiceRecord(claimsFor(ana), ws.id, balayage);
    expect(
      await createServiceRecord(claimsFor(ana), ws.id, {
        ...balayage,
        name: "balayage",
      }),
    ).toEqual({ ok: false, error: "duplicate_name" });
  });

  it("a manager of one workspace can't add or move services into another", async () => {
    const { ana, ws } = await team();
    const outsider = await createTestUser();
    const other = await createTestWorkspace(outsider);
    expect(
      await createServiceRecord(claimsFor(ana), other.id, balayage),
    ).toEqual({ ok: false, error: "not_allowed" });
    const { id } = await createTestService(ws.id, ana);
    const move = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx
          .update(services)
          .set({ workspaceId: other.id })
          .where(eq(services.id, id)),
      ),
    );
    expect(move?.code).toBe("42501");
  });

  it("the database refuses impossible durations", async () => {
    const { ana, ws } = await team();
    const err = await pgErrorOf(
      withRls(claimsFor(ana), (tx) =>
        tx.execute(
          sql`insert into public.services (workspace_id, name, duration_minutes) values (${ws.id}, 'Odd', 7)`,
        ),
      ),
    );
    expect(err?.code).toBe("23514");
  });
});

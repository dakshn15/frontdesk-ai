import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { getPgError } from "@/db/errors";
import { policies, verifiedAnswers } from "@/db/schema";
import { listAnswers } from "@/features/answers/queries";
import {
  deleteAnswerRecord,
  saveAnswerRecord,
} from "@/features/answers/records";
import { listPolicies } from "@/features/policies/queries";
import {
  deletePolicyRecord,
  savePolicyRecord,
} from "@/features/policies/records";
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

async function ownerAndStaff() {
  const [owner, member] = await Promise.all([
    createTestUser({ fullName: "Ana Lopez" }),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  return { owner, member, ws };
}

const cancellation = (body: string) => ({
  id: null,
  kind: "cancellation" as const,
  title: "Cancellations",
  body,
});

describe("policies", () => {
  it("staff can't write policies", async () => {
    const { member, ws } = await ownerAndStaff();
    expect(
      await savePolicyRecord(claimsFor(member), ws.id, cancellation("24h")),
    ).toBe("not_allowed");
    expect(await listPolicies(claimsFor(member), ws.id)).toEqual([]);
  });

  it("a standard policy is saved once and updated in place", async () => {
    const { owner, member, ws } = await ownerAndStaff();
    await savePolicyRecord(claimsFor(owner), ws.id, cancellation("24 hours."));
    await savePolicyRecord(claimsFor(owner), ws.id, cancellation("48 hours."));
    const listed = await listPolicies(claimsFor(member), ws.id);
    expect(listed).toEqual([
      {
        id: expect.any(String),
        kind: "cancellation",
        title: "Cancellations",
        body: "48 hours.",
      },
    ]);
    expect(
      await deletePolicyRecord(claimsFor(member), ws.id, listed[0].id),
    ).toBe("not_allowed");
    expect(
      await deletePolicyRecord(claimsFor(owner), ws.id, listed[0].id),
    ).toBe("ok");
    expect(await listPolicies(claimsFor(owner), ws.id)).toEqual([]);
  });

  it("allows one row per standard kind but many custom ones", async () => {
    const { owner, ws } = await ownerAndStaff();
    const row = (kind: "cancellation" | "custom", title: string) => ({
      workspaceId: ws.id,
      kind,
      title,
      body: "Text.",
    });
    await withRls(claimsFor(owner), (tx) =>
      tx.insert(policies).values(row("cancellation", "Cancellations")),
    );
    const err = await pgErrorOf(
      withRls(claimsFor(owner), (tx) =>
        tx.insert(policies).values(row("cancellation", "Cancellations")),
      ),
    );
    expect(err?.code).toBe("23505");
    await withRls(claimsFor(owner), (tx) =>
      tx
        .insert(policies)
        .values([row("custom", "Children"), row("custom", "Pets")]),
    );
    const titles = (await listPolicies(claimsFor(owner), ws.id)).map(
      (p) => p.title,
    );
    expect(titles).toEqual(["Cancellations", "Children", "Pets"]);
  });

  it("a custom policy is updated by id", async () => {
    const { owner, ws } = await ownerAndStaff();
    const children = {
      id: null,
      kind: "custom" as const,
      title: "Children",
      body: "Welcome.",
    };
    await savePolicyRecord(claimsFor(owner), ws.id, children);
    const [saved] = await listPolicies(claimsFor(owner), ws.id);
    expect(
      await savePolicyRecord(claimsFor(owner), ws.id, {
        ...children,
        id: saved.id,
        body: "Under 12s need an adult.",
      }),
    ).toBe("ok");
    expect(await listPolicies(claimsFor(owner), ws.id)).toEqual([
      { ...saved, body: "Under 12s need an adult." },
    ]);
  });

  it("managers can't change a policy's kind or workspace", async () => {
    const { owner, ws } = await ownerAndStaff();
    const other = await createTestWorkspace(owner);
    await savePolicyRecord(claimsFor(owner), ws.id, cancellation("24 hours."));
    const [saved] = await listPolicies(claimsFor(owner), ws.id);
    for (const change of [
      { kind: "parking" as const },
      { workspaceId: other.id },
    ]) {
      const err = await pgErrorOf(
        withRls(claimsFor(owner), (tx) =>
          tx.update(policies).set(change).where(eq(policies.id, saved.id)),
        ),
      );
      expect(err?.code).toBe("42501");
    }
  });
});

describe("verified answers", () => {
  const bridal = {
    id: null,
    question: "Do you do bridal hair?",
    answer: "Yes, with a trial first.",
  };

  it("staff can't write answers", async () => {
    const { member, ws } = await ownerAndStaff();
    expect(await saveAnswerRecord(claimsFor(member), ws.id, bridal)).toBe(
      "not_allowed",
    );
  });

  it("the same question in a different case is a duplicate", async () => {
    const { owner, ws } = await ownerAndStaff();
    expect(await saveAnswerRecord(claimsFor(owner), ws.id, bridal)).toBe("ok");
    expect(
      await saveAnswerRecord(claimsFor(owner), ws.id, {
        ...bridal,
        question: "DO YOU DO BRIDAL HAIR?",
      }),
    ).toBe("duplicate_question");
  });

  it("records who wrote and edited each answer, newest edit first", async () => {
    const { owner, member, ws } = await ownerAndStaff();
    await saveAnswerRecord(claimsFor(owner), ws.id, bridal);
    await saveAnswerRecord(claimsFor(owner), ws.id, {
      id: null,
      question: "Is there parking?",
      answer: "Free parking behind the building.",
    });
    const [parking, bridalRow] = await listAnswers(claimsFor(member), ws.id);
    expect(parking.question).toBe("Is there parking?");
    expect(bridalRow).toMatchObject({
      ...bridal,
      id: expect.any(String),
      updatedByName: "Ana Lopez",
    });

    expect(
      await saveAnswerRecord(claimsFor(owner), ws.id, {
        ...bridal,
        id: bridalRow.id,
        answer: "Yes. Book a trial first.",
      }),
    ).toBe("ok");
    const [first] = await listAnswers(claimsFor(owner), ws.id);
    expect(first).toMatchObject({ answer: "Yes. Book a trial first." });

    expect(await deleteAnswerRecord(claimsFor(member), ws.id, first.id)).toBe(
      "not_allowed",
    );
    expect(await deleteAnswerRecord(claimsFor(owner), ws.id, first.id)).toBe(
      "ok",
    );
    expect(await listAnswers(claimsFor(owner), ws.id)).toHaveLength(1);
  });

  it("managers can't move an answer to another workspace", async () => {
    const { owner, ws } = await ownerAndStaff();
    const other = await createTestWorkspace(owner);
    await saveAnswerRecord(claimsFor(owner), ws.id, bridal);
    const [saved] = await listAnswers(claimsFor(owner), ws.id);
    const err = await pgErrorOf(
      withRls(claimsFor(owner), (tx) =>
        tx
          .update(verifiedAnswers)
          .set({ workspaceId: other.id })
          .where(eq(verifiedAnswers.id, saved.id)),
      ),
    );
    expect(err?.code).toBe("42501");
  });
});

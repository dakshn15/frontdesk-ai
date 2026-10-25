import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import {
  EMBEDDING_DIMENSIONS,
  knowledgeChunks,
  knowledgeSources,
} from "@/db/schema";
import { listSources } from "@/features/knowledge/queries";
import {
  addSourceRecord,
  deleteSourceRecord,
  requeueSourceRecord,
} from "@/features/knowledge/records";
import { searchKnowledge } from "@/features/knowledge/search";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

/** A unit vector pointing along one axis. */
const axis = (i: number) =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, j) => (j === i ? 1 : 0));

async function team() {
  const [owner, member, outsider] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner);
  await addTestMember(ws.id, member, "staff");
  return { owner, member, outsider, ws };
}

async function addText(owner: TestUser, wsId: string, title: string) {
  const result = await addSourceRecord(claimsFor(owner), wsId, {
    kind: "text",
    title,
    content: "placeholder",
  });
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

/** Writes chunks the way the pipeline does (privileged). */
async function addChunks(
  wsId: string,
  sourceId: string,
  chunks: { content: string; heading?: string; embedding?: number[] }[],
) {
  await adminDb.insert(knowledgeChunks).values(
    chunks.map((chunk, position) => ({
      workspaceId: wsId,
      sourceId,
      position,
      heading: chunk.heading ?? "",
      content: chunk.content,
      embedding: chunk.embedding ?? null,
    })),
  );
}

function search(
  user: TestUser,
  wsId: string,
  query: string,
  queryEmbedding: number[] | null = null,
) {
  return withRls(claimsFor(user), (tx) =>
    searchKnowledge(tx, wsId, query, { queryEmbedding }),
  );
}

describe("knowledge sources", () => {
  it("owners add and delete; staff read but can't add; outsiders see nothing", async () => {
    const { owner, member, outsider, ws } = await team();
    expect(
      await addSourceRecord(claimsFor(member), ws.id, {
        kind: "text",
        title: "Notes",
        content: "Hi",
      }),
    ).toEqual({ ok: false, error: "not_allowed" });
    const id = await addText(owner, ws.id, "About us");
    expect(await listSources(claimsFor(member), ws.id)).toEqual([
      expect.objectContaining({ id, title: "About us", status: "queued" }),
    ]);
    expect(await listSources(claimsFor(outsider), ws.id)).toEqual([]);
    expect(await deleteSourceRecord(claimsFor(member), ws.id, id)).toBe(
      "not_allowed",
    );
    expect(await deleteSourceRecord(claimsFor(owner), ws.id, id)).toBe("ok");
  });

  it("deleting a source deletes its chunks", async () => {
    const { owner, ws } = await team();
    const id = await addText(owner, ws.id, "FAQ");
    await addChunks(ws.id, id, [{ content: "We open at 9." }]);
    await deleteSourceRecord(claimsFor(owner), ws.id, id);
    const left = await adminDb
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, id));
    expect(left).toEqual([]);
  });

  it("a source stuck processing shows as failed and can be queued again", async () => {
    const { owner, ws } = await team();
    const id = await addText(owner, ws.id, "Old page");
    await adminDb
      .update(knowledgeSources)
      .set({
        status: "processing",
        startedAt: new Date(Date.now() - 20 * 60_000),
      })
      .where(eq(knowledgeSources.id, id));
    expect(await listSources(claimsFor(owner), ws.id)).toEqual([
      expect.objectContaining({
        status: "failed",
        error: "This took too long. Try again.",
      }),
    ]);
    expect(await requeueSourceRecord(claimsFor(owner), ws.id, id)).toBe("ok");
    expect((await listSources(claimsFor(owner), ws.id))[0].status).toBe(
      "queued",
    );
  });
});

describe("search", () => {
  it("finds keyword matches without vectors, only in its own workspace", async () => {
    const a = await team();
    const b = await team();
    const aSource = await addText(a.owner, a.ws.id, "About us");
    const bSource = await addText(b.owner, b.ws.id, "Their page");
    await addChunks(a.ws.id, aSource, [
      { heading: "Parking", content: "Free parking behind the salon." },
      { content: "We do bridal hair." },
    ]);
    await addChunks(b.ws.id, bSource, [{ content: "Parking costs $5." }]);

    const found = await search(a.owner, a.ws.id, "where can I park?");
    expect(found).toEqual([
      expect.objectContaining({
        sourceId: aSource,
        sourceTitle: "About us",
        heading: "Parking",
        content: "Free parking behind the salon.",
      }),
    ]);
    // Asking for another workspace returns nothing, even with its id.
    expect(await search(a.owner, b.ws.id, "parking")).toEqual([]);
  });

  it("merges vector and keyword results", async () => {
    const { owner, ws } = await team();
    const id = await addText(owner, ws.id, "Guide");
    await addChunks(ws.id, id, [
      { content: "Colour treatments take two hours.", embedding: axis(0) },
      { content: "Parking is free.", embedding: axis(1) },
      { content: "Our team loves weddings.", embedding: axis(2) },
    ]);
    const keywordsOnly = await search(owner, ws.id, "parking");
    expect(keywordsOnly.map((p) => p.content)).toEqual(["Parking is free."]);

    // A question about colour by meaning, not by word.
    const both = await search(owner, ws.id, "parking", axis(0));
    const contents = both.map((p) => p.content);
    expect(contents).toContain("Parking is free.");
    expect(contents).toContain("Colour treatments take two hours.");
    expect(contents[0]).toBe("Parking is free.");
  });

  it("matches a question even when some of its words aren't in the text", async () => {
    const { owner, ws } = await team();
    const id = await addText(owner, ws.id, "About us");
    await addChunks(ws.id, id, [
      { content: "Free parking behind the salon." },
      { content: "Parking for bikes is at the back." },
      { content: "We do bridal hair." },
    ]);
    const found = await search(
      owner,
      ws.id,
      "is there free parking for my car?",
    );
    // Passages matching more of the question rank higher.
    expect(found.map((p) => p.content)).toEqual([
      "Free parking behind the salon.",
      "Parking for bikes is at the back.",
    ]);
  });

  it("returns nothing for an empty query", async () => {
    const { owner, ws } = await team();
    expect(await search(owner, ws.id, "   ")).toEqual([]);
  });
});

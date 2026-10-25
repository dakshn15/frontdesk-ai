import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";
import {
  EMBEDDING_DIMENSIONS,
  knowledgeChunks,
  knowledgeSources,
} from "@/db/schema";
import { addSourceRecord, type NewSource } from "@/features/knowledge/records";
import { searchKnowledge } from "@/features/knowledge/search";
import { FetchPageError, type FetchPage } from "@/jobs/fetch-page";
import { MAX_SITEMAP_PAGES, syncSource } from "@/jobs/knowledge";
import {
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

/** One vector per text, pointing along an axis picked by its length. */
const fakeEmbed = async (texts: string[]) =>
  texts.map((text) =>
    Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
      i === text.length % EMBEDDING_DIMENSIONS ? 1 : 0,
    ),
  );
const noEmbed = async () => null;
const noFetch: FetchPage = async () => {
  throw new Error("unexpected fetch");
};

const page = (url: string, body: string) => ({
  url,
  contentType: "text/html",
  body,
});

async function owned() {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  return { owner, ws };
}

async function add(owner: TestUser, wsId: string, source: NewSource) {
  const result = await addSourceRecord(claimsFor(owner), wsId, source);
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

async function stateOf(id: string) {
  const [source] = await adminDb
    .select({
      status: knowledgeSources.status,
      error: knowledgeSources.error,
      title: knowledgeSources.title,
      pageCount: knowledgeSources.pageCount,
      chunkCount: knowledgeSources.chunkCount,
    })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, id));
  const chunks = await adminDb
    .select({
      id: knowledgeChunks.id,
      heading: knowledgeChunks.heading,
      content: knowledgeChunks.content,
      pageUrl: knowledgeChunks.pageUrl,
      embedding: knowledgeChunks.embedding,
    })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.sourceId, id))
    .orderBy(asc(knowledgeChunks.position));
  return { ...source, chunks };
}

describe("syncSource", () => {
  it("chunks and embeds pasted text", async () => {
    const { owner, ws } = await owned();
    const id = await add(owner, ws.id, {
      kind: "text",
      title: "About us",
      content:
        "# Parking\nFree parking behind the salon.\n# Pets\nDogs welcome.",
    });
    await syncSource(id, { fetchPage: noFetch, embed: fakeEmbed });
    const state = await stateOf(id);
    expect(state).toMatchObject({
      status: "ready",
      error: null,
      pageCount: 1,
      chunkCount: 2,
    });
    expect(state.chunks.map((c) => [c.heading, c.content])).toEqual([
      ["Parking", "Free parking behind the salon."],
      ["Pets", "Dogs welcome."],
    ]);
    expect(state.chunks[0].embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("reads a web page and takes its title", async () => {
    const { owner, ws } = await owned();
    const id = await add(owner, ws.id, {
      kind: "url",
      title: "https://bloom.test/faq",
      url: "https://bloom.test/faq",
    });
    const fetchPage: FetchPage = async (url) =>
      page(
        url,
        "<title>FAQ | Bloom</title><nav>Menu</nav><main><h1>FAQ</h1><p>We open at 9.</p></main>",
      );
    await syncSource(id, { fetchPage, embed: noEmbed });
    const state = await stateOf(id);
    expect(state).toMatchObject({ status: "ready", title: "FAQ | Bloom" });
    expect(state.chunks).toEqual([
      expect.objectContaining({
        heading: "FAQ",
        content: "We open at 9.",
        pageUrl: "https://bloom.test/faq",
        embedding: null,
      }),
    ]);

    // Without vectors, keyword search still finds it.
    const found = await withRls(claimsFor(owner), (tx) =>
      searchKnowledge(tx, ws.id, "open"),
    );
    expect(found.map((p) => p.content)).toEqual(["We open at 9."]);
  });

  it("crawls a sitemap: same site only, up to the page limit, skipping failures", async () => {
    const { owner, ws } = await owned();
    const id = await add(owner, ws.id, {
      kind: "sitemap",
      title: "bloom.test",
      url: "https://bloom.test/sitemap.xml",
    });
    const locs = [
      ...Array.from(
        { length: MAX_SITEMAP_PAGES + 2 },
        (_, i) => `https://bloom.test/p${i}`,
      ),
      "https://elsewhere.test/page",
    ];
    const fetched: string[] = [];
    const fetchPage: FetchPage = async (url) => {
      if (url.endsWith("sitemap.xml")) {
        return {
          url,
          contentType: "application/xml",
          body: `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join("")}</urlset>`,
        };
      }
      fetched.push(url);
      if (url.endsWith("/p2"))
        throw new FetchPageError("That page answered with an error (500).");
      return page(url, `<main><p>Page ${url}</p></main>`);
    };
    await syncSource(id, { fetchPage, embed: noEmbed });
    expect(fetched).toHaveLength(MAX_SITEMAP_PAGES);
    expect(fetched.some((url) => url.includes("elsewhere"))).toBe(false);
    expect(await stateOf(id)).toMatchObject({
      status: "ready",
      pageCount: MAX_SITEMAP_PAGES - 1,
      chunkCount: MAX_SITEMAP_PAGES - 1,
    });
  });

  it("marks a source failed with a readable reason", async () => {
    const { owner, ws } = await owned();
    const id = await add(owner, ws.id, {
      kind: "url",
      title: "https://bloom.test/",
      url: "https://bloom.test/",
    });
    await syncSource(id, {
      fetchPage: async () => {
        throw new FetchPageError("We can't fetch pages from that address.");
      },
      embed: noEmbed,
    });
    expect(await stateOf(id)).toMatchObject({
      status: "failed",
      error: "We can't fetch pages from that address.",
      chunkCount: 0,
    });

    const other = await add(owner, ws.id, {
      kind: "text",
      title: "Broken",
      content: "Some text.",
    });
    await syncSource(other, {
      fetchPage: noFetch,
      embed: async () => {
        throw new Error("upstream 500");
      },
    });
    expect(await stateOf(other)).toMatchObject({
      status: "failed",
      error: "Something went wrong while reading this source. Try again.",
    });
  });

  it("syncing again replaces the chunks", async () => {
    const { owner, ws } = await owned();
    const id = await add(owner, ws.id, {
      kind: "text",
      title: "Hours",
      content: "We open at 9.",
    });
    await syncSource(id, { fetchPage: noFetch, embed: noEmbed });
    const before = (await stateOf(id)).chunks.map((c) => c.id);
    await syncSource(id, { fetchPage: noFetch, embed: noEmbed });
    const after = await stateOf(id);
    expect(after.chunks).toHaveLength(1);
    expect(after.chunks[0].id).not.toBe(before[0]);
  });
});

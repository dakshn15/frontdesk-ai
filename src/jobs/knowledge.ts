import "server-only";
import { eq, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { knowledgeChunks, knowledgeSources } from "@/db/schema";
import { chunkText } from "@/features/knowledge/chunk";
import { type Embed, openAiEmbedder } from "@/features/knowledge/embeddings";
import { aiKeysFor } from "@/privileged/ai-keys";
import { htmlToText, sitemapUrls } from "@/features/knowledge/html-text";
import { type FetchPage, FetchPageError, fetchPage } from "./fetch-page";

// The knowledge pipeline: get the text, split it into chunks, embed them, and replace the
// source's chunks in one transaction. It runs with the privileged connection, after the
// request that queued it (Next's after()), and never throws.

export const MAX_SITEMAP_PAGES = 25;
const MAX_NESTED_SITEMAPS = 5;
const INSERT_BATCH = 200;

/** A problem the owner can understand and fix; anything else gets a generic message. */
class SyncError extends Error {}

type Page = { url: string | null; title: string; text: string };
type Source = {
  id: string;
  workspaceId: string;
  kind: "file" | "url" | "sitemap" | "text";
  title: string;
  url: string | null;
  content: string | null;
};

function pageText(fetched: {
  url: string;
  contentType: string;
  body: string;
}): Page {
  if (/html/i.test(fetched.contentType)) {
    const { title, text } = htmlToText(fetched.body);
    return { url: fetched.url, title, text };
  }
  return { url: fetched.url, title: "", text: fetched.body };
}

async function crawlSitemap(start: string, fetch: FetchPage): Promise<Page[]> {
  const origin = new URL(start);
  const sitemapUrl = /\.xml$/i.test(origin.pathname)
    ? origin.href
    : new URL("/sitemap.xml", origin).href;
  const sitemap = await fetch(sitemapUrl);
  let locs = sitemapUrls(sitemap.body);
  // A sitemap index lists other sitemaps; read the first few.
  if (/<sitemapindex/i.test(sitemap.body)) {
    const nested: string[] = [];
    for (const child of locs.slice(0, MAX_NESTED_SITEMAPS)) {
      try {
        nested.push(...sitemapUrls((await fetch(child)).body));
      } catch {
        // Skip a sitemap that won't load.
      }
    }
    locs = nested;
  }
  const host = new URL(sitemap.url).hostname.replace(/^www\./, "");
  const sameSite = [...new Set(locs)].filter((loc) => {
    try {
      return new URL(loc).hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  });

  const pages: Page[] = [];
  for (const loc of sameSite.slice(0, MAX_SITEMAP_PAGES)) {
    try {
      pages.push(pageText(await fetch(loc)));
    } catch {
      // One broken page shouldn't fail the whole site.
    }
  }
  if (pages.length === 0) {
    throw new SyncError("We couldn't read any pages from that sitemap.");
  }
  return pages;
}

async function collectPages(source: Source, fetch: FetchPage): Promise<Page[]> {
  switch (source.kind) {
    case "text":
    case "file":
      return [{ url: null, title: source.title, text: source.content ?? "" }];
    case "url":
      if (!source.url) throw new SyncError("This source has no address.");
      return [pageText(await fetch(source.url))];
    case "sitemap":
      if (!source.url) throw new SyncError("This source has no address.");
      return crawlSitemap(source.url, fetch);
  }
}

export async function syncSource(
  sourceId: string,
  // Without an embed, the workspace's own OpenAI key embeds the chunks.
  deps: { fetchPage: FetchPage; embed?: Embed } = { fetchPage },
): Promise<void> {
  const [source] = await adminDb
    .update(knowledgeSources)
    .set({
      status: "processing",
      error: null,
      startedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(knowledgeSources.id, sourceId))
    .returning({
      id: knowledgeSources.id,
      workspaceId: knowledgeSources.workspaceId,
      kind: knowledgeSources.kind,
      title: knowledgeSources.title,
      url: knowledgeSources.url,
      content: knowledgeSources.content,
    });
  if (!source) return;

  try {
    const pages = await collectPages(source, deps.fetchPage);
    const chunks = pages.flatMap((page) =>
      chunkText(page.text).map((chunk) => ({ ...chunk, pageUrl: page.url })),
    );
    if (chunks.length === 0) {
      throw new SyncError("We didn't find any text there.");
    }
    const embed =
      deps.embed ??
      openAiEmbedder((await aiKeysFor(source.workspaceId)).openai);
    const embeddings = await embed(
      chunks.map((chunk) => `${chunk.heading}\n${chunk.content}`.trim()),
    );
    // A single page's own title replaces the address we used as a placeholder.
    const pageTitle = pages.length === 1 ? pages[0].title.slice(0, 200) : "";
    const title =
      source.kind === "url" && source.title === source.url && pageTitle
        ? pageTitle
        : source.title;

    await adminDb.transaction(async (tx) => {
      await tx
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.sourceId, source.id));
      const rows = chunks.map((chunk, position) => ({
        workspaceId: source.workspaceId,
        sourceId: source.id,
        position,
        heading: chunk.heading,
        content: chunk.content,
        pageUrl: chunk.pageUrl,
        embedding: embeddings?.[position] ?? null,
      }));
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        await tx
          .insert(knowledgeChunks)
          .values(rows.slice(i, i + INSERT_BATCH));
      }
      await tx
        .update(knowledgeSources)
        .set({
          status: "ready",
          error: null,
          title,
          pageCount: pages.length,
          chunkCount: rows.length,
          syncedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(knowledgeSources.id, source.id));
    });
  } catch (err) {
    const known = err instanceof SyncError || err instanceof FetchPageError;
    if (!known) console.error("knowledge sync failed", sourceId, err);
    await adminDb
      .update(knowledgeSources)
      .set({
        status: "failed",
        error: known
          ? err.message
          : "Something went wrong while reading this source. Try again.",
        updatedAt: sql`now()`,
      })
      .where(eq(knowledgeSources.id, source.id));
  }
}

import "server-only";
import { desc, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import {
  type KnowledgeKind,
  type KnowledgeStatus,
  knowledgeSources,
} from "@/db/schema";

export type SourceSummary = {
  id: string;
  kind: KnowledgeKind;
  title: string;
  url: string | null;
  fileName: string | null;
  status: KnowledgeStatus;
  error: string | null;
  pageCount: number;
  chunkCount: number;
  syncedAt: Date | null;
  createdAt: Date;
};

/** A sync that hasn't finished in this long was cut off (the server stopped it). */
export const STUCK_AFTER_MS = 10 * 60_000;
export const STUCK_MESSAGE = "This took too long. Try again.";

/** Newest first. Queued or processing for too long shows as failed. */
export async function listSources(
  claims: AuthClaims,
  workspaceId: string,
  now = new Date(),
): Promise<SourceSummary[]> {
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        id: knowledgeSources.id,
        kind: knowledgeSources.kind,
        title: knowledgeSources.title,
        url: knowledgeSources.url,
        fileName: knowledgeSources.fileName,
        status: knowledgeSources.status,
        error: knowledgeSources.error,
        pageCount: knowledgeSources.pageCount,
        chunkCount: knowledgeSources.chunkCount,
        syncedAt: knowledgeSources.syncedAt,
        startedAt: knowledgeSources.startedAt,
        updatedAt: knowledgeSources.updatedAt,
        createdAt: knowledgeSources.createdAt,
      })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.workspaceId, workspaceId))
      .orderBy(desc(knowledgeSources.createdAt)),
  );
  return rows.map(({ startedAt, updatedAt, ...source }) => {
    const since = source.status === "processing" ? startedAt : updatedAt;
    const stuck =
      (source.status === "processing" || source.status === "queued") &&
      since !== null &&
      now.getTime() - since.getTime() > STUCK_AFTER_MS;
    return stuck
      ? { ...source, status: "failed", error: STUCK_MESSAGE }
      : source;
  });
}

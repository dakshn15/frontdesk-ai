import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { RlsTx } from "@/db";
import { knowledgeChunks, knowledgeSources } from "@/db/schema";
import { reciprocalRankFusion } from "./rrf";

export type Passage = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  heading: string;
  content: string;
  pageUrl: string | null;
  score: number;
  /** Whether the passage matched the query's words (not only its meaning). */
  keyword: boolean;
};

const CANDIDATES = 20;

/**
 * Hybrid search over one workspace's knowledge: full-text matches and (when a query
 * embedding is given) nearest vectors, merged with reciprocal rank fusion.
 */
export async function searchKnowledge(
  tx: RlsTx,
  workspaceId: string,
  query: string,
  options: { queryEmbedding?: number[] | null; limit?: number } = {},
): Promise<Passage[]> {
  const text = query.trim().slice(0, 500);
  if (!text) return [];
  const { queryEmbedding, limit = 6 } = options;
  // websearch_to_tsquery joins words with AND; a question has words the answer won't, so
  // match any of them (OR) and let the ranking prefer passages that match more.
  const tsquery = sql`replace(websearch_to_tsquery('english', ${text})::text, '&', '|')::tsquery`;

  const keywordHits = await tx
    .select({ id: knowledgeChunks.id })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.workspaceId, workspaceId),
        sql`${knowledgeChunks.fts} @@ ${tsquery}`,
      ),
    )
    .orderBy(desc(sql`ts_rank_cd(${knowledgeChunks.fts}, ${tsquery})`))
    .limit(CANDIDATES);

  let vectorHits: { id: string }[] = [];
  if (queryEmbedding) {
    // With a workspace filter, keep scanning the index until enough rows match it.
    await tx.execute(sql`set local hnsw.iterative_scan = 'relaxed_order'`);
    vectorHits = await tx
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.workspaceId, workspaceId),
          isNotNull(knowledgeChunks.embedding),
        ),
      )
      // Cosine distance, with the operator and type named by schema: hosted Supabase
      // doesn't always have the extensions schema on the search path.
      .orderBy(
        sql`${knowledgeChunks.embedding} operator(extensions.<=>) ${JSON.stringify(queryEmbedding)}::extensions.vector`,
      )
      .limit(CANDIDATES);
  }

  const ranked = reciprocalRankFusion([
    keywordHits.map((hit) => hit.id),
    vectorHits.map((hit) => hit.id),
  ]).slice(0, limit);
  if (ranked.length === 0) return [];

  const rows = await tx
    .select({
      chunkId: knowledgeChunks.id,
      sourceId: knowledgeChunks.sourceId,
      sourceTitle: knowledgeSources.title,
      heading: knowledgeChunks.heading,
      content: knowledgeChunks.content,
      pageUrl: knowledgeChunks.pageUrl,
    })
    .from(knowledgeChunks)
    .innerJoin(
      knowledgeSources,
      eq(knowledgeSources.id, knowledgeChunks.sourceId),
    )
    .where(
      inArray(
        knowledgeChunks.id,
        ranked.map((hit) => hit.id),
      ),
    );
  const byId = new Map(rows.map((row) => [row.chunkId, row]));
  const keywordIds = new Set(keywordHits.map((hit) => hit.id));
  return ranked.flatMap(({ id, score }) => {
    const row = byId.get(id);
    return row ? [{ ...row, score, keyword: keywordIds.has(id) }] : [];
  });
}

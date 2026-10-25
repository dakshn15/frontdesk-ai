import "server-only";
import { getServerEnv } from "@/env/server";

/** Vectors for texts, in order, or null when no embedding model is configured. */
export type Embed = (texts: string[]) => Promise<number[][] | null>;

const MODEL = "text-embedding-3-small";
const BATCH = 64;

/** OpenAI embeddings through the REST API. Needs OPENAI_API_KEY; otherwise returns null. */
export const embedTexts: Embed = async (texts) => {
  const key = getServerEnv().OPENAI_API_KEY;
  if (!key || texts.length === 0) return null;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: texts.slice(i, i + BATCH) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embeddings answered ${response.status}`);
    }
    const body = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    vectors.push(
      ...body.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding),
    );
  }
  return vectors;
};

/** The vector for a search query, or null without a model (or if the call fails). */
export async function embedQuery(query: string): Promise<number[] | null> {
  try {
    return (await embedTexts([query]))?.[0] ?? null;
  } catch (err) {
    console.error("query embedding failed", err);
    return null;
  }
}

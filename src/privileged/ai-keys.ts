import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { workspaceAiKeys, workspaces } from "@/db/schema";
import { getServerEnv } from "@/env/server";
import { open, seal } from "@/lib/secret-box";

export type AiKeyProvider = "openai" | "google";

/** The keys a workspace's receptionist answers with, and whose they are. */
export type AiKeys = {
  openai?: string;
  google?: string;
  /** "workspace": its own keys. "platform": the demo, on FrontDesk AI's keys. */
  source: "workspace" | "platform" | "none";
};

const column = { openai: "openaiKey", google: "googleKey" } as const;

/**
 * A workspace answers with the keys its owner pasted in Settings. Demo sandboxes, which
 * have no owner of their own, use the platform's keys from the environment.
 */
export async function aiKeysFor(workspaceId: string): Promise<AiKeys> {
  const env = getServerEnv();
  const [row] = await adminDb
    .select({
      demoExpiresAt: workspaces.demoExpiresAt,
      openaiKey: workspaceAiKeys.openaiKey,
      googleKey: workspaceAiKeys.googleKey,
    })
    .from(workspaces)
    .leftJoin(workspaceAiKeys, eq(workspaceAiKeys.workspaceId, workspaces.id))
    .where(eq(workspaces.id, workspaceId));
  if (!row) return { source: "none" };

  if (row.demoExpiresAt !== null) {
    const keys = {
      openai: env.OPENAI_API_KEY,
      google: env.GOOGLE_GENERATIVE_AI_API_KEY,
    };
    return keys.openai || keys.google
      ? { ...keys, source: "platform" }
      : { source: "none" };
  }

  const secret = env.AI_KEYS_SECRET;
  const unseal = (value: string | null) =>
    value && secret ? (open(value, secret) ?? undefined) : undefined;
  const keys = { openai: unseal(row.openaiKey), google: unseal(row.googleKey) };
  return keys.openai || keys.google
    ? { ...keys, source: "workspace" }
    : { source: "none" };
}

/** What Settings shows: the last four characters of each saved key. */
export type AiKeyStatus = {
  canSave: boolean;
  openai: string | null;
  google: string | null;
};

export async function aiKeyStatus(workspaceId: string): Promise<AiKeyStatus> {
  const keys = await aiKeysFor(workspaceId);
  const tail = (key?: string) =>
    keys.source === "workspace" && key ? key.slice(-4) : null;
  return {
    canSave: Boolean(getServerEnv().AI_KEYS_SECRET),
    openai: tail(keys.openai),
    google: tail(keys.google),
  };
}

/** Saves (or, with null, removes) one provider's key. False when keys can't be stored. */
export async function storeAiKey(
  workspaceId: string,
  provider: AiKeyProvider,
  key: string | null,
): Promise<boolean> {
  const secret = getServerEnv().AI_KEYS_SECRET;
  if (!secret) return false;
  const value = key === null ? null : seal(key, secret);
  await adminDb
    .insert(workspaceAiKeys)
    .values({ workspaceId, [column[provider]]: value })
    .onConflictDoUpdate({
      target: workspaceAiKeys.workspaceId,
      set: { [column[provider]]: value, updatedAt: new Date() },
    });
  return true;
}

/**
 * Whether the provider accepts the key, by listing its models (free, no tokens used).
 * "unreachable" when the provider couldn't be asked, so a network blip isn't a bad key.
 */
export async function checkAiKey(
  provider: AiKeyProvider,
  key: string,
): Promise<"valid" | "invalid" | "unreachable"> {
  const request =
    provider === "openai"
      ? new Request("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        })
      : new Request(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
          { headers: { "x-goog-api-key": key } },
        );
  try {
    const response = await fetch(request, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "valid";
    return response.status >= 500 ? "unreachable" : "invalid";
  } catch {
    return "unreachable";
  }
}

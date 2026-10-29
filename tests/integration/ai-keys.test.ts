import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { adminDb } from "@/db/admin";
import { workspaceAiKeys, workspaces } from "@/db/schema";
import { aiKeyStatus, aiKeysFor, storeAiKey } from "@/privileged/ai-keys";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { asUser } from "../helpers/test-db";

// As if the platform had its own keys and the secret that encrypts saved ones.
vi.mock("@/env/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env/server")>();
  return {
    getServerEnv: () => ({
      ...actual.getServerEnv(),
      AI_KEYS_SECRET: "integration-secret-that-is-long-enough",
      OPENAI_API_KEY: "sk-platform",
      GOOGLE_GENERATIVE_AI_API_KEY: "AIza-platform",
    }),
  };
});

afterAll(cleanupTestData);

async function workspace() {
  const owner = await createTestUser();
  return { owner, ws: await createTestWorkspace(owner) };
}

describe("workspace AI keys", () => {
  it("a workspace answers with its own key, never the platform's", async () => {
    const { ws } = await workspace();
    expect(await aiKeysFor(ws.id)).toEqual({ source: "none" });

    expect(await storeAiKey(ws.id, "google", "AIza-own-key-9876")).toBe(true);
    expect(await aiKeysFor(ws.id)).toEqual({
      openai: undefined,
      google: "AIza-own-key-9876",
      source: "workspace",
    });
    expect(await aiKeyStatus(ws.id)).toEqual({
      canSave: true,
      openai: null,
      google: "9876",
    });

    // Stored encrypted, not as pasted.
    const [row] = await adminDb
      .select()
      .from(workspaceAiKeys)
      .where(eq(workspaceAiKeys.workspaceId, ws.id));
    expect(row.googleKey).not.toContain("own-key");

    await storeAiKey(ws.id, "openai", "sk-own-1111");
    await storeAiKey(ws.id, "google", null);
    expect(await aiKeysFor(ws.id)).toMatchObject({
      openai: "sk-own-1111",
      google: undefined,
      source: "workspace",
    });
  });

  it("demo copies answer with the platform's keys", async () => {
    const { ws } = await workspace();
    await adminDb
      .update(workspaces)
      .set({ demoExpiresAt: new Date(Date.now() + 3_600_000) })
      .where(eq(workspaces.id, ws.id));
    expect(await aiKeysFor(ws.id)).toEqual({
      openai: "sk-platform",
      google: "AIza-platform",
      source: "platform",
    });
    // Settings never shows the platform's keys.
    expect(await aiKeyStatus(ws.id)).toMatchObject({
      openai: null,
      google: null,
    });
  });

  it("no browser session can read or write the keys, not even the owner's", async () => {
    const { owner, ws } = await workspace();
    await storeAiKey(ws.id, "openai", "sk-own-2222");
    await expect(
      asUser(owner.id, (tx) => tx`select * from public.workspace_ai_keys`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        owner.id,
        (tx) =>
          tx`update public.workspace_ai_keys set openai_key = null where workspace_id = ${ws.id}`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(null, (tx) => tx`select * from public.workspace_ai_keys`),
    ).rejects.toThrow(/permission denied/);
  });
});

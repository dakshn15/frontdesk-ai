import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { messages } from "@/db/schema";
import {
  handleChat,
  handleSession,
  LIMITS,
} from "@/privileged/assistant/chat-api";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

function post(body: unknown, ip = crypto.randomUUID()) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function startSession() {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner);
  const response = await handleSession(post({ workspace: ws.slug }));
  expect(response.status).toBe(200);
  const { token } = (await response.json()) as { token: string };
  return { ws, token };
}

describe("chat API", () => {
  it("refuses bad bodies, unknown workspaces and unknown tokens", async () => {
    expect((await handleSession(post("not json"))).status).toBe(400);
    expect(
      (await handleSession(post({ workspace: "no-such-place" }))).status,
    ).toBe(404);
    expect((await handleChat(post({ token: "nope", text: "Hi" }))).status).toBe(
      401,
    );
    const { token } = await startSession();
    expect((await handleChat(post({ token, text: "" }))).status).toBe(400);
    expect(
      (await handleChat(post({ token, text: "x".repeat(2001) }))).status,
    ).toBe(400);
  });

  // Test workspaces have no AI key of their own, so the reply is the fixed one.
  it("streams a reply and keeps the conversation going", async () => {
    const { token } = await startSession();
    const first = await handleChat(post({ token, text: "Hi" }));
    expect(first.status).toBe(200);
    const conversationId = first.headers.get("x-conversation-id");
    expect(conversationId).toBeTruthy();
    const stream = await first.text();
    expect(stream).toContain("can't answer right now");
    expect(stream).toContain(conversationId);

    const second = await handleChat(
      post({ token, conversationId, text: "Still there?" }),
    );
    expect(second.headers.get("x-conversation-id")).toBe(conversationId);
    await second.text();
    const saved = await adminDb
      .select({ role: messages.role })
      .from(messages)
      .where(eq(messages.conversationId, conversationId!));
    expect(saved).toHaveLength(4);
  });

  it("limits how many messages a session can send", async () => {
    const { token } = await startSession();
    const statuses: number[] = [];
    for (let i = 0; i <= LIMITS.messagesPerSession.limit; i += 1) {
      const response = await handleChat(post({ token, text: `Message ${i}` }));
      statuses.push(response.status);
      await response.text();
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Each message also checks the plan's limits, so 21 of them take a while under load.
  }, 60_000);
});

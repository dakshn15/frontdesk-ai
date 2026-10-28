import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  emailLog,
  knowledgeChunks,
  leads,
  memberships,
  messages,
  profiles,
  rateLimitWindows,
  services,
  staff,
  workspaces,
} from "@/db/schema";
import { runAgent, UNAVAILABLE_REPLY } from "@/privileged/assistant/agent";
import { openConversation } from "@/privileged/assistant/sessions";
import { DEMO_LIMITS } from "@/privileged/demo/limits";
import { cleanupSandboxes, startSandbox } from "@/privileged/demo/sandboxes";
import {
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  trackWorkspace,
} from "../helpers/seed";
import { asUser, testSql } from "../helpers/test-db";

afterAll(cleanupTestData);

/** A Supabase anonymous user, as the demo's sign-in creates. */
async function anonymousUser(): Promise<string> {
  const id = crypto.randomUUID();
  await testSql`
    insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
    values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      true, now(), now())`;
  return id;
}

async function sandbox(ip = crypto.randomUUID()) {
  const userId = await anonymousUser();
  const result = await startSandbox({ userId, isAnonymous: true, ip });
  if (!result.ok) throw new Error(result.error);
  const [ws] = await adminDb
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, result.slug));
  trackWorkspace(ws.id);
  return { userId, ws, slug: result.slug };
}

const rows = async (table: typeof services, workspaceId: string) =>
  (
    await adminDb
      .select({ n: count() })
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
  )[0].n;

describe("demo sandboxes", () => {
  it("are a full copy of the demo salon, owned by the visitor, for 24 hours", async () => {
    const { userId, ws } = await sandbox();
    expect(ws.name).toBe("Bloom Hair & Beauty");
    expect(ws.timezone).toBe("America/Chicago");
    const hours = (ws.demoExpiresAt!.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    const [owner] = await adminDb
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, userId)),
      );
    expect(owner.role).toBe("owner");

    expect(await rows(services, ws.id)).toBe(15);
    expect(await rows(staff as never, ws.id)).toBe(4);
    expect(await rows(bookings as never, ws.id)).toBeGreaterThan(10);
    // 4 sample chats for the inbox, plus a month of tagged history for analytics.
    expect(await rows(conversations as never, ws.id)).toBeGreaterThan(60);
    expect(await rows(leads as never, ws.id)).toBeGreaterThan(3);
    expect(await rows(knowledgeChunks as never, ws.id)).toBeGreaterThan(5);
    expect(await rows(emailLog as never, ws.id)).toBeGreaterThan(0);
    // Every seeded customer address is a safe example address.
    const addresses = await adminDb
      .select({ to: emailLog.toEmail })
      .from(emailLog)
      .where(eq(emailLog.workspaceId, ws.id));
    for (const { to } of addresses) expect(to).toMatch(/@example\.com$/);
    // AI answers carry their sources.
    const answers = await adminDb
      .select({ sources: messages.sources })
      .from(messages)
      .where(and(eq(messages.workspaceId, ws.id), eq(messages.role, "ai")));
    expect(
      answers.filter((answer) => (answer.sources as unknown[]).length > 0)
        .length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("gives a returning visitor the sandbox they already have", async () => {
    const { userId, slug } = await sandbox();
    expect(
      await startSandbox({ userId, isAnonymous: true, ip: "1.2.3.4" }),
    ).toEqual({ ok: true, slug });
  });

  it("are only for anonymous demo users", async () => {
    const user = await createTestUser();
    expect(
      await startSandbox({ userId: user.id, isAnonymous: false, ip: "x" }),
    ).toEqual({ ok: false, error: "not_anonymous" });
  });

  it("are limited per visitor address and in total", async () => {
    const ip = crypto.randomUUID();
    for (let i = 0; i < DEMO_LIMITS.sandboxesPerIp.limit; i++)
      await sandbox(ip);
    expect(
      await startSandbox({
        userId: await anonymousUser(),
        isAnonymous: true,
        ip,
      }),
    ).toEqual({ ok: false, error: "rate_limited" });
    expect(
      await startSandbox(
        { userId: await anonymousUser(), isAnonymous: true, ip: "y" },
        { maxLive: 0 },
      ),
    ).toEqual({ ok: false, error: "full" });
  });

  it("are deleted with their visitor once expired", async () => {
    const expired = await sandbox();
    const live = await sandbox();
    await adminDb
      .update(workspaces)
      .set({ demoExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(workspaces.id, expired.ws.id));
    const removed = await cleanupSandboxes();
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = await adminDb
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(inArray(workspaces.id, [expired.ws.id, live.ws.id]));
    expect(left).toEqual([{ id: live.ws.id }]);
    const users = await adminDb
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, [expired.userId, live.userId]));
    expect(users).toEqual([{ id: live.userId }]);
  });
});

describe("demo guards", () => {
  it("anonymous users can't create workspaces or accept invites", async () => {
    const userId = await anonymousUser();
    await expect(
      asUser(
        userId,
        (tx) =>
          tx`select private.create_workspace('Mine', ${`anon-${userId.slice(0, 8)}`}, '', 'America/Chicago', 'USD')`,
      ),
    ).rejects.toThrow(/anonymous_user/);
    await expect(
      asUser(userId, (tx) => tx`select private.accept_invitation('any-token')`),
    ).rejects.toThrow(/anonymous_user/);
  });

  it("a sandbox can't invite anyone", async () => {
    const { ws, userId } = await sandbox();
    await expect(
      testSql`insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
        values (${ws.id}, 'friend@example.com', 'staff', ${crypto.randomUUID()}, ${userId}, now() + interval '1 day')`,
    ).rejects.toThrow(/demo_workspace/);
  });

  it("demo replies share a daily cap, then offer the lead form", async () => {
    const { ws } = await sandbox();
    const owner = await createTestUser();
    const real = await createTestWorkspace(owner);
    const { limit, windowSeconds } = DEMO_LIMITS.aiMessagesPerDay;
    const size = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(Date.now() / size) * size);
    await adminDb
      .insert(rateLimitWindows)
      .values({ key: DEMO_LIMITS.aiKey, windowStart, count: limit })
      .onConflictDoUpdate({
        target: [rateLimitWindows.key, rateLimitWindows.windowStart],
        set: { count: limit },
      });
    try {
      const demoChat = await openConversation({
        workspaceId: ws.id,
        channel: "widget",
        sessionId: null,
      });
      const demo = await runAgent({
        workspaceId: ws.id,
        conversationId: demoChat,
        mode: "live",
        text: "Hi",
      });
      expect(demo.fixedReply).toBe(UNAVAILABLE_REPLY);
      // Real businesses aren't affected by the demo cap.
      const realChat = await openConversation({
        workspaceId: real.id,
        channel: "widget",
        sessionId: null,
      });
      const other = await runAgent({
        workspaceId: real.id,
        conversationId: realChat,
        mode: "live",
        text: "Hi",
      });
      await other.response().text();
      const [{ value }] = await adminDb
        .select({ value: rateLimitWindows.count })
        .from(rateLimitWindows)
        .where(eq(rateLimitWindows.key, DEMO_LIMITS.aiKey));
      expect(value).toBe(limit + 1);
    } finally {
      await adminDb
        .delete(rateLimitWindows)
        .where(eq(rateLimitWindows.key, DEMO_LIMITS.aiKey));
    }
  });
});

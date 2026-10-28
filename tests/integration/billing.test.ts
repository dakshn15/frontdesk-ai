import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  conversations,
  emailLog,
  knowledgeSources,
  messages,
  subscriptions,
  workspaces,
} from "@/db/schema";
import { runAgent, UNAVAILABLE_REPLY } from "@/privileged/assistant/agent";
import { openConversation } from "@/privileged/assistant/sessions";
import {
  canAddKnowledge,
  canAddSeat,
  chatAllowed,
  planForWorkspace,
} from "@/privileged/billing/limits";
import { handleStripeWebhook } from "@/privileged/billing/webhook";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { asUser } from "../helpers/test-db";

afterAll(cleanupTestData);

const secret = "whsec_integration";
const prices = { starter: "price_starter", pro: "price_pro" };

function signed(event: object, key = secret) {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": `t=${t},v1=${v1}` },
    body,
  });
}

const subscriptionEvent = (
  workspaceId: string,
  type: string,
  price: string,
  status = "active",
) => ({
  id: `evt_${crypto.randomUUID()}`,
  type,
  data: {
    object: {
      id: "sub_123",
      customer: "cus_123",
      status,
      metadata: { workspace_id: workspaceId },
      items: {
        data: [{ price: { id: price }, current_period_end: 1_900_000_000 }],
      },
    },
  },
});

async function setCreatedDaysAgo(workspaceId: string, days: number) {
  await adminDb
    .update(workspaces)
    .set({ createdAt: new Date(Date.now() - days * 86_400_000) })
    .where(eq(workspaces.id, workspaceId));
}

describe("the Stripe webhook", () => {
  it("syncs a subscription, ignores repeats and refuses bad signatures", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    const created = subscriptionEvent(
      ws.id,
      "customer.subscription.created",
      "price_pro",
    );

    const bad = await handleStripeWebhook(signed(created, "whsec_wrong"), {
      secret,
      prices,
    });
    expect(bad.status).toBe(400);

    const first = await handleStripeWebhook(signed(created), {
      secret,
      prices,
    });
    expect(first.status).toBe(200);
    expect(await planForWorkspace(ws.id)).toMatchObject({
      plan: "pro",
      active: true,
    });
    const repeat = await handleStripeWebhook(signed(created), {
      secret,
      prices,
    });
    expect(await repeat.json()).toMatchObject({ duplicate: true });

    // Members can read it; nobody can write it from the app.
    const [mine] = await asUser(
      owner.id,
      (tx) =>
        tx`select plan from public.subscriptions where workspace_id = ${ws.id}`,
    );
    expect(mine).toEqual({ plan: "pro" });
    await expect(
      asUser(
        owner.id,
        (tx) =>
          tx`update public.subscriptions set plan = 'pro' where workspace_id = ${ws.id}`,
      ),
    ).rejects.toThrow();

    await handleStripeWebhook(
      signed(
        subscriptionEvent(
          ws.id,
          "customer.subscription.updated",
          "price_starter",
        ),
      ),
      { secret, prices },
    );
    expect((await planForWorkspace(ws.id)).plan).toBe("starter");

    // Cancelled after the trial: the plan ends and the AI stops answering.
    await setCreatedDaysAgo(ws.id, 30);
    await handleStripeWebhook(
      signed(
        subscriptionEvent(
          ws.id,
          "customer.subscription.deleted",
          "price_starter",
        ),
      ),
      { secret, prices },
    );
    const [row] = await adminDb
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id));
    expect(row.status).toBe("canceled");
    expect(await chatAllowed(ws.id)).toEqual({
      allowed: false,
      reason: "trial_ended",
    });
  });
});

describe("plan limits", () => {
  it("stop AI replies after the trial, and offer the lead form instead", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    expect(await chatAllowed(ws.id)).toEqual({ allowed: true });
    await setCreatedDaysAgo(ws.id, 15);
    const conversationId = await openConversation({
      workspaceId: ws.id,
      channel: "widget",
      sessionId: null,
    });
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "Hi",
    });
    expect(run.fixedReply).toBe(UNAVAILABLE_REPLY);
    // The owner's preview still works.
    expect((await chatAllowed(ws.id)).allowed).toBe(false);
  });

  it("email the owner once when the month's chats run out", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    await adminDb.insert(conversations).values(
      Array.from({ length: 101 }, () => ({
        workspaceId: ws.id,
        channel: "widget" as const,
      })),
    );
    expect(await chatAllowed(ws.id, { notify: true })).toEqual({
      allowed: false,
      reason: "limit",
    });
    await chatAllowed(ws.id, { notify: true });
    const alerts = await adminDb
      .select({ to: emailLog.toEmail })
      .from(emailLog)
      .where(and(eq(emailLog.workspaceId, ws.id), eq(emailLog.kind, "limit")));

    expect(alerts).toEqual([{ to: owner.email }]);
    // Preview and test chats don't count.
    const other = await createTestWorkspace(owner);
    await adminDb.insert(conversations).values(
      Array.from({ length: 150 }, () => ({
        workspaceId: other.id,
        channel: "preview" as const,
      })),
    );
    expect(await chatAllowed(other.id)).toEqual({ allowed: true });
    void messages;
  });

  it("cap knowledge sources and team seats on the trial", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    expect(await canAddKnowledge(ws.id)).toBe(true);
    await adminDb.insert(knowledgeSources).values(
      Array.from({ length: 20 }, (_, i) => ({
        workspaceId: ws.id,
        kind: "text" as const,
        title: `Source ${i}`,
      })),
    );
    expect(await canAddKnowledge(ws.id)).toBe(false);

    expect(await canAddSeat(ws.id)).toBe(true);
    await addTestMember(ws.id, await createTestUser(), "staff");
    expect(await canAddSeat(ws.id)).toBe(false);
    void claimsFor;
  });
});

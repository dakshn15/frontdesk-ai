import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import { bookings, conversations, messages, toolCalls } from "@/db/schema";
import { getAnalytics } from "@/features/analytics/queries";
import { addDays, localDate } from "@/lib/clock";
import { createSecretToken } from "@/lib/secret-token";
import { tagQuietConversations } from "@/privileged/analytics/tag";
import { seedDemoWorkspace } from "@/privileged/demo/seed";
import {
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
  trackWorkspace,
} from "../helpers/seed";

afterAll(cleanupTestData);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function chat(
  workspaceId: string,
  input: {
    channel?: "widget" | "preview";
    quietFor: number;
    visitor: string;
    ai: string;
    tools?: string[];
  },
) {
  const [row] = await adminDb
    .insert(conversations)
    .values({
      workspaceId,
      channel: input.channel ?? "widget",
      createdAt: minutesAgo(input.quietFor + 5),
      lastMessageAt: minutesAgo(input.quietFor),
    })
    .returning({ id: conversations.id });
  await adminDb.insert(messages).values([
    {
      workspaceId,
      conversationId: row.id,
      role: "visitor",
      content: input.visitor,
    },
    { workspaceId, conversationId: row.id, role: "ai", content: input.ai },
  ]);
  for (const tool of input.tools ?? []) {
    await adminDb
      .insert(toolCalls)
      .values({ workspaceId, conversationId: row.id, tool, input: {} });
  }
  return row.id;
}

const tags = async (ids: string[]) =>
  Object.fromEntries(
    (
      await adminDb
        .select({
          id: conversations.id,
          topic: conversations.topic,
          outcome: conversations.outcome,
        })
        .from(conversations)
        .where(inArray(conversations.id, ids))
    ).map((row) => [row.id, { topic: row.topic, outcome: row.outcome }]),
  );

describe("tagging quiet chats", () => {
  it("tags chats quiet for 30 minutes with a topic and an outcome", async () => {
    const owner = await createTestUser();
    const ws = await createTestWorkspace(owner);
    const booked = await chat(ws.id, {
      quietFor: 120,
      visitor: "Can I come in on Friday?",
      ai: "You're booked.",
      tools: ["check_availability", "propose_booking"],
    });
    const start = new Date();
    await adminDb.insert(bookings).values({
      workspaceId: ws.id,
      conversationId: booked,
      serviceName: "Cut",
      staffName: "Maya",
      durationMinutes: 30,
      bufferMinutes: 0,
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60_000),
      occupiedUntil: new Date(start.getTime() + 30 * 60_000),
      status: "completed",
      source: "widget",
      manageTokenHash: createSecretToken().hash,
    });
    const unanswered = await chat(ws.id, {
      quietFor: 45,
      visitor: "Can I bring my dog?",
      ai: "I'm not sure about that.",
    });
    const recent = await chat(ws.id, {
      quietFor: 5,
      visitor: "Is there parking?",
      ai: "Yes.",
    });
    const preview = await chat(ws.id, {
      channel: "preview",
      quietFor: 120,
      visitor: "Is there parking?",
      ai: "Yes.",
    });

    expect(await tagQuietConversations({ workspaceId: ws.id })).toBe(2);
    expect(await tags([booked, unanswered, recent, preview])).toEqual({
      [booked]: { topic: "Booking", outcome: "booked" },
      [unanswered]: { topic: "Other", outcome: "unanswered" },
      [recent]: { topic: null, outcome: null },
      [preview]: { topic: null, outcome: null },
    });
    // Nothing new: nothing to do. A new message since tagging means tagging again.
    expect(await tagQuietConversations({ workspaceId: ws.id })).toBe(0);
    await adminDb
      .update(conversations)
      .set({ lastMessageAt: new Date(Date.now() + 1000) })
      .where(eq(conversations.id, unanswered));
    expect(
      await tagQuietConversations({
        workspaceId: ws.id,
        now: new Date(Date.now() + 31 * 60_000),
      }),
      // The edited chat, and the recent one, which has now been quiet long enough too.
    ).toBe(2);
  });
});

describe("analytics", () => {
  it("adds up a demo salon's month, for members only", async () => {
    const owner = await createTestUser();
    const outsider = await createTestUser();
    const { id } = await seedDemoWorkspace(
      owner.id,
      new Date(Date.now() + 3_600_000),
    );
    trackWorkspace(id);
    await tagQuietConversations({ workspaceId: id });
    const timeZone = "America/Chicago";
    const to = localDate(timeZone);
    const range = { from: addDays(to, -29), to, timeZone };
    const result = await getAnalytics(claimsFor(owner), id, range);

    expect(result.daily).toHaveLength(30);
    expect(result.summary.conversations).toBeGreaterThan(50);
    expect(result.summary.aiBookings).toBeGreaterThan(0);
    expect(result.summary.leads).toBeGreaterThan(0);
    expect(result.summary.handedOff).toBeGreaterThan(0);
    expect(result.summary.resolvedWithoutHuman).toBeLessThanOrEqual(
      result.summary.tagged,
    );
    expect(result.topics.map((row) => row.topic)).toContain("Booking");
    expect(result.daily.reduce((sum, day) => sum + day.conversations, 0)).toBe(
      result.summary.conversations,
    );
    expect(
      result.usage.reduce((sum, row) => sum + row.cost, 0),
    ).toBeGreaterThan(0);

    // A one-day range only counts that day.
    const today = await getAnalytics(claimsFor(owner), id, {
      from: to,
      to,
      timeZone,
    });
    expect(today.daily).toHaveLength(1);
    expect(today.summary.conversations).toBeLessThan(
      result.summary.conversations,
    );

    const hidden = await getAnalytics(claimsFor(outsider), id, range);
    expect(hidden.summary.conversations).toBe(0);
    expect(hidden.usage).toEqual([]);
  });
});

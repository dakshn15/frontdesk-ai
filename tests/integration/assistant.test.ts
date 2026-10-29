import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  emailLog,
  knowledgeChunks,
  leads,
  messages,
  rateLimitWindows,
  toolCalls,
  usageEvents,
  verifiedAnswers,
  visitorSessions,
} from "@/db/schema";
import { createBookingRecord } from "@/features/bookings/records";
import { addSourceRecord } from "@/features/knowledge/records";
import {
  addDays,
  isoWeekday,
  localDate,
  zonedDateTimeToUtc,
} from "@/lib/clock";
import { runAgent, UNAVAILABLE_REPLY } from "@/privileged/assistant/agent";
import {
  createVisitorSession,
  openConversation,
  sessionFromToken,
} from "@/privileged/assistant/sessions";
import { buildTools, type Source } from "@/privileged/assistant/tools";
import { allowRequest, pruneRateLimits } from "@/privileged/rate-limit";
import {
  claimsFor,
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  linkTestStaffService,
  setTestStaffHours,
  type TestUser,
} from "../helpers/seed";

afterAll(cleanupTestData);

const TZ = "America/Chicago";
const usage = {
  inputTokens: {
    total: 12,
    noCache: 12,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** A model that plays back one scripted step per call. */
function scripted(steps: LanguageModelV4StreamPart[][]) {
  let call = 0;
  return {
    provider: "test",
    modelId: "scripted",
    model: new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: steps[Math.min(call++, steps.length - 1)],
        }),
      }),
    }),
  };
}

const callTool = (
  toolName: string,
  input: object,
): LanguageModelV4StreamPart[] => [
  {
    type: "tool-call",
    toolCallId: `call-${toolName}`,
    toolName,
    input: JSON.stringify(input),
  },
  {
    type: "finish",
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
  },
];
const say = (text: string): LanguageModelV4StreamPart[] => [
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: text },
  { type: "text-end", id: "t" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
];

async function workspace(name = "Bloom Studio") {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name });
  const conversationId = await openConversation({
    workspaceId: ws.id,
    channel: "widget",
    sessionId: null,
  });
  return { owner, ws, conversationId };
}

function toolsFor(
  wsId: string,
  conversationId: string,
  mode: "live" | "dry" = "live",
  sources = new Map<string, Source>(),
) {
  return buildTools(
    {
      workspaceId: wsId,
      conversationId,
      mode,
      timeZone: TZ,
      currency: "USD",
      now: new Date(),
    },
    sources,
  );
}

// Tools take (input, options); the options don't matter here.
const options = { toolCallId: "t", messages: [] } as never;

async function bookable(owner: TestUser, wsId: string) {
  const { id: cut } = await createTestService(wsId, owner, {
    name: "Cut",
    priceCents: 4500,
  });
  const { id: maya } = await createTestStaff(wsId, owner, { name: "Maya" });
  await setTestStaffHours(
    wsId,
    owner,
    maya,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMinute: 540,
      endMinute: 1020,
    })),
  );
  await linkTestStaffService(wsId, owner, maya, cut);
  return { cut, maya };
}

describe("runAgent", () => {
  it("answers with tools and saves the turn, tool calls and usage", async () => {
    const { owner, ws, conversationId } = await workspace();
    await createTestService(ws.id, owner, { name: "Cut" });
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "What do you offer?",
      model: scripted([callTool("get_services", {}), say("We offer a cut.")]),
    });
    await run.done;

    const saved = await adminDb
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    expect(saved).toEqual([
      { role: "visitor", content: "What do you offer?" },
      { role: "ai", content: "We offer a cut." },
    ]);
    const [call] = await adminDb
      .select({ tool: toolCalls.tool, output: toolCalls.output })
      .from(toolCalls)
      .where(eq(toolCalls.conversationId, conversationId));
    expect(call.tool).toBe("get_services");
    expect(JSON.stringify(call.output)).toContain("Cut");
    const [usageRow] = await adminDb
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.conversationId, conversationId));
    expect(usageRow).toMatchObject({
      provider: "test",
      inputTokens: 24,
      outputTokens: 10,
    });
  });

  it("keeps the sources an answer used", async () => {
    const { ws, conversationId } = await workspace();
    await adminDb.insert(verifiedAnswers).values({
      workspaceId: ws.id,
      question: "Do you do bridal hair?",
      answer: "Yes, with a trial first.",
    });
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "bridal hair?",
      model: scripted([
        callTool("find_verified_answer", { question: "bridal hair" }),
        say("Yes, with a trial first."),
      ]),
    });
    await run.done;
    const [answer] = await adminDb
      .select({ sources: messages.sources })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.role, "ai"),
        ),
      );
    expect(answer.sources).toEqual([
      expect.objectContaining({
        kind: "answer",
        title: "Do you do bridal hair?",
      }),
    ]);
  });

  it("without an AI key, replies that it can't answer and saves that", async () => {
    const { ws, conversationId } = await workspace();
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "Hi",
    });
    expect(run.fixedReply).toBe(UNAVAILABLE_REPLY);
    const roles = await adminDb
      .select({ role: messages.role })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(roles.map((r) => r.role).sort()).toEqual(["ai", "visitor"]);
  });

  it("stays quiet once a person has taken over", async () => {
    const { ws, conversationId } = await workspace();
    await adminDb
      .update(conversations)
      .set({ status: "human" })
      .where(eq(conversations.id, conversationId));
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "Hello?",
      model: scripted([say("I should not speak.")]),
    });
    expect(run.fixedReply).toBe("");
    const saved = await adminDb
      .select({ role: messages.role })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(saved).toEqual([{ role: "visitor" }]);
  });
});

describe("tools", () => {
  it("only ever see their own workspace", async () => {
    const a = await workspace("Bloom");
    const b = await workspace("Other");
    await createTestService(a.ws.id, a.owner, { name: "Cut" });
    await createTestService(b.ws.id, b.owner, { name: "Secret service" });
    const source = await addSourceRecord(claimsFor(b.owner), b.ws.id, {
      kind: "text",
      title: "Theirs",
      content: "x",
    });
    if (!source.ok) throw new Error(source.error);
    await adminDb.insert(knowledgeChunks).values({
      workspaceId: b.ws.id,
      sourceId: source.id,
      position: 0,
      content: "The secret password is swordfish.",
    });

    const tools = toolsFor(a.ws.id, a.conversationId);
    const servicesOut = await tools.get_services.execute!({}, options);
    expect(JSON.stringify(servicesOut)).toContain("Cut");
    expect(JSON.stringify(servicesOut)).not.toContain("Secret");
    const found = await tools.search_knowledge.execute!(
      { query: "secret password" },
      options,
    );
    expect(found).toMatchObject({ confidence: "none", passages: [] });
  });

  it("propose_booking checks the time and never books", async () => {
    const { owner, ws, conversationId } = await workspace();
    const { cut, maya } = await bookable(owner, ws.id);
    const tools = toolsFor(ws.id, conversationId);
    const day = addDays(localDate(TZ), 7);
    const available = (await tools.check_availability.execute!(
      { serviceId: cut, fromDate: day, days: 1 },
      options,
    )) as { slots: { startsAt: string }[] };
    expect(available.slots.length).toBeGreaterThan(0);
    const first = available.slots[0];
    const proposal = await tools.propose_booking.execute!(
      { serviceId: cut, staffId: maya, startsAt: first.startsAt },
      options,
    );
    expect(proposal).toMatchObject({
      ok: true,
      card: { serviceName: "Cut", staffName: "Maya", price: "$45" },
    });
    const taken = await tools.propose_booking.execute!(
      {
        serviceId: cut,
        staffId: maya,
        startsAt: zonedDateTimeToUtc(day, "03:00", TZ).toISOString(),
      },
      options,
    );
    expect(taken).toMatchObject({ ok: false });
    const rows = await adminDb
      .select()
      .from(bookings)
      .where(eq(bookings.workspaceId, ws.id));
    expect(rows).toEqual([]);
  });

  it("leads and handoffs are saved live and not in a dry run", async () => {
    const live = await workspace();
    const dry = await workspace();
    const lead = {
      name: "Ana",
      email: "Ana@Example.com",
      message: "Wedding in May",
    };
    await toolsFor(live.ws.id, live.conversationId).capture_lead.execute!(
      lead,
      options,
    );
    await toolsFor(dry.ws.id, dry.conversationId, "dry").capture_lead.execute!(
      lead,
      options,
    );
    await toolsFor(live.ws.id, live.conversationId).handoff_to_human.execute!(
      { reason: "Wants a person" },
      options,
    );
    await toolsFor(dry.ws.id, dry.conversationId, "dry").handoff_to_human
      .execute!({ reason: "Wants a person" }, options);
    const liveLeads = await adminDb
      .select()
      .from(leads)
      .where(eq(leads.workspaceId, live.ws.id));
    expect(liveLeads).toEqual([
      expect.objectContaining({ email: "ana@example.com" }),
    ]);
    expect(
      await adminDb
        .select()
        .from(leads)
        .where(eq(leads.workspaceId, dry.ws.id)),
    ).toEqual([]);
    const status = async (id: string) =>
      (
        await adminDb
          .select()
          .from(conversations)
          .where(eq(conversations.id, id))
      )[0].status;
    expect(await status(live.conversationId)).toBe("needs_human");
    expect(await status(dry.conversationId)).toBe("ai");
  });

  it("send_manage_link emails only the booking's address, at most once in 10 minutes", async () => {
    const { owner, ws, conversationId } = await workspace();
    const { cut, maya } = await bookable(owner, ws.id);
    let day = addDays(localDate(TZ), 7);
    while (isoWeekday(day) === 7) day = addDays(day, 1);
    const booked = await createBookingRecord(claimsFor(owner), ws.id, {
      serviceId: cut,
      staffId: maya,
      startsAt: zonedDateTimeToUtc(day, "10:00", TZ),
      customer: { name: "Ana", email: "ana@example.com", phone: "" },
      notes: "",
    });
    if (!booked.ok) throw new Error(booked.error);
    const tools = toolsFor(ws.id, conversationId);
    const replies = [
      await tools.send_manage_link.execute!(
        { email: "ANA@example.com" },
        options,
      ),
      await tools.send_manage_link.execute!(
        { email: "ana@example.com" },
        options,
      ),
      await tools.send_manage_link.execute!(
        { email: "nobody@example.com" },
        options,
      ),
    ];
    // The same reply every time, so it reveals nothing about who has a booking.
    const messagesSent = replies.map((r) => (r as { message: string }).message);
    expect(new Set(messagesSent).size).toBe(1);
    const sent = await adminDb
      .select({ to: emailLog.toEmail, text: emailLog.text })
      .from(emailLog)
      .where(
        and(eq(emailLog.workspaceId, ws.id), eq(emailLog.kind, "booking_link")),
      );
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ana@example.com");
    expect(sent[0].text).toContain("/b/");
  });
});

describe("visitor sessions and limits", () => {
  it("tokens open their own workspace's conversations and expire", async () => {
    const { ws } = await workspace();
    const other = await workspace();
    const session = await createVisitorSession(ws.slug);
    if (!session) throw new Error("no session");
    const found = await sessionFromToken(session.token);
    expect(found?.workspaceId).toBe(ws.id);
    expect(
      await sessionFromToken(
        session.token,
        new Date(Date.now() + 25 * 3_600_000),
      ),
    ).toBeNull();
    expect(await sessionFromToken("made-up-token")).toBeNull();
    expect(await createVisitorSession("no-such-workspace")).toBeNull();

    const first = await openConversation({
      workspaceId: ws.id,
      channel: "widget",
      sessionId: found!.sessionId,
    });
    expect(
      await openConversation({
        workspaceId: ws.id,
        channel: "widget",
        sessionId: found!.sessionId,
        conversationId: first,
      }),
    ).toBe(first);
    // Someone else's conversation id starts a new conversation instead.
    expect(
      await openConversation({
        workspaceId: ws.id,
        channel: "widget",
        sessionId: found!.sessionId,
        conversationId: other.conversationId,
      }),
    ).not.toBe(other.conversationId);
    await adminDb
      .delete(visitorSessions)
      .where(eq(visitorSessions.workspaceId, ws.id));
  });

  it("allowRequest counts within a window", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const now = new Date();
    const results = [];
    for (let i = 0; i < 3; i += 1)
      results.push(await allowRequest(key, 2, 60, now));
    expect(results).toEqual([true, true, false]);
  });

  it("pruning keeps windows that may still be open, up to the longest (40 days)", async () => {
    const live = `test:${crypto.randomUUID()}`;
    const old = `test:${crypto.randomUUID()}`;
    const day = 86_400_000;
    await adminDb.insert(rateLimitWindows).values([
      { key: live, windowStart: new Date(Date.now() - 20 * day), count: 1 },
      { key: old, windowStart: new Date(Date.now() - 50 * day), count: 1 },
    ]);
    await pruneRateLimits();
    const left = await adminDb
      .select({ key: rateLimitWindows.key })
      .from(rateLimitWindows)
      .where(inArray(rateLimitWindows.key, [live, old]));
    expect(left).toEqual([{ key: live }]);
  });
});

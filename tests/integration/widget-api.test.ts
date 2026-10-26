import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  bookings,
  conversations,
  emailLog,
  leads,
  messages,
  workspaces,
} from "@/db/schema";
import { addDays, localDate } from "@/lib/clock";
import { handleChat, handleSession } from "@/privileged/assistant/chat-api";
import {
  openConversation,
  sessionFromToken,
} from "@/privileged/assistant/sessions";
import { buildTools } from "@/privileged/assistant/tools";
import { handleBook, handleHistory, handleLead } from "@/privileged/widget/api";
import {
  cleanupTestData,
  createTestService,
  createTestStaff,
  createTestUser,
  createTestWorkspace,
  linkTestStaffService,
  setTestStaffHours,
} from "../helpers/seed";

afterAll(cleanupTestData);

const TZ = "America/Chicago";
const options = { toolCallId: "t", messages: [] } as never;

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function setup(allowedDomains: string[] = []) {
  const owner = await createTestUser();
  const ws = await createTestWorkspace(owner, { name: "Bloom Studio" });
  await adminDb
    .update(workspaces)
    .set({ allowedDomains, timezone: TZ })
    .where(eq(workspaces.id, ws.id));
  return { owner, ws };
}

async function chat(slug: string) {
  const response = await handleSession(
    post("/api/chat/session", { workspace: slug }),
  );
  const { token } = (await response.json()) as { token: string };
  const session = (await sessionFromToken(token))!;
  const conversationId = await openConversation({
    workspaceId: session.workspaceId,
    channel: "widget",
    sessionId: session.sessionId,
  });
  return { token, conversationId };
}

async function proposal() {
  const { owner, ws } = await setup();
  const { id: serviceId } = await createTestService(ws.id, owner, {
    name: "Cut",
    priceCents: 4500,
  });
  const { id: staffId } = await createTestStaff(ws.id, owner, {
    name: "Maya",
  });
  await setTestStaffHours(
    ws.id,
    owner,
    staffId,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMinute: 540,
      endMinute: 1020,
    })),
  );
  await linkTestStaffService(ws.id, owner, staffId, serviceId);
  const { token, conversationId } = await chat(ws.slug);
  const tools = buildTools(
    {
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      timeZone: TZ,
      currency: "USD",
      now: new Date(),
    },
    new Map(),
  );
  const { slots } = (await tools.check_availability.execute!(
    { serviceId, fromDate: addDays(localDate(TZ), 7), days: 1 },
    options,
  )) as { slots: { startsAt: string }[] };
  const offered = await tools.propose_booking.execute!(
    { serviceId, staffId, startsAt: slots[0].startsAt },
    options,
  );
  expect(offered).toMatchObject({ ok: true });
  return {
    ws,
    token,
    conversationId,
    card: { serviceId, staffId, startsAt: slots[0].startsAt },
    other: slots[1].startsAt,
  };
}

const customer = { name: "Ana Diaz", email: "Ana@Example.com", phone: "" };

describe("widget sessions and origins", () => {
  it("only starts a chat on an allowed website", async () => {
    const { ws } = await setup(["bloomsalon.com"]);
    const start = (host?: string) =>
      handleSession(post("/api/chat/session", { workspace: ws.slug, host }));
    expect((await start("evil.io")).status).toBe(403);
    expect((await start()).status).toBe(403);
    expect((await start("www.bloomsalon.com")).status).toBe(200);
    // The app's own page ("Try it") always works.
    expect((await start("localhost")).status).toBe(200);
  });

  it("refuses requests sent from other websites", async () => {
    const { ws } = await setup();
    const evil = { origin: "https://evil.io" };
    expect(
      (
        await handleSession(
          post("/api/chat/session", { workspace: ws.slug }, evil),
        )
      ).status,
    ).toBe(403);
    const { token } = await chat(ws.slug);
    expect(
      (await handleChat(post("/api/chat", { token, text: "Hi" }, evil))).status,
    ).toBe(403);
    expect(
      (await handleHistory(post("/api/widget/history", { token }, evil)))
        .status,
    ).toBe(403);
    expect(
      (
        await handleSession(
          post(
            "/api/chat/session",
            { workspace: ws.slug },
            { origin: "http://localhost" },
          ),
        )
      ).status,
    ).toBe(200);
  });
});

describe("widget history", () => {
  it("returns the session's own conversation and nobody else's", async () => {
    const { ws } = await setup();
    const mine = await chat(ws.slug);
    const theirs = await chat(ws.slug);
    await adminDb.insert(messages).values({
      workspaceId: ws.id,
      conversationId: mine.conversationId,
      role: "visitor",
      content: "Do you have parking?",
    });
    await adminDb
      .update(conversations)
      .set({ status: "needs_human" })
      .where(eq(conversations.id, mine.conversationId));

    const own = await handleHistory(
      post("/api/widget/history", {
        token: mine.token,
        conversationId: mine.conversationId,
      }),
    );
    expect(await own.json()).toMatchObject({
      status: "needs_human",
      messages: [{ role: "visitor", content: "Do you have parking?" }],
    });
    const stolen = await handleHistory(
      post("/api/widget/history", {
        token: theirs.token,
        conversationId: mine.conversationId,
      }),
    );
    expect(await stolen.json()).toEqual({ status: "ai", messages: [] });
    expect(
      (await handleHistory(post("/api/widget/history", { token: "made-up" })))
        .status,
    ).toBe(401);
  });
});

describe("booking from the widget", () => {
  it("books the offered time once, and emails the customer", async () => {
    const { ws, token, conversationId, card } = await proposal();
    const book = () =>
      handleBook(
        post("/api/widget/book", {
          token,
          conversationId,
          ...card,
          ...customer,
        }),
      );
    const first = await book();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      ok: true,
      message: expect.stringContaining("You're booked"),
    });
    const rows = await adminDb
      .select({ source: bookings.source, staffName: bookings.staffName })
      .from(bookings)
      .where(eq(bookings.workspaceId, ws.id));
    expect(rows).toEqual([{ source: "widget", staffName: "Maya" }]);
    const emails = await adminDb
      .select({ to: emailLog.toEmail })
      .from(emailLog)
      .where(eq(emailLog.workspaceId, ws.id));
    expect(emails).toEqual([{ to: "ana@example.com" }]);
    const saved = await adminDb
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.role, "ai"),
        ),
      );
    expect(saved[0].content).toContain("You're booked");

    const again = await book();
    expect(again.status).toBe(409);
  });

  it("refuses a time the receptionist never offered", async () => {
    const { ws, token, conversationId, card, other } = await proposal();
    const response = await handleBook(
      post("/api/widget/book", {
        token,
        conversationId,
        ...card,
        startsAt: other,
        ...customer,
      }),
    );
    expect(response.status).toBe(400);
    // Another visitor can't use this conversation's offer either.
    const stranger = await chat(ws.slug);
    const stolen = await handleBook(
      post("/api/widget/book", {
        token: stranger.token,
        conversationId,
        ...card,
        ...customer,
      }),
    );
    expect(stolen.status).toBe(400);
    const rows = await adminDb
      .select()
      .from(bookings)
      .where(eq(bookings.workspaceId, ws.id));
    expect(rows).toEqual([]);
  });

  it("checks the customer's details", async () => {
    const { token, conversationId, card } = await proposal();
    const response = await handleBook(
      post("/api/widget/book", {
        token,
        conversationId,
        ...card,
        name: "",
        email: "not-an-email",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      fieldErrors: { name: expect.any(Array), email: expect.any(Array) },
    });
  });
});

describe("leads from the widget", () => {
  it("saves the visitor's details with their conversation, five an hour", async () => {
    const { ws } = await setup();
    const { token, conversationId } = await chat(ws.slug);
    const send = () =>
      handleLead(
        post("/api/widget/lead", {
          token,
          conversationId,
          ...customer,
          message: "Bridal party in May",
        }),
      );
    const first = await send();
    expect(first.status).toBe(200);
    const saved = await adminDb
      .select({
        email: leads.email,
        conversationId: leads.conversationId,
        message: leads.message,
      })
      .from(leads)
      .where(eq(leads.workspaceId, ws.id));
    expect(saved).toEqual([
      {
        email: "ana@example.com",
        conversationId,
        message: "Bridal party in May",
      },
    ]);
    for (let i = 0; i < 4; i++) await send();
    expect((await send()).status).toBe(429);
  });
});

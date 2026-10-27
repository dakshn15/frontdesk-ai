import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "@/db/admin";
import {
  conversations,
  emailLog,
  leads,
  messages,
  profiles,
} from "@/db/schema";
import {
  handBackRecord,
  replyRecord,
  resolveRecord,
  takeOverRecord,
} from "@/features/inbox/records";
import { runAgent } from "@/privileged/assistant/agent";
import { handleSession } from "@/privileged/assistant/chat-api";
import {
  openConversation,
  sessionFromToken,
} from "@/privileged/assistant/sessions";
import { buildTools } from "@/privileged/assistant/tools";
import { sendReplyEmail } from "@/privileged/inbox-emails";
import { handleHistory } from "@/privileged/widget/api";
import {
  addTestMember,
  claimsFor,
  cleanupTestData,
  createTestUser,
  createTestWorkspace,
} from "../helpers/seed";
import { asUser } from "../helpers/test-db";

afterAll(cleanupTestData);

const options = { toolCallId: "t", messages: [] } as never;

async function team() {
  const [owner, admin, staff, outsider] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const ws = await createTestWorkspace(owner, { name: "Bloom Studio" });
  await addTestMember(ws.id, admin, "admin");
  await addTestMember(ws.id, staff, "staff");
  await adminDb
    .update(profiles)
    .set({ fullName: "Ana Diaz" })
    .where(eq(profiles.id, staff.id));
  const response = await handleSession(
    new Request("http://localhost/api/chat/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": crypto.randomUUID(),
      },
      body: JSON.stringify({ workspace: ws.slug }),
    }),
  );
  const { token } = (await response.json()) as { token: string };
  const session = (await sessionFromToken(token))!;
  const conversationId = await openConversation({
    workspaceId: ws.id,
    channel: "widget",
    sessionId: session.sessionId,
  });
  return { owner, admin, staff, outsider, ws, token, conversationId };
}

const statusOf = async (id: string) =>
  (
    await adminDb
      .select({
        status: conversations.status,
        assignedTo: conversations.assignedTo,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
  )[0];

function handoff(wsId: string, conversationId: string) {
  return buildTools(
    {
      workspaceId: wsId,
      conversationId,
      mode: "live",
      timeZone: "America/Chicago",
      currency: "USD",
      now: new Date(),
    },
    new Map(),
  ).handoff_to_human.execute!({ reason: "Asked for a person" }, options);
}

function history(token: string, conversationId: string) {
  return handleHistory(
    new Request("http://localhost/api/widget/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, conversationId }),
    }),
  ).then((response) => response.json());
}

describe("taking over a chat", () => {
  it("any member takes over; a second person can't take it from them", async () => {
    const { ws, staff, admin, outsider, conversationId } = await team();
    expect(
      await takeOverRecord(claimsFor(outsider), ws.id, conversationId),
    ).toBe("not_found");
    expect(await takeOverRecord(claimsFor(staff), ws.id, conversationId)).toBe(
      "ok",
    );
    expect(await statusOf(conversationId)).toEqual({
      status: "human",
      assignedTo: staff.id,
    });
    expect(await takeOverRecord(claimsFor(admin), ws.id, conversationId)).toBe(
      "taken",
    );
    // Taking over again yourself is fine.
    expect(await takeOverRecord(claimsFor(staff), ws.id, conversationId)).toBe(
      "ok",
    );

    expect(await handBackRecord(claimsFor(admin), ws.id, conversationId)).toBe(
      "ok",
    );
    expect(await statusOf(conversationId)).toEqual({
      status: "ai",
      assignedTo: null,
    });
    expect(await resolveRecord(claimsFor(staff), ws.id, conversationId)).toBe(
      "ok",
    );
    expect((await statusOf(conversationId)).status).toBe("resolved");
  });

  it("replies only while a person is handling the chat, as themselves", async () => {
    const { ws, staff, outsider, conversationId } = await team();
    expect(
      await replyRecord(claimsFor(staff), ws.id, conversationId, "Hi there"),
    ).toBe("not_handling");
    await takeOverRecord(claimsFor(staff), ws.id, conversationId);
    expect(
      await replyRecord(claimsFor(outsider), ws.id, conversationId, "Hi"),
    ).toBe("not_found");
    expect(
      await replyRecord(claimsFor(staff), ws.id, conversationId, "Hi there"),
    ).toBe("ok");
    const saved = await adminDb
      .select({
        role: messages.role,
        content: messages.content,
        authorId: messages.authorId,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(saved).toEqual([
      { role: "staff", content: "Hi there", authorId: staff.id },
    ]);
  });

  it("the database refuses messages that pretend to be someone else", async () => {
    const { ws, staff, owner, conversationId } = await team();
    const insert = (role: string, authorId: string) =>
      asUser(staff.id, async (tx) => {
        await tx`insert into public.messages (workspace_id, conversation_id, role, content, author_id)
          values (${ws.id}, ${conversationId}, ${role}, 'x', ${authorId})`;
        return "inserted";
      });
    await expect(insert("ai", staff.id)).rejects.toThrow();
    await expect(insert("staff", owner.id)).rejects.toThrow();
    await expect(insert("staff", staff.id)).resolves.toBe("inserted");
  });
});

describe("handoffs", () => {
  it("alert owners and admins once, by email", async () => {
    const { ws, owner, admin, staff, conversationId } = await team();
    await handoff(ws.id, conversationId);
    await handoff(ws.id, conversationId);
    const [row] = await adminDb
      .select({
        status: conversations.status,
        handoffAt: conversations.handoffAt,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(row.status).toBe("needs_human");
    expect(row.handoffAt).toBeInstanceOf(Date);
    const alerts = await adminDb
      .select({ to: emailLog.toEmail, subject: emailLog.subject })
      .from(emailLog)
      .where(
        and(eq(emailLog.workspaceId, ws.id), eq(emailLog.kind, "handoff")),
      );
    expect(alerts.map((alert) => alert.to).sort()).toEqual(
      [owner.email, admin.email].sort(),
    );
    expect(alerts.map((alert) => alert.to)).not.toContain(staff.email);
    expect(alerts[0].subject).toContain("needs a person");
  });

  it("a visitor writing to a resolved chat reopens it for the AI", async () => {
    const { ws, staff, conversationId } = await team();
    await resolveRecord(claimsFor(staff), ws.id, conversationId);
    const run = await runAgent({
      workspaceId: ws.id,
      conversationId,
      mode: "live",
      text: "One more question",
    });
    await run.response().text();
    await run.done;
    expect((await statusOf(conversationId)).status).toBe("ai");
  });
});

describe("the widget during a handoff", () => {
  it("sees staff replies with the person's first name", async () => {
    const { ws, staff, token, conversationId } = await team();
    await takeOverRecord(claimsFor(staff), ws.id, conversationId);
    await replyRecord(claimsFor(staff), ws.id, conversationId, "Hi, it's Ana");
    expect(await history(token, conversationId)).toMatchObject({
      status: "human",
      handler: "Ana",
      askForEmail: false,
      messages: [{ role: "staff", author: "Ana", content: "Hi, it's Ana" }],
    });
  });

  it("asks for an email when nobody has taken over after 5 minutes", async () => {
    const { ws, token, conversationId } = await team();
    await handoff(ws.id, conversationId);
    expect(await history(token, conversationId)).toMatchObject({
      status: "needs_human",
      askForEmail: false,
    });
    await adminDb
      .update(conversations)
      .set({ handoffAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(conversations.id, conversationId));
    expect(await history(token, conversationId)).toMatchObject({
      askForEmail: true,
    });
    // Once they've left their details, it stops asking.
    await adminDb.insert(leads).values({
      workspaceId: ws.id,
      conversationId,
      name: "Ana",
      email: "ana@example.com",
    });
    expect(await history(token, conversationId)).toMatchObject({
      askForEmail: false,
    });
  });
});

describe("replying by email", () => {
  it("goes to the conversation's own lead address, or nowhere", async () => {
    const { ws, conversationId } = await team();
    expect(
      await sendReplyEmail({
        workspaceId: ws.id,
        conversationId,
        staffName: "Ana",
        content: "We can fit you in on Friday.",
      }),
    ).toBe("no_address");
    await adminDb.insert(leads).values({
      workspaceId: ws.id,
      conversationId,
      name: "Sam",
      email: "sam@example.com",
    });
    expect(
      await sendReplyEmail({
        workspaceId: ws.id,
        conversationId,
        staffName: "Ana",
        content: "We can fit you in on Friday.",
      }),
    ).toBe("not_sent");
    const [sent] = await adminDb
      .select({ to: emailLog.toEmail, text: emailLog.text })
      .from(emailLog)
      .where(and(eq(emailLog.workspaceId, ws.id), eq(emailLog.kind, "reply")));
    expect(sent.to).toBe("sam@example.com");
    expect(sent.text).toContain("We can fit you in on Friday.");
  });
});

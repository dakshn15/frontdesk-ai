import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { conversations, messages } from "@/db/schema";

// Staff actions on a website conversation, under row level security: a user outside the
// workspace sees no row, so every action reports "not_found" for them.

const inWorkspace = (workspaceId: string, conversationId: string) =>
  and(
    eq(conversations.id, conversationId),
    eq(conversations.workspaceId, workspaceId),
    eq(conversations.channel, "widget"),
  );

/** The AI stops replying and the caller handles the chat, unless someone else already is. */
export async function takeOverRecord(
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
): Promise<"ok" | "taken" | "not_found"> {
  return withRls(claims, async (tx) => {
    const updated = await tx
      .update(conversations)
      .set({ status: "human", assignedTo: claims.sub })
      .where(
        and(
          inWorkspace(workspaceId, conversationId),
          or(
            ne(conversations.status, "human"),
            isNull(conversations.assignedTo),
            eq(conversations.assignedTo, claims.sub),
          ),
        ),
      )
      .returning({ id: conversations.id });
    if (updated.length > 0) return "ok";
    const [existing] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(inWorkspace(workspaceId, conversationId));
    return existing ? "taken" : "not_found";
  });
}

async function setStatus(
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
  status: "ai" | "resolved",
): Promise<"ok" | "not_found"> {
  const updated = await withRls(claims, (tx) =>
    tx
      .update(conversations)
      .set({ status, assignedTo: null })
      .where(inWorkspace(workspaceId, conversationId))
      .returning({ id: conversations.id }),
  );
  return updated.length > 0 ? "ok" : "not_found";
}

/** The AI answers again. */
export const handBackRecord = (
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
) => setStatus(claims, workspaceId, conversationId, "ai");

/** Done; a new message from the visitor reopens it for the AI. */
export const resolveRecord = (
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
) => setStatus(claims, workspaceId, conversationId, "resolved");

/** A reply from the team, shown in the visitor's chat. Only while a person handles it. */
export async function replyRecord(
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
  content: string,
): Promise<"ok" | "not_handling" | "not_found"> {
  return withRls(claims, async (tx) => {
    const [conversation] = await tx
      .select({ status: conversations.status })
      .from(conversations)
      .where(inWorkspace(workspaceId, conversationId));
    if (!conversation) return "not_found";
    if (conversation.status !== "human") return "not_handling";
    await tx.insert(messages).values({
      workspaceId,
      conversationId,
      role: "staff",
      content,
      authorId: claims.sub,
    });
    await tx
      .update(conversations)
      .set({ lastMessageAt: sql`now()` })
      .where(eq(conversations.id, conversationId));
    return "ok";
  });
}

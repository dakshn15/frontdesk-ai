import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { conversations, visitorSessions, workspaces } from "@/db/schema";
import { createSecretToken, hashSecretToken } from "@/lib/secret-token";

// Website visitors have no account. The widget gets a random session token (stored hashed)
// that's only good for one workspace and expires; conversations belong to that session.

export const SESSION_HOURS = 24;

export async function createVisitorSession(
  slug: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date } | null> {
  const [workspace] = await adminDb
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  if (!workspace) return null;
  const { token, hash } = createSecretToken();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  await adminDb
    .insert(visitorSessions)
    .values({ workspaceId: workspace.id, tokenHash: hash, expiresAt });
  return { token, expiresAt };
}

export async function sessionFromToken(
  token: string,
  now = new Date(),
): Promise<{ sessionId: string; workspaceId: string } | null> {
  if (!token || token.length > 100) return null;
  const [session] = await adminDb
    .select({
      sessionId: visitorSessions.id,
      workspaceId: visitorSessions.workspaceId,
    })
    .from(visitorSessions)
    .where(
      and(
        eq(visitorSessions.tokenHash, hashSecretToken(token)),
        gt(visitorSessions.expiresAt, now),
      ),
    );
  return session ?? null;
}

/**
 * The conversation to continue: `conversationId` if it belongs to this session (or, for the
 * preview, this workspace's preview channel), otherwise a new one.
 */
export async function openConversation(input: {
  workspaceId: string;
  channel: "widget" | "preview" | "test";
  sessionId: string | null;
  conversationId?: string;
}): Promise<string> {
  if (input.conversationId) {
    const [existing] = await adminDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.workspaceId, input.workspaceId),
          eq(conversations.channel, input.channel),
          input.sessionId
            ? eq(conversations.sessionId, input.sessionId)
            : sql`${conversations.sessionId} is null`,
        ),
      );
    if (existing) return existing.id;
  }
  const [created] = await adminDb
    .insert(conversations)
    .values({
      workspaceId: input.workspaceId,
      channel: input.channel,
      sessionId: input.sessionId,
    })
    .returning({ id: conversations.id });
  return created.id;
}

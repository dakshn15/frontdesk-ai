import { and, asc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import {
  conversations,
  leads,
  messages,
  profiles,
  toolCalls,
} from "@/db/schema";
import type { ConversationStatus } from "@/db/schema/enums";

export const INBOX_FILTERS = [
  "all",
  "needs_human",
  "human",
  "ai",
  "resolved",
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export type InboxRow = {
  id: string;
  status: ConversationStatus;
  lastMessageAt: Date;
  preview: string;
  visitor: string | null;
  handler: string | null;
};

const PAGE = 50;

/** "50% off" → "50\% off", so a search matches the words as typed. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Website conversations, newest first, with the latest message and the visitor's name if
 * they left one. Correlated subqueries are plain SQL: Drizzle drops table names inside them.
 */
export async function listConversations(
  claims: AuthClaims,
  workspaceId: string,
  options: { filter: InboxFilter; q: string },
): Promise<{ rows: InboxRow[]; counts: Record<InboxFilter, number> }> {
  const q = options.q.trim();
  return withRls(claims, async (tx) => {
    const statusFilter =
      options.filter === "all" ? sql`true` : sql`c.status = ${options.filter}`;
    const search = q
      ? sql`(exists (select 1 from public.messages m where m.conversation_id = c.id and m.content ilike ${likePattern(q)})
          or exists (select 1 from public.leads l where l.conversation_id = c.id and (l.name ilike ${likePattern(q)} or l.email ilike ${likePattern(q)})))`
      : sql`true`;
    const rows = await tx.execute<{
      id: string;
      status: ConversationStatus;
      last_message_at: string;
      preview: string | null;
      visitor: string | null;
      handler: string | null;
    }>(sql`
      select c.id, c.status, c.last_message_at,
        (select m.content from public.messages m where m.conversation_id = c.id
          order by m.created_at desc limit 1) as preview,
        (select coalesce(nullif(l.name, ''), l.email) from public.leads l
          where l.conversation_id = c.id order by l.created_at desc limit 1) as visitor,
        p.full_name as handler
      from public.conversations c
      left join public.profiles p on p.id = c.assigned_to and c.status = 'human'
      where c.workspace_id = ${workspaceId} and c.channel = 'widget'
        and ${statusFilter} and ${search}
      order by c.last_message_at desc
      limit ${PAGE}`);
    const countRows = await tx
      .select({
        status: conversations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, "widget"),
        ),
      )
      .groupBy(conversations.status);
    const counts = { all: 0, needs_human: 0, human: 0, ai: 0, resolved: 0 };
    for (const row of countRows) {
      counts[row.status] = row.count;
      counts.all += row.count;
    }
    return {
      counts,
      rows: rows.map((row) => ({
        id: row.id,
        status: row.status,
        lastMessageAt: new Date(row.last_message_at),
        preview: row.preview ?? "",
        visitor: row.visitor,
        handler: row.handler || null,
      })),
    };
  });
}

/** How many chats are waiting for a person, for the nav badge. */
export async function countWaiting(
  claims: AuthClaims,
  workspaceId: string,
): Promise<number> {
  const [row] = await withRls(claims, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, "widget"),
          eq(conversations.status, "needs_human"),
        ),
      ),
  );
  return row?.count ?? 0;
}

export type TimelineItem =
  | {
      kind: "message";
      id: string;
      role: "visitor" | "ai" | "staff";
      content: string;
      sources: { kind: string; id: string; title: string }[];
      author: string | null;
      at: Date;
    }
  | {
      kind: "tool";
      id: string;
      tool: string;
      input: unknown;
      output: unknown;
      at: Date;
    };

/** One conversation with its messages and tool calls in order, and the visitor's details. */
export async function getConversation(
  claims: AuthClaims,
  workspaceId: string,
  conversationId: string,
) {
  return withRls(claims, async (tx) => {
    const [conversation] = await tx
      .select({
        id: conversations.id,
        status: conversations.status,
        handoffReason: conversations.handoffReason,
        assignedTo: conversations.assignedTo,
        handler: profiles.fullName,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .leftJoin(profiles, eq(profiles.id, conversations.assignedTo))
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.channel, "widget"),
        ),
      );
    if (!conversation) return null;
    const [messageRows, toolRows, leadRows] = await Promise.all([
      tx
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          sources: messages.sources,
          author: profiles.fullName,
          at: messages.createdAt,
        })
        .from(messages)
        .leftJoin(profiles, eq(profiles.id, messages.authorId))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(messages.createdAt)),
      tx
        .select({
          id: toolCalls.id,
          tool: toolCalls.tool,
          input: toolCalls.input,
          output: toolCalls.output,
          at: toolCalls.createdAt,
        })
        .from(toolCalls)
        .where(
          and(
            eq(toolCalls.conversationId, conversationId),
            eq(toolCalls.workspaceId, workspaceId),
          ),
        )
        .orderBy(asc(toolCalls.createdAt)),
      tx
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          message: leads.message,
        })
        .from(leads)
        .where(
          and(
            eq(leads.conversationId, conversationId),
            eq(leads.workspaceId, workspaceId),
          ),
        ),
    ]);
    const timeline: TimelineItem[] = [
      ...messageRows.map((row) => ({
        kind: "message" as const,
        ...row,
        sources: row.sources as {
          kind: string;
          id: string;
          title: string;
        }[],
        author: row.author || null,
      })),
      ...toolRows.map((row) => ({ kind: "tool" as const, ...row })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      ...conversation,
      handler: conversation.handler || null,
      timeline,
      leads: leadRows,
    };
  });
}

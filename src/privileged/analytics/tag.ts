import "server-only";
import { sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { outcomeFor, topicFor } from "@/features/analytics/tagging";
import { NOT_SURE } from "@/features/testlab/checks";

/** A chat counts as over once nobody has written for this long. */
export const QUIET_MINUTES = 30;

/**
 * Tags website chats that have gone quiet (and chats with new messages since they were
 * tagged) with a topic and an outcome. One workspace, or all of them from the daily job.
 * Returns how many were tagged.
 */
export async function tagQuietConversations(
  options: { workspaceId?: string; limit?: number; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const quietSince = new Date(now.getTime() - QUIET_MINUTES * 60_000);
  const workspace = options.workspaceId
    ? sql`and c.workspace_id = ${options.workspaceId}`
    : sql``;
  // Plain SQL: Drizzle drops table names inside correlated subqueries.
  const rows = await adminDb.execute<{
    id: string;
    visitor_text: string;
    ai_text: string;
    tools: string[];
    search_none: boolean;
    booked: boolean;
    lead: boolean;
    handed_off: boolean;
  }>(sql`
    select c.id,
      coalesce((select string_agg(m.content, ' ' order by m.created_at) from public.messages m
        where m.conversation_id = c.id and m.role = 'visitor'), '') as visitor_text,
      coalesce((select string_agg(m.content, ' ' order by m.created_at) from public.messages m
        where m.conversation_id = c.id and m.role = 'ai'), '') as ai_text,
      coalesce((select array_agg(distinct t.tool) from public.tool_calls t
        where t.conversation_id = c.id), '{}') as tools,
      exists (select 1 from public.tool_calls t where t.conversation_id = c.id
        and t.tool = 'search_knowledge' and t.output->>'confidence' = 'none') as search_none,
      exists (select 1 from public.bookings b where b.conversation_id = c.id) as booked,
      exists (select 1 from public.leads l where l.conversation_id = c.id) as lead,
      (c.handoff_at is not null or c.status in ('needs_human', 'human')) as handed_off
    from public.conversations c
    where c.channel = 'widget' and c.last_message_at < ${quietSince.toISOString()}::timestamptz
      and (c.tagged_at is null or c.tagged_at < c.last_message_at)
      ${workspace}
    order by c.last_message_at
    limit ${options.limit ?? 200}`);

  for (const row of rows) {
    const topic = topicFor({ tools: row.tools, text: row.visitor_text });
    const outcome = outcomeFor({
      booked: row.booked,
      lead: row.lead,
      handedOff: row.handed_off,
      unanswered: row.search_none || NOT_SURE.test(row.ai_text),
    });
    await adminDb.execute(sql`
      update public.conversations
      set topic = ${topic}, outcome = ${outcome}, tagged_at = ${now.toISOString()}::timestamptz
      where id = ${row.id}`);
  }
  return rows.length;
}

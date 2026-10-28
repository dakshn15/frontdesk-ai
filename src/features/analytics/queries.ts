import { sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { addDays } from "@/lib/clock";
import { costOf } from "./prices";
import { type Outcome, type Topic } from "./tagging";

export type DateRange = {
  /** The first and last local dates included, YYYY-MM-DD. */
  from: string;
  to: string;
  timeZone: string;
};

export type Analytics = {
  summary: {
    conversations: number;
    aiBookings: number;
    leads: number;
    handedOff: number;
    tagged: number;
    resolvedWithoutHuman: number;
  };
  daily: { date: string; conversations: number }[];
  topics: { topic: Topic; count: number }[];
  outcomes: { outcome: Outcome; count: number }[];
  usage: {
    date: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }[];
};

/** Every local date in the range, so days with nothing still show. */
export function datesIn(range: Pick<DateRange, "from" | "to">): string[] {
  const dates: string[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/**
 * The workspace's numbers for a date range in its own time zone, website chats only (the
 * dashboard preview and the test lab aren't customers). Usage counts every AI call,
 * because every call costs money.
 */
export async function getAnalytics(
  claims: AuthClaims,
  workspaceId: string,
  range: DateRange,
): Promise<Analytics> {
  const { timeZone } = range;
  // Local midnight at the start of `from` to local midnight after `to`.
  const start = sql`(${range.from}::date)::timestamp at time zone ${timeZone}`;
  const end = sql`(${addDays(range.to, 1)}::date)::timestamp at time zone ${timeZone}`;
  const inRange = (column: string) =>
    sql`${sql.raw(column)} >= ${start} and ${sql.raw(column)} < ${end}`;
  const localDay = (column: string) =>
    sql`to_char(${sql.raw(column)} at time zone ${timeZone}, 'YYYY-MM-DD')`;

  return withRls(claims, async (tx) => {
    const [summary] = await tx.execute<{
      conversations: number;
      ai_bookings: number;
      leads: number;
      handed_off: number;
      tagged: number;
      resolved: number;
    }>(sql`
      select
        (select count(*)::int from public.conversations c
          where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}) as conversations,
        (select count(*)::int from public.bookings b
          where b.workspace_id = ${workspaceId} and b.source = 'widget' and ${inRange("b.created_at")}) as ai_bookings,
        (select count(*)::int from public.leads l
          where l.workspace_id = ${workspaceId} and ${inRange("l.created_at")}) as leads,
        (select count(*)::int from public.conversations c
          where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
            and c.handoff_at is not null) as handed_off,
        (select count(*)::int from public.conversations c
          where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
            and c.outcome is not null) as tagged,
        (select count(*)::int from public.conversations c
          where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
            and c.outcome in ('answered', 'booked', 'lead') and c.handoff_at is null) as resolved`);

    const daily = await tx.execute<{ date: string; count: number }>(sql`
      select ${localDay("c.created_at")} as date, count(*)::int as count
      from public.conversations c
      where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
      group by 1`);
    const topics = await tx.execute<{ topic: Topic; count: number }>(sql`
      select c.topic, count(*)::int as count from public.conversations c
      where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
        and c.topic is not null
      group by 1 order by 2 desc, 1`);
    const outcomes = await tx.execute<{ outcome: Outcome; count: number }>(sql`
      select c.outcome, count(*)::int as count from public.conversations c
      where c.workspace_id = ${workspaceId} and c.channel = 'widget' and ${inRange("c.created_at")}
        and c.outcome is not null
      group by 1 order by 2 desc, 1`);
    const usage = await tx.execute<{
      date: string;
      provider: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
    }>(sql`
      select ${localDay("u.created_at")} as date, u.provider, u.model,
        sum(u.input_tokens)::int as input_tokens, sum(u.output_tokens)::int as output_tokens
      from public.usage_events u
      where u.workspace_id = ${workspaceId} and ${inRange("u.created_at")}
      group by 1, 2, 3 order by 1, 2, 3`);

    const perDay = new Map(daily.map((row) => [row.date, row.count]));
    return {
      summary: {
        conversations: summary.conversations,
        aiBookings: summary.ai_bookings,
        leads: summary.leads,
        handedOff: summary.handed_off,
        tagged: summary.tagged,
        resolvedWithoutHuman: summary.resolved,
      },
      daily: datesIn(range).map((date) => ({
        date,
        conversations: perDay.get(date) ?? 0,
      })),
      topics: [...topics],
      outcomes: [...outcomes],
      usage: usage.map((row) => ({
        date: row.date,
        provider: row.provider,
        model: row.model,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cost: costOf(row.model, row.input_tokens, row.output_tokens),
      })),
    };
  });
}

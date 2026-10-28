import "server-only";
import { sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { costOf } from "@/features/analytics/prices";
import { effectivePlan, type PlanId } from "@/features/billing/plans";
import { addDays } from "@/lib/clock";
import { monthStart } from "../billing/limits";

export type PlatformWorkspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  plan: PlanId;
  active: boolean;
  subscriptionStatus: string | null;
  members: number;
  chatsThisMonth: number;
  aiCost30d: number;
};

type UsageRow = { model: string; input: number; output: number };

const sumCost = (rows: UsageRow[]) =>
  rows.reduce(
    (total, row) => total + costOf(row.model, row.input, row.output),
    0,
  );

/**
 * Every real workspace with its plan, usage and AI cost, the demo sandboxes in total, and
 * AI cost per day across the platform. Cross-tenant, so read with the privileged
 * connection; only the admin page calls it.
 */
export async function getPlatformOverview(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const month = monthStart(now);
  // Plain SQL: Drizzle drops table names inside correlated subqueries.
  const rows = await adminDb.execute<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    plan: string | null;
    status: string | null;
    members: number;
    chats: number;
    usage: UsageRow[];
  }>(sql`
    select w.id, w.name, w.slug, w.created_at, s.plan, s.status,
      (select count(*)::int from public.memberships m where m.workspace_id = w.id) as members,
      (select count(*)::int from public.conversations c where c.workspace_id = w.id
        and c.channel = 'widget' and c.created_at >= ${month.toISOString()}::timestamptz) as chats,
      coalesce((select json_agg(json_build_object('model', u.model, 'input', u.i, 'output', u.o))
        from (select model, sum(input_tokens)::int as i, sum(output_tokens)::int as o
          from public.usage_events where workspace_id = w.id
            and created_at >= ${since.toISOString()}::timestamptz group by model) u), '[]') as usage
    from public.workspaces w
    left join public.subscriptions s on s.workspace_id = w.id
    where w.demo_expires_at is null
    order by w.created_at desc
    limit 200`);

  const [demos] = await adminDb.execute<{
    live: number;
    usage: UsageRow[];
  }>(sql`
    select
      (select count(*)::int from public.workspaces where demo_expires_at > now()) as live,
      coalesce((select json_agg(json_build_object('model', u.model, 'input', u.i, 'output', u.o))
        from (select e.model, sum(e.input_tokens)::int as i, sum(e.output_tokens)::int as o
          from public.usage_events e join public.workspaces w on w.id = e.workspace_id
          where w.demo_expires_at is not null
            and e.created_at >= ${since.toISOString()}::timestamptz group by e.model) u), '[]') as usage`);

  const daily = await adminDb.execute<{
    date: string;
    provider: string;
    model: string;
    input: number;
    output: number;
  }>(sql`
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as date, provider, model,
      sum(input_tokens)::int as input, sum(output_tokens)::int as output
    from public.usage_events
    where created_at >= ${since.toISOString()}::timestamptz
    group by 1, 2, 3`);

  const costByDay = new Map<string, { openai: number; google: number }>();
  for (const row of daily) {
    const day = costByDay.get(row.date) ?? { openai: 0, google: 0 };
    if (row.provider === "openai" || row.provider === "google")
      day[row.provider] += costOf(row.model, row.input, row.output);
    costByDay.set(row.date, day);
  }
  const today = now.toISOString().slice(0, 10);
  const days = Array.from({ length: 30 }, (_, index) =>
    addDays(today, index - 29),
  );

  const workspaces: PlatformWorkspace[] = rows.map((row) => {
    const plan = effectivePlan({
      subscription:
        row.plan && row.status ? { plan: row.plan, status: row.status } : null,
      createdAt: new Date(row.created_at),
      demo: false,
      now,
    });
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: new Date(row.created_at),
      plan: plan.plan,
      active: plan.active,
      subscriptionStatus: row.status,
      members: row.members,
      chatsThisMonth: row.chats,
      aiCost30d: sumCost(row.usage),
    };
  });

  return {
    workspaces,
    demos: { live: demos.live, aiCost30d: sumCost(demos.usage) },
    costPerDay: days.map((date) => ({
      date,
      ...(costByDay.get(date) ?? { openai: 0, google: 0 }),
    })),
  };
}

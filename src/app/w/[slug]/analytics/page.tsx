import type { Metadata } from "next";
import Link from "next/link";
import { formatUsd } from "@/features/analytics/prices";
import { getAnalytics } from "@/features/analytics/queries";
import { OUTCOME_LABEL } from "@/features/analytics/tagging";
import { listQuestionsToReview } from "@/features/testlab/queries";
import { requireManager } from "@/lib/auth/session";
import { addDays, localDate } from "@/lib/clock";
import { firstParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { tagQuietConversations } from "@/privileged/analytics/tag";
import { ConversationsChart, CostChart } from "./charts";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

const percent = (part: number, whole: number) =>
  whole === 0 ? "None yet" : `${Math.round((part / whole) * 100)}%`;

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note ? (
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/analytics">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const requested = Number(firstParam((await searchParams).days));
  const days = RANGES.includes(requested as never) ? requested : 30;
  const to = localDate(workspace.timezone);
  const range = {
    from: addDays(to, -(days - 1)),
    to,
    timeZone: workspace.timezone,
  };

  // Chats that went quiet since the daily job get their topic and outcome now.
  await tagQuietConversations({ workspaceId: workspace.id, limit: 200 });
  const [analytics, review] = await Promise.all([
    getAnalytics(claims, workspace.id, range),
    listQuestionsToReview(claims, workspace.id),
  ]);
  const { summary } = analytics;

  const costByDay = new Map<string, { openai: number; google: number }>();
  for (const row of analytics.usage) {
    const day = costByDay.get(row.date) ?? { openai: 0, google: 0 };
    if (row.provider === "openai" || row.provider === "google")
      day[row.provider] += row.cost;
    costByDay.set(row.date, day);
  }
  const costSeries = analytics.daily.map(({ date }) => ({
    date,
    ...(costByDay.get(date) ?? { openai: 0, google: 0 }),
  }));
  const models = new Map<
    string,
    {
      provider: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }
  >();
  for (const row of analytics.usage) {
    const model = models.get(row.model) ?? {
      provider: row.provider,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
    model.inputTokens += row.inputTokens;
    model.outputTokens += row.outputTokens;
    model.cost += row.cost;
    models.set(row.model, model);
  }
  const totalCost = [...models.values()].reduce((sum, m) => sum + m.cost, 0);
  const topTopic = Math.max(1, ...analytics.topics.map((row) => row.count));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            How your website chat is doing. Tests and your own previews
            aren&apos;t counted, except in AI cost.
          </p>
        </div>
        <nav aria-label="Date range" className="flex gap-1">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/w/${slug}/analytics?days=${option}`}
              aria-current={option === days ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                option === days
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              Last {option} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Conversations" value={String(summary.conversations)} />
        <Tile label="Booked by the AI" value={String(summary.aiBookings)} />
        <Tile label="Leads" value={String(summary.leads)} />
        <Tile
          label="Handed to the team"
          value={percent(summary.handedOff, summary.conversations)}
          note={`${summary.handedOff} of ${summary.conversations}`}
        />
        <Tile
          label="Resolved without a person"
          value={percent(summary.resolvedWithoutHuman, summary.tagged)}
          note="Answered, booked or left details, with no handoff"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Conversations per day">
          <ConversationsChart data={analytics.daily} />
        </Panel>
        <Panel
          title="AI cost per day"
          description={`${formatUsd(totalCost)} in this period, estimated from tokens.`}
        >
          <CostChart data={costSeries} />
        </Panel>

        <Panel title="Top topics">
          {analytics.topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Topics appear once chats have been quiet for half an hour.
            </p>
          ) : (
            <ul className="grid gap-2.5">
              {analytics.topics.map((row) => (
                <li key={row.topic} className="grid gap-1 text-sm">
                  <div className="flex justify-between">
                    <span>{row.topic}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(row.count / topTopic) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {analytics.outcomes.length > 0 ? (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-4 text-sm sm:grid-cols-3">
              {analytics.outcomes.map((row) => (
                <div key={row.outcome} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {OUTCOME_LABEL[row.outcome]}
                  </dt>
                  <dd className="tabular-nums">{row.count}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Panel>

        <Panel
          title="Questions it struggled with"
          description="From the last 30 days, where your knowledge had no clear answer."
        >
          {review.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to review.</p>
          ) : (
            <>
              <ul className="grid gap-2 text-sm">
                {review.slice(0, 6).map((item) => (
                  <li key={`${item.conversationId}:${item.question}`}>
                    <Link
                      href={`/w/${slug}/inbox/${item.conversationId}`}
                      className="hover:underline"
                    >
                      {item.question}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/w/${slug}/assistant/tests`}
                className="mt-4 inline-block text-sm font-medium underline"
              >
                Turn them into tests in the Test lab
              </Link>
            </>
          )}
        </Panel>
      </div>

      <section aria-labelledby="usage-title" className="mt-6">
        <h2 id="usage-title" className="font-semibold">
          AI usage by model
        </h2>
        {models.size === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No AI usage in this period.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Tokens in
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Tokens out
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Estimated cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...models.entries()].map(([model, row]) => (
                  <tr key={model} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {row.provider} {model}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.inputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.outputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatUsd(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

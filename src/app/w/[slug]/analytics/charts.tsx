"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/features/analytics/prices";

// Colours by job: one series uses the app's primary; the two providers take the first two
// slots of the validated categorical palette, stepped separately for dark mode.
const PROVIDERS = [
  { key: "openai", label: "OpenAI", color: "var(--series-1)" },
  { key: "google", label: "Google", color: "var(--series-2)" },
] as const;

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

/** "2026-10-27" → "Oct 27". */
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="mt-1 flex items-center gap-2">
          {row.color ? (
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="text-muted-foreground">{row.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">
            {row.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ConversationsChart({
  data,
}: {
  data: { date: string; conversations: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            minTickGap={24}
            {...axis}
          />
          <YAxis allowDecimals={false} width={44} {...axis} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={shortDate(String(payload[0].payload.date))}
                  rows={[
                    {
                      label: "Conversations",
                      value: String(payload[0].value),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="conversations"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostChart({
  data,
}: {
  data: { date: string; openai: number; google: number }[];
}) {
  return (
    <div>
      <ul aria-label="Legend" className="mb-2 flex gap-4 text-xs">
        {PROVIDERS.map((provider) => (
          <li key={provider.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: provider.color }}
            />
            {provider.label}
          </li>
        ))}
      </ul>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              minTickGap={24}
              {...axis}
            />
            <YAxis
              width={56}
              // Daily costs are often fractions of a cent.
              tickFormatter={(value: number) =>
                `$${value.toFixed(value < 1 ? 3 : 2)}`
              }
              {...axis}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={shortDate(String(payload[0].payload.date))}
                    rows={PROVIDERS.map((provider) => ({
                      label: provider.label,
                      color: provider.color,
                      value: formatUsd(
                        Number(payload[0].payload[provider.key] ?? 0),
                      ),
                    }))}
                  />
                ) : null
              }
            />
            {PROVIDERS.map((provider, index) => (
              <Bar
                key={provider.key}
                dataKey={provider.key}
                stackId="cost"
                fill={provider.color}
                // A thin surface gap between the stacked segments.
                stroke="var(--background)"
                strokeWidth={2}
                radius={index === PROVIDERS.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

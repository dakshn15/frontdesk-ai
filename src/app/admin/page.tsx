import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { getServerEnv } from "@/env/server";
import { isPlatformAdmin } from "@/features/admin/access";
import { formatUsd } from "@/features/analytics/prices";
import { PLANS } from "@/features/billing/plans";
import { getAuthClaims } from "@/lib/auth/session";
import { getPlatformOverview } from "@/privileged/admin/overview";
import { CostChart } from "../w/[slug]/analytics/charts";

export const metadata: Metadata = {
  title: "Platform admin",
  robots: { index: false, follow: false },
};

/** Every workspace on the platform, read-only, for the people who run it. */
export default async function AdminPage() {
  const claims = await getAuthClaims();
  // Anyone else sees the same 404 as a page that doesn't exist.
  if (!isPlatformAdmin(claims, getServerEnv().PLATFORM_ADMIN_EMAILS))
    notFound();
  const overview = await getPlatformOverview();
  const totalCost =
    overview.workspaces.reduce((sum, row) => sum + row.aiCost30d, 0) +
    overview.demos.aiCost30d;
  const paying = overview.workspaces.filter(
    (row) => row.plan === "starter" || row.plan === "pro",
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="rounded-lg">
          <Logo />
        </Link>
        <Badge variant="secondary">Read-only</Badge>
      </header>
      <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
        Platform admin
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every workspace, its plan and what it uses. Costs are estimated from
        tokens over the last 30 days.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Workspaces", String(overview.workspaces.length)],
          ["On a paid plan", String(paying)],
          ["Live demo copies", String(overview.demos.live)],
          ["AI cost, 30 days", formatUsd(totalCost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="AI cost per day"
        className="mt-6 rounded-xl border p-4"
      >
        <h2 className="font-semibold">AI cost per day, all workspaces</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Including demos ({formatUsd(overview.demos.aiCost30d)} in 30 days).
        </p>
        <div className="mt-4">
          <CostChart data={overview.costPerDay} />
        </div>
      </section>

      <section aria-labelledby="workspaces-title" className="mt-6">
        <h2 id="workspaces-title" className="font-semibold">
          Workspaces
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Workspace</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 text-right font-medium">Members</th>
                <th className="px-4 py-2 text-right font-medium">
                  Chats this month
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  AI cost, 30 days
                </th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {overview.workspaces.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.slug}</p>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={row.active ? "secondary" : "destructive"}>
                      {PLANS[row.plan].name}
                      {row.active ? "" : ", ended"}
                    </Badge>
                    {row.subscriptionStatus === "past_due" ? (
                      <p className="mt-1 text-xs text-destructive">
                        Payment failed
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.members}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.chatsThisMonth}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatUsd(row.aiCost30d)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {format(row.createdAt, "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

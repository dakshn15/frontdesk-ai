import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { getServerEnv } from "@/env/server";
import { PLANS } from "@/features/billing/plans";
import { requireManager } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import {
  planForWorkspace,
  subscriptionOf,
  usageOf,
} from "@/privileged/billing/limits";
import { ManageBillingButton, SubscribeButton } from "./billing-buttons";

export const metadata: Metadata = { title: "Billing" };

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const share = Number.isFinite(limit) ? Math.min(1, used / limit) : 0;
  return (
    <div className="grid gap-1.5 text-sm">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} of {Number.isFinite(limit) ? limit : "no limit"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full",
            share >= 1 ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/billing">) {
  const { slug } = await params;
  const { membership } = await requireManager(slug);
  const { workspace } = membership;
  const [plan, usage, subscription] = await Promise.all([
    planForWorkspace(workspace.id),
    usageOf(workspace.id),
    subscriptionOf(workspace.id),
  ]);
  const env = getServerEnv();
  const ready = Boolean(
    env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_STARTER && env.STRIPE_PRICE_PRO,
  );
  const demo = plan.plan === "demo";
  const paid = plan.plan === "starter" || plan.plan === "pro";
  const justSubscribed = (await searchParams).checkout === "done";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
        Billing
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Your plan and what you&apos;ve used this month. Payments are handled
        securely by Stripe.
      </p>

      <div className="mt-6 grid gap-3">
        {justSubscribed ? (
          <FormMessage tone="success">
            Thanks. Your plan updates here as soon as Stripe confirms it.
          </FormMessage>
        ) : null}
        {!ready && !demo ? (
          <FormMessage tone="error">
            Billing isn&apos;t set up yet. Add STRIPE_SECRET_KEY,
            STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER and STRIPE_PRICE_PRO in
            your hosting settings to take payments.
          </FormMessage>
        ) : null}
      </div>

      <section
        aria-labelledby="current-plan"
        className="mt-6 grid gap-6 rounded-xl border p-5 md:grid-cols-[1fr_1.4fr]"
      >
        <div>
          <h2 id="current-plan" className="text-sm text-muted-foreground">
            Current plan
          </h2>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {PLANS[plan.plan].name}
            {plan.plan === "trial" ? (
              <Badge variant={plan.active ? "secondary" : "destructive"}>
                {plan.active
                  ? `${plan.trialDaysLeft} ${plan.trialDaysLeft === 1 ? "day" : "days"} left`
                  : "Ended"}
              </Badge>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {demo
              ? "Demo copies have no plan. Their AI replies share a daily limit across all demos."
              : !plan.active
                ? "Your trial has ended. Your receptionist offers visitors the contact form until you choose a plan. Nothing has been deleted."
                : paid && subscription?.currentPeriodEnd
                  ? `Renews on ${format(new TZDate(subscription.currentPeriodEnd, workspace.timezone), "MMMM d, yyyy")}.${subscription.status === "past_due" ? " The last payment failed: update your card." : ""}`
                  : PLANS[plan.plan].summary}
          </p>
          {paid ? (
            <div className="mt-4">
              <ManageBillingButton slug={workspace.slug} disabled={!ready} />
            </div>
          ) : null}
        </div>
        <div className="grid gap-4">
          <Meter
            label="Website chats this month"
            used={usage.conversations}
            limit={plan.limits.conversations}
          />
          <Meter
            label="Knowledge sources"
            used={usage.knowledgeSources}
            limit={plan.limits.knowledgeSources}
          />
          <Meter
            label="Team seats (members and invites)"
            used={usage.seats}
            limit={plan.limits.seats}
          />
        </div>
      </section>

      {demo ? null : (
        <section aria-labelledby="plans" className="mt-10">
          <h2 id="plans" className="text-lg font-semibold">
            Plans
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {(["trial", "starter", "pro"] as const).map((id) => {
              const option = PLANS[id];
              const current = plan.plan === id;
              return (
                <li
                  key={id}
                  aria-label={option.name}
                  className={cn(
                    "flex flex-col rounded-xl border p-5",
                    current && "border-primary ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{option.name}</h3>
                    {current ? <Badge>Current</Badge> : null}
                  </div>
                  <p className="mt-1 text-2xl font-semibold">{option.price}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {option.summary}
                  </p>
                  <ul className="mt-4 grid gap-1.5 text-sm">
                    {[
                      `${option.limits.conversations.toLocaleString("en-US")} website chats a month`,
                      `${option.limits.knowledgeSources} knowledge sources`,
                      `${option.limits.seats} team seats`,
                    ].map((line) => (
                      <li key={line} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-5">
                    {id === "trial" ? null : current ? (
                      <p className="text-sm text-muted-foreground">
                        Change or cancel in Manage billing.
                      </p>
                    ) : paid ? null : (
                      <SubscribeButton
                        slug={workspace.slug}
                        plan={id}
                        label={`Choose ${option.name}`}
                        disabled={!ready}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

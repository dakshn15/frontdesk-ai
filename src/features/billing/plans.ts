// The plans and what each allows. Prices are placeholders for the demo (Stripe test mode);
// the amount charged comes from the Stripe price itself.

export type PlanId = "trial" | "starter" | "pro" | "demo";

export type Limits = {
  /** Website chats started per calendar month. */
  conversations: number;
  knowledgeSources: number;
  /** Members plus pending invites. */
  seats: number;
};

export const TRIAL_DAYS = 14;

export const PLANS: Record<
  PlanId,
  { name: string; price: string; limits: Limits; summary: string }
> = {
  trial: {
    name: "Trial",
    price: "Free for 14 days",
    limits: { conversations: 100, knowledgeSources: 20, seats: 2 },
    summary: "Everything, to try it on your website.",
  },
  starter: {
    name: "Starter",
    price: "$29 a month",
    limits: { conversations: 500, knowledgeSources: 50, seats: 3 },
    summary: "For a single location with a small team.",
  },
  pro: {
    name: "Pro",
    price: "$99 a month",
    limits: { conversations: 3000, knowledgeSources: 200, seats: 10 },
    summary: "For busy businesses and bigger teams.",
  },
  demo: {
    name: "Demo",
    price: "",
    limits: {
      conversations: Number.POSITIVE_INFINITY,
      knowledgeSources: Number.POSITIVE_INFINITY,
      seats: Number.POSITIVE_INFINITY,
    },
    summary: "A demo copy, with its own shared limits.",
  },
};

// Stripe keeps these subscriptions billing: a failed payment (past_due) gets retried.
const GOOD_STANDING = new Set(["active", "trialing", "past_due"]);

export type EffectivePlan = {
  plan: PlanId;
  /** False once a trial has ended without a paid plan: the AI stops answering chats. */
  active: boolean;
  limits: Limits;
  trialDaysLeft: number;
};

export function effectivePlan(input: {
  subscription: { plan: string; status: string } | null;
  createdAt: Date;
  demo: boolean;
  now: Date;
}): EffectivePlan {
  if (input.demo)
    return {
      plan: "demo",
      active: true,
      limits: PLANS.demo.limits,
      trialDaysLeft: 0,
    };
  const paid = input.subscription;
  if (
    paid &&
    GOOD_STANDING.has(paid.status) &&
    (paid.plan === "starter" || paid.plan === "pro")
  ) {
    return {
      plan: paid.plan,
      active: true,
      limits: PLANS[paid.plan].limits,
      trialDaysLeft: 0,
    };
  }
  const ends = input.createdAt.getTime() + TRIAL_DAYS * 86_400_000;
  const left = Math.ceil((ends - input.now.getTime()) / 86_400_000);
  return {
    plan: "trial",
    active: left > 0,
    limits: PLANS.trial.limits,
    trialDaysLeft: Math.max(0, left),
  };
}

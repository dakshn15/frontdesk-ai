import "server-only";
import { eq, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { stripeEvents, subscriptions, workspaces } from "@/db/schema";
import { verifyStripeSignature } from "@/features/billing/signature";

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  metadata?: { workspace_id?: string };
  current_period_end?: number;
  items?: { data?: { price?: { id?: string }; current_period_end?: number }[] };
};

type StripeEvent = {
  id: string;
  type: string;
  data: { object: StripeSubscription };
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * Stripe's webhook: checks the signature, ignores events already handled, and keeps the
 * workspace's subscription in step. The event is recorded in the same transaction as the
 * change, so a failure leaves nothing behind and Stripe's retry runs it again.
 */
export async function handleStripeWebhook(
  request: Request,
  config: { secret: string; prices: { starter?: string; pro?: string } },
): Promise<Response> {
  const payload = await request.text();
  if (
    !verifyStripeSignature(
      payload,
      request.headers.get("stripe-signature"),
      config.secret,
    )
  ) {
    return json({ error: "Bad signature." }, 400);
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json({ error: "Bad payload." }, 400);
  }

  return adminDb.transaction(async (tx) => {
    const fresh = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (fresh.length === 0) return json({ received: true, duplicate: true });
    if (!SUBSCRIPTION_EVENTS.has(event.type)) return json({ received: true });

    const subscription = event.data.object;
    const workspaceId = subscription.metadata?.workspace_id;
    const [workspace] = workspaceId
      ? await tx
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
      : [];
    // A subscription made outside this app: nothing to link it to.
    if (!workspace) return json({ received: true, ignored: true });

    const item = subscription.items?.data?.[0];
    const priceId = item?.price?.id;
    const plan = priceId && priceId === config.prices.pro ? "pro" : "starter";
    const periodEnd =
      subscription.current_period_end ?? item?.current_period_end;
    const values = {
      workspaceId: workspace.id,
      plan,
      status:
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : subscription.status,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    };
    await tx
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: subscriptions.workspaceId,
        set: { ...values, updatedAt: sql`now()` },
      });
    return json({ received: true });
  });
}

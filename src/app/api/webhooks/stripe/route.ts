import { getServerEnv } from "@/env/server";
import { handleStripeWebhook } from "@/privileged/billing/webhook";

/** Stripe calls this when a subscription starts, changes or ends. */
export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Billing isn't set up." }, { status: 503 });
  }
  return handleStripeWebhook(request, {
    secret: env.STRIPE_WEBHOOK_SECRET,
    prices: { starter: env.STRIPE_PRICE_STARTER, pro: env.STRIPE_PRICE_PRO },
  });
}

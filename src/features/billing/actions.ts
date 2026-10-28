"use server";

import { eq } from "drizzle-orm";
import { withRls } from "@/db";
import { subscriptions } from "@/db/schema";
import { getServerEnv } from "@/env/server";
import { getMyProfile } from "@/features/account/queries";
import { getManagerContext } from "@/features/workspaces/manager-context";
import { type ActionResult, fail, NOT_ALLOWED, ok } from "@/lib/action-result";
import {
  createCheckout,
  createPortal,
  StripeError,
} from "@/privileged/billing/stripe";

const NOT_SET_UP =
  "Billing isn't set up yet. Add the Stripe test keys in your hosting settings.";

async function customerOf(
  claims: Parameters<typeof withRls>[0],
  workspaceId: string,
) {
  const [row] = await withRls(claims, (tx) =>
    tx
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId)),
  );
  return row?.customerId ?? null;
}

/** Stripe Checkout for Starter or Pro. The webhook records the subscription. */
export async function subscribe(
  slug: string,
  plan: "starter" | "pro",
): Promise<ActionResult<{ url: string }>> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  if (context.workspace.demoExpiresAt)
    return fail("Demo copies can't subscribe.");
  const env = getServerEnv();
  const priceId =
    plan === "pro" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_STARTER;
  if (!env.STRIPE_SECRET_KEY || !priceId) return fail(NOT_SET_UP);
  const base = `${env.NEXT_PUBLIC_SITE_URL}/w/${slug}/billing`;
  try {
    const url = await createCheckout({
      workspaceId: context.workspace.id,
      priceId,
      customerId: await customerOf(context.claims, context.workspace.id),
      email: (await getMyProfile(context.claims)).email,
      successUrl: `${base}?checkout=done`,
      cancelUrl: base,
    });
    return ok({ url });
  } catch (error) {
    console.error("billing: checkout failed", error);
    return fail(
      error instanceof StripeError
        ? `Stripe refused: ${error.message}`
        : "Couldn't open checkout. Try again.",
    );
  }
}

/** Stripe's Customer Portal, to change plan, update the card or cancel. */
export async function manageBilling(
  slug: string,
): Promise<ActionResult<{ url: string }>> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) return fail(NOT_SET_UP);
  const customerId = await customerOf(context.claims, context.workspace.id);
  if (!customerId) return fail("Subscribe to a plan first.");
  try {
    const url = await createPortal({
      customerId,
      returnUrl: `${env.NEXT_PUBLIC_SITE_URL}/w/${slug}/billing`,
    });
    return ok({ url });
  } catch (error) {
    console.error("billing: portal failed", error);
    return fail("Couldn't open billing. Try again.");
  }
}

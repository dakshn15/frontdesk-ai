import "server-only";
import { getServerEnv } from "@/env/server";

// Stripe's REST API through fetch: form-encoded requests, the secret key as a bearer token.

export class StripeError extends Error {}

/** Stripe's form encoding: nested keys as `a[b][0][c]=value`. */
export function formEncode(
  value: unknown,
  prefix = "",
  out = new URLSearchParams(),
): URLSearchParams {
  if (value === undefined || value === null) return out;
  if (typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);
    for (const [key, item] of entries) {
      formEncode(item, prefix ? `${prefix}[${key}]` : key, out);
    }
    return out;
  }
  out.append(prefix, String(value));
  return out;
}

async function stripe<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe isn't set up.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new StripeError(
      data.error?.message ?? `Stripe answered ${response.status}`,
    );
  return data;
}

/** The checkout page for a plan; the webhook links the subscription to the workspace. */
export async function createCheckout(input: {
  workspaceId: string;
  priceId: string;
  customerId: string | null;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe<{ url: string }>("checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.workspaceId,
    ...(input.customerId
      ? { customer: input.customerId }
      : input.email
        ? { customer_email: input.email }
        : {}),
    metadata: { workspace_id: input.workspaceId },
    subscription_data: { metadata: { workspace_id: input.workspaceId } },
    allow_promotion_codes: true,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  return session.url;
}

/** Stripe's page for changing plan, card or cancelling. */
export async function createPortal(input: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await stripe<{ url: string }>("billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return session.url;
}

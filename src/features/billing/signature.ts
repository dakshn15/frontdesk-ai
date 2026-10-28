import { createHmac, timingSafeEqual } from "node:crypto";

/** How old a Stripe event may be, so a captured request can't be replayed later. */
const TOLERANCE_SECONDS = 300;

/**
 * Checks a `Stripe-Signature` header ("t=<unix time>,v1=<hex>"): an HMAC-SHA256 of
 * "<t>.<raw body>" with the webhook secret, made within the last 5 minutes.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature ?? "", "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

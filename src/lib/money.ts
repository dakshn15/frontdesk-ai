// Prices are stored in minor units (cents) in the workspace's currency.

const MAX_MAJOR_UNITS = 1_000_000;

/** How many decimal places a currency uses: 2 for USD, 0 for JPY. */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/**
 * Reads a price the way people type it ("45", "$45.50", "1,200"). Blank means no price.
 * Works on the digits as text, so there is no floating-point rounding.
 */
export function parsePrice(
  input: string,
  currency: string,
): { ok: true; cents: number | null } | { ok: false } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, cents: null };

  const cleaned = trimmed.replace(/^[^\d.-]+/, "").replaceAll(",", "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return { ok: false };

  const digits = currencyDigits(currency);
  const [, whole, fraction = ""] = match;
  if (fraction.length > digits) return { ok: false };
  const major = Number(whole);
  if (major > MAX_MAJOR_UNITS) return { ok: false };

  const minor = fraction ? Number(fraction.padEnd(digits, "0")) : 0;
  return { ok: true, cents: major * 10 ** digits + minor };
}

/** "$180", "$45.50", "From $180", or "No price listed". */
export function formatPrice(
  cents: number | null,
  currency: string,
  isFrom: boolean,
): string {
  if (cents === null) return "No price listed";
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  const whole = cents % factor === 0;
  const text = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(cents / factor);
  return isFrom ? `From ${text}` : text;
}

/** A stored price as the edit form shows it: 18000 → "180", 4550 → "45.50", null → "". */
export function centsToInput(cents: number | null, currency: string): string {
  if (cents === null) return "";
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  const whole = Math.floor(cents / factor);
  const fraction = cents % factor;
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(digits, "0")}`;
}

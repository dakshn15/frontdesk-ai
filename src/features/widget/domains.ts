// Which websites may show a workspace's chat. A domain covers itself and its subdomains;
// with no domains set, the chat works on any site.

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** The bare host from whatever was typed ("https://www.x.com/page" → "x.com"), or null. */
export function normalizeDomain(input: string): string | null {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0];
  host = host
    .replace(/:\d+$/, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "");
  if (host === "localhost") return host;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label)))
    return null;
  return host;
}

export function hostAllowed(
  host: string | null | undefined,
  domains: readonly string[],
): boolean {
  if (domains.length === 0) return true;
  if (!host) return false;
  const name = host.toLowerCase();
  return domains.some(
    (domain) => name === domain || name.endsWith(`.${domain}`),
  );
}

/** The Content-Security-Policy for the chat page, or null when any site may embed it. */
export function frameAncestors(domains: readonly string[]): string | null {
  if (domains.length === 0) return null;
  const sources = domains.map((domain) =>
    domain === "localhost"
      ? "http://localhost:*"
      : `https://${domain} https://*.${domain}`,
  );
  return `frame-ancestors 'self' ${sources.join(" ")}`;
}

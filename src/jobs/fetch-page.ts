import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicAddress, parseFetchableUrl } from "@/lib/safe-url";

/** A page we won't or can't fetch; the message is shown to the owner. */
export class FetchPageError extends Error {}

export type FetchedPage = { url: string; contentType: string; body: string };
export type FetchPage = (url: string) => Promise<FetchedPage>;

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const PAGE_TYPES = /text\/html|application\/xhtml\+xml|xml|text\/plain/i;

type Deps = {
  resolve: (host: string) => Promise<string[]>;
  fetchFn: (url: URL, init: RequestInit) => Promise<Response>;
};

async function resolveAll(host: string): Promise<string[]> {
  try {
    return (await lookup(host, { all: true })).map((entry) => entry.address);
  } catch {
    return [];
  }
}

/** Refuses hosts that resolve to loopback, private or link-local addresses. */
async function assertPublicHost(url: URL, resolve: Deps["resolve"]) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0) {
    throw new FetchPageError("We couldn't find that website.");
  }
  if (addresses.some((address) => !isPublicAddress(address))) {
    throw new FetchPageError("We can't fetch pages from that address.");
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FetchPageError("That page is too large.");
    }
    parts.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(parts));
}

/**
 * Fetches a web page an owner pointed us at. Every hop (including redirects) must resolve to
 * a public address, so the request can't reach this server's own network.
 */
export async function fetchPage(
  input: string,
  deps: Deps = { resolve: resolveAll, fetchFn: fetch },
): Promise<FetchedPage> {
  const start = parseFetchableUrl(input);
  if (!start) throw new FetchPageError("That doesn't look like a web address.");
  let url: URL = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url, deps.resolve);
    let response: Response;
    try {
      response = await deps.fetchFn(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "FrontDeskAI-Knowledge/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
        },
      });
    } catch {
      throw new FetchPageError("That website didn't answer.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next: URL | null = location
        ? parseFetchableUrl(new URL(location, url).href)
        : null;
      if (!next)
        throw new FetchPageError(
          "That page redirects somewhere we can't follow.",
        );
      url = next;
      continue;
    }
    if (!response.ok) {
      throw new FetchPageError(
        `That page answered with an error (${response.status}).`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!PAGE_TYPES.test(contentType)) {
      throw new FetchPageError("That address isn't a web page.");
    }
    return { url: url.href, contentType, body: await readLimited(response) };
  }
  throw new FetchPageError("That page redirects too many times.");
}

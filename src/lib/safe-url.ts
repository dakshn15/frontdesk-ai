import { isIP } from "node:net";

// Guards for fetching pages owners point us at: the server must never be tricked into
// reaching its own network (loopback, private ranges, cloud metadata at 169.254.169.254).

function isPublicV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a >= 224) return false; // multicast and reserved
  return true;
}

function isPublicV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return isPublicV4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    return isPublicV4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  // ::, ::1 and the old IPv4-compatible ::a.b.c.d forms.
  if (lower.startsWith("::")) return false;
  // NAT64 (64:ff9b::/96) can reach IPv4 addresses, including private ones.
  if (lower.startsWith("64:ff9b:")) return false;
  const first = Number.parseInt(lower.split(":")[0], 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  return true;
}

/** Whether an IP address is on the public internet. Anything unparseable counts as not. */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicV4(ip);
  if (version === 6) return isPublicV6(ip);
  return false;
}

/** An http(s) URL to fetch, with https added when no scheme is given; null otherwise. */
export function parseFetchableUrl(input: string): URL | null {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".") && !url.hostname.startsWith("[")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

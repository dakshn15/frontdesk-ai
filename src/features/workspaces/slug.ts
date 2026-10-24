const MAX_BASE_LENGTH = 40;
// Matches the workspaces_slug_format check in the database.
const MAX_SLUG_LENGTH = 48;
const FALLBACK = "workspace";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A URL-safe version of a business name: "Café Lumière" becomes "cafe-lumiere". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/, "");
  // Names with no Latin letters or digits, or very short ones, still get a valid slug.
  return slug.length >= 3 ? slug : FALLBACK;
}

/** Adds "-" and 4 random characters, for when the plain slug is already taken. */
export function withRandomSuffix(slug: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(
    bytes,
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
  const base = slug.slice(0, MAX_SLUG_LENGTH - 5).replace(/-+$/, "");
  return `${base}-${suffix}`;
}

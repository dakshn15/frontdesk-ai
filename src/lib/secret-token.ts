import { createHash, randomBytes } from "node:crypto";

/** A random token for a link (manage links, later others); store only its hash. */
export function createSecretToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSecretToken(token) };
}

export function hashSecretToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

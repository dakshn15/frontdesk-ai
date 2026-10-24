import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
  inviteStatus,
} from "@/features/team/invite-token";

describe("invite tokens", () => {
  it("creates a URL-safe token and its SHA-256 hash", () => {
    const { token, tokenHash } = createInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashInviteToken(token));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("never repeats a token", () => {
    const tokens = Array.from({ length: 100 }, () => createInviteToken().token);
    expect(new Set(tokens).size).toBe(100);
  });

  it("hashes the same way every time", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("expires exactly 7 days later", () => {
    expect(
      inviteExpiresAt(new Date("2026-10-24T10:00:00Z")).toISOString(),
    ).toBe("2026-10-31T10:00:00.000Z");
  });
});

describe("inviteStatus", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  const past = new Date("2026-10-20T00:00:00Z");
  const future = new Date("2026-10-30T00:00:00Z");

  it("reports status in precedence order", () => {
    expect(
      inviteStatus({ acceptedAt: past, revokedAt: null, expiresAt: past }, now),
    ).toBe("accepted");
    expect(
      inviteStatus({ acceptedAt: null, revokedAt: past, expiresAt: past }, now),
    ).toBe("revoked");
    expect(
      inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: now }, now),
    ).toBe("expired");
    expect(
      inviteStatus(
        { acceptedAt: null, revokedAt: null, expiresAt: future },
        now,
      ),
    ).toBe("pending");
  });
});

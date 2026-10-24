import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withRls } from "@/db";
import { adminDb } from "@/db/admin";

const sub = randomUUID();

describe("withRls", () => {
  it("runs as authenticated with the caller's id and claims", async () => {
    const [row] = await withRls({ sub, email: "a@example.com" }, (tx) =>
      tx.execute(
        sql`select auth.uid()::text as uid, current_user as role, auth.jwt()->>'email' as email`,
      ),
    );
    expect(row).toEqual({
      uid: sub,
      role: "authenticated",
      email: "a@example.com",
    });
  });

  it("runs as anon without claims", async () => {
    const [row] = await withRls(null, (tx) =>
      tx.execute(sql`select auth.uid() as uid, current_user as role`),
    );
    expect(row).toEqual({ uid: null, role: "anon" });
  });

  it("ignores a role claim, so a token can't escalate", async () => {
    const [row] = await withRls({ sub, role: "service_role" }, (tx) =>
      tx.execute(sql`select current_user as role`),
    );
    expect(row.role).toBe("authenticated");
  });

  it("doesn't leak the role past the transaction", async () => {
    await withRls({ sub }, (tx) => tx.execute(sql`select 1`));
    const [row] = await adminDb.execute(sql`select current_user as role`);
    expect(row.role).toBe("postgres");
  });

  it("rolls back and rethrows when the callback throws", async () => {
    await expect(
      withRls({ sub }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

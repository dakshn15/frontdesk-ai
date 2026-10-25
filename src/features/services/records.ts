import "server-only";
import { and, eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { getPgError, PG_UNIQUE_VIOLATION } from "@/db/errors";
import { services } from "@/db/schema";
import { assertManager, Refused } from "@/features/workspaces/access";
import type { ServiceInput } from "./schemas";

function isDuplicateName(err: unknown): boolean {
  return getPgError(err)?.code === PG_UNIQUE_VIOLATION;
}

export async function createServiceRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: ServiceInput,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: "not_allowed" | "duplicate_name" }
> {
  try {
    const id = await withRls(claims, async (tx) => {
      await assertManager(tx, claims, workspaceId);
      const [row] = await tx
        .insert(services)
        .values({ workspaceId, ...input })
        .returning({ id: services.id });
      return row.id;
    });
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Refused) return { ok: false, error: "not_allowed" };
    if (isDuplicateName(err)) return { ok: false, error: "duplicate_name" };
    throw err;
  }
}

export async function updateServiceRecord(
  claims: AuthClaims,
  workspaceId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<"ok" | "not_allowed" | "duplicate_name"> {
  try {
    const updated = await withRls(claims, (tx) =>
      tx
        .update(services)
        .set(input)
        .where(
          and(
            eq(services.id, serviceId),
            eq(services.workspaceId, workspaceId),
          ),
        )
        .returning({ id: services.id }),
    );
    return updated.length > 0 ? "ok" : "not_allowed";
  } catch (err) {
    if (isDuplicateName(err)) return "duplicate_name";
    throw err;
  }
}

export async function deleteServiceRecord(
  claims: AuthClaims,
  workspaceId: string,
  serviceId: string,
): Promise<"ok" | "not_allowed"> {
  const deleted = await withRls(claims, (tx) =>
    tx
      .delete(services)
      .where(
        and(eq(services.id, serviceId), eq(services.workspaceId, workspaceId)),
      )
      .returning({ id: services.id }),
  );
  return deleted.length > 0 ? "ok" : "not_allowed";
}

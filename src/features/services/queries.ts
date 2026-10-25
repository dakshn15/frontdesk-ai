import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { services } from "@/db/schema";
import type { ServiceInput } from "./schemas";

export type Service = ServiceInput & { id: string };

/** Services grouped by category, then by name, ignoring case. */
export async function listServices(
  claims: AuthClaims,
  workspaceId: string,
): Promise<Service[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        category: services.category,
        durationMinutes: services.durationMinutes,
        bufferMinutes: services.bufferMinutes,
        priceCents: services.priceCents,
        priceIsFrom: services.priceIsFrom,
        bookableOnline: services.bookableOnline,
      })
      .from(services)
      .where(eq(services.workspaceId, workspaceId))
      .orderBy(
        asc(sql`lower(${services.category})`),
        asc(sql`lower(${services.name})`),
      ),
  );
}

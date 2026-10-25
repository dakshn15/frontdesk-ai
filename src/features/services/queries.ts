import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { services } from "@/db/schema";
import type { ServiceInput } from "./schemas";

export type Service = ServiceInput & { id: string; staffCount: number };

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
        // Plain SQL so `services.id` means the outer row: Drizzle drops table names in
        // a single-table select.
        staffCount: sql<number>`(select count(*)::int from public.staff_services ss where ss.service_id = services.id)`,
      })
      .from(services)
      .where(eq(services.workspaceId, workspaceId))
      .orderBy(
        asc(sql`lower(${services.category})`),
        asc(sql`lower(${services.name})`),
      ),
  );
}

import "server-only";
import { sql } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { aiKeysFor } from "@/privileged/ai-keys";
import type { SetupFacts } from "./checklist";

/** Everything the setup checklist needs, in one query. */
export async function getSetupFacts(
  claims: AuthClaims,
  workspaceId: string,
): Promise<SetupFacts> {
  const [rows, keys] = await Promise.all([
    withRls(claims, (tx) =>
      tx.execute<Omit<SetupFacts, "aiKey">>(sql`
      select
        exists (
          select 1 from public.business_hours where workspace_id = ${workspaceId}
        ) as "openingHours",
        (select count(*)::int from public.services where workspace_id = ${workspaceId}) as "services",
        (
          select count(*)::int from public.staff s
          where s.workspace_id = ${workspaceId}
            and s.active
            and exists (select 1 from public.staff_services ss where ss.staff_id = s.id)
            and exists (select 1 from public.staff_hours sh where sh.staff_id = s.id)
        ) as "bookableStaff",
        (select count(*)::int from public.policies where workspace_id = ${workspaceId}) as "policies",
        (select count(*)::int from public.verified_answers where workspace_id = ${workspaceId}) as "answers"
    `),
    ),
    // The keys table is server only, so this part can't run under the member's session.
    aiKeysFor(workspaceId),
  ]);
  const [facts] = rows;
  return { ...facts, aiKey: keys.source !== "none" };
}

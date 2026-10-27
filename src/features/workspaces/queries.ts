import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { type AuthClaims, withRls } from "@/db";
import { memberships, type WorkspaceRole, workspaces } from "@/db/schema";

export type Membership = {
  membershipId: string;
  role: WorkspaceRole;
  workspace: {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    timezone: string;
    currency: string;
    slotStepMinutes: number;
    minNoticeMinutes: number;
    maxDaysAhead: number;
    cancellationWindowHours: number;
    assistantName: string;
    aiProvider: "openai" | "google";
    /** Set on demo sandboxes: when this copy is deleted. */
    demoExpiresAt: Date | null;
  };
};

export async function listMyWorkspaces(
  claims: AuthClaims,
): Promise<{ id: string; name: string; slug: string; role: WorkspaceRole }[]> {
  return withRls(claims, (tx) =>
    tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, claims.sub))
      .orderBy(asc(memberships.createdAt)),
  );
}

/** The caller's membership in the workspace with this slug, or null. One query per request. */
export const getMembershipBySlug = cache(
  async (claims: AuthClaims, slug: string): Promise<Membership | null> => {
    const [row] = await withRls(claims, (tx) =>
      tx
        .select({
          membershipId: memberships.id,
          role: memberships.role,
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            website: workspaces.website,
            timezone: workspaces.timezone,
            currency: workspaces.currency,
            slotStepMinutes: workspaces.slotStepMinutes,
            minNoticeMinutes: workspaces.minNoticeMinutes,
            maxDaysAhead: workspaces.maxDaysAhead,
            cancellationWindowHours: workspaces.cancellationWindowHours,
            assistantName: workspaces.assistantName,
            aiProvider: workspaces.aiProvider,
            demoExpiresAt: workspaces.demoExpiresAt,
          },
        })
        .from(memberships)
        .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
        .where(
          and(eq(workspaces.slug, slug), eq(memberships.userId, claims.sub)),
        ),
    );
    return row ?? null;
  },
);

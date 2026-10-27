import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { businessHours, services, staff, workspaces } from "@/db/schema";

/**
 * What the demo salon's public website shows, read live from a sandbox, so changes made in
 * its dashboard (a new service, a price) appear on the site. Null for anything that isn't
 * a live sandbox.
 */
export async function getDemoSite(slug: string, now = new Date()) {
  const [workspace] = await adminDb
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      assistantName: workspaces.assistantName,
      currency: workspaces.currency,
      suggestions: workspaces.widgetSuggestions,
      demoExpiresAt: workspaces.demoExpiresAt,
    })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), gt(workspaces.demoExpiresAt, now)));
  if (!workspace?.demoExpiresAt) return null;
  const [serviceRows, staffRows, hourRows] = await Promise.all([
    adminDb
      .select({
        id: services.id,
        name: services.name,
        category: services.category,
        description: services.description,
        durationMinutes: services.durationMinutes,
        priceCents: services.priceCents,
        priceIsFrom: services.priceIsFrom,
      })
      .from(services)
      .where(
        and(
          eq(services.workspaceId, workspace.id),
          eq(services.bookableOnline, true),
        ),
      )
      .orderBy(asc(services.createdAt), asc(services.name)),
    adminDb
      .select({
        id: staff.id,
        name: staff.name,
        title: staff.title,
        bio: staff.bio,
      })
      .from(staff)
      .where(and(eq(staff.workspaceId, workspace.id), eq(staff.active, true)))
      .orderBy(asc(staff.createdAt)),
    adminDb
      .select({
        weekday: businessHours.weekday,
        startMinute: businessHours.startMinute,
        endMinute: businessHours.endMinute,
      })
      .from(businessHours)
      .where(eq(businessHours.workspaceId, workspace.id))
      .orderBy(asc(businessHours.weekday), asc(businessHours.startMinute)),
  ]);
  return {
    workspace: { ...workspace, demoExpiresAt: workspace.demoExpiresAt },
    services: serviceRows,
    staff: staffRows,
    hours: hourRows,
  };
}

export type DemoSite = NonNullable<Awaited<ReturnType<typeof getDemoSite>>>;

import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { workspaces } from "@/db/schema";
import { hostAllowed } from "@/features/widget/domains";

// The chat endpoints are called by the widget page, which the app serves itself. A browser
// on another site sends that site as the Origin, so those requests are refused.

/** True when the request says it came from another website. */
export function foreignOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

export const fromOtherSite = () =>
  Response.json(
    { error: "This chat only works on the business's own website." },
    { status: 403 },
  );

/** What the widget needs to draw itself, for a workspace slug. Public. */
export async function getWidgetConfig(slug: string) {
  const [row] = await adminDb
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      assistantName: workspaces.assistantName,
      timeZone: workspaces.timezone,
      color: workspaces.widgetColor,
      greeting: workspaces.widgetGreeting,
      suggestions: workspaces.widgetSuggestions,
      position: workspaces.widgetPosition,
      allowedDomains: workspaces.allowedDomains,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  return row ?? null;
}

export type WidgetConfig = NonNullable<
  Awaited<ReturnType<typeof getWidgetConfig>>
>;

/**
 * Whether the website showing the chat may use it. `host` is the page around the widget;
 * the app's own host (the dashboard's "Try it") always may.
 */
export function siteAllowed(
  request: Request,
  host: string | undefined,
  allowedDomains: readonly string[],
): boolean {
  if (host && host === new URL(request.url).hostname) return true;
  return hostAllowed(host, allowedDomains);
}

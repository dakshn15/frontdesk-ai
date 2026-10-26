import { eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { workspaces } from "@/db/schema";
import type { WidgetSettings } from "./schemas";

/** Saves the chat's look and allowed sites. False when the user may not change them. */
export async function updateWidgetSettingsRecord(
  claims: AuthClaims,
  workspaceId: string,
  settings: WidgetSettings,
): Promise<boolean> {
  const updated = await withRls(claims, (tx) =>
    tx
      .update(workspaces)
      .set(settings)
      .where(eq(workspaces.id, workspaceId))
      .returning({ id: workspaces.id }),
  );
  return updated.length > 0;
}

export async function getWidgetSettingsRecord(
  claims: AuthClaims,
  workspaceId: string,
): Promise<WidgetSettings | null> {
  const [row] = await withRls(claims, (tx) =>
    tx
      .select({
        widgetColor: workspaces.widgetColor,
        widgetGreeting: workspaces.widgetGreeting,
        widgetSuggestions: workspaces.widgetSuggestions,
        widgetPosition: workspaces.widgetPosition,
        allowedDomains: workspaces.allowedDomains,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId)),
  );
  if (!row) return null;
  return {
    ...row,
    widgetPosition: row.widgetPosition === "left" ? "left" : "right",
  };
}

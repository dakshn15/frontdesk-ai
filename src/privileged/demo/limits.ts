import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { workspaces } from "@/db/schema";

export const DEMO_LIMITS = {
  /** How long a sandbox lives before the daily clean-up deletes it. */
  lifetimeHours: 24,
  /** New sandboxes per visitor address. */
  sandboxesPerIp: { limit: 3, windowSeconds: 3600 },
  /** Sandboxes alive at once, across all visitors. */
  maxLive: 100,
  /** AI replies per day shared by every sandbox; after that, demos offer the lead form. */
  aiMessagesPerDay: { limit: 300, windowSeconds: 86_400 },
  aiKey: "demo-ai:day",
} as const;

/** Whether this workspace is a demo sandbox. */
export async function isDemoWorkspace(workspaceId: string): Promise<boolean> {
  const [row] = await adminDb
    .select({ demoExpiresAt: workspaces.demoExpiresAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return Boolean(row?.demoExpiresAt);
}

import { getServerEnv } from "@/env/server";
import { tagQuietConversations } from "@/privileged/analytics/tag";
import { cleanupSandboxes } from "@/privileged/demo/sandboxes";

export const maxDuration = 300;

/**
 * The daily housekeeping: deletes expired demo sandboxes and tags quiet chats with a topic
 * and outcome for analytics. Called by Vercel Cron with `Authorization: Bearer
 * <CRON_SECRET>`; the daily query also keeps a free Supabase project from pausing.
 */
export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) {
    return new Response("The daily job isn't set up yet.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deleted = await cleanupSandboxes();
  const tagged = await tagQuietConversations({ limit: 5000 });
  return Response.json({ deleted, tagged });
}

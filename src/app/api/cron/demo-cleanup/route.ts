import { getServerEnv } from "@/env/server";
import { cleanupSandboxes } from "@/privileged/demo/sandboxes";

export const maxDuration = 300;

/**
 * Deletes expired demo sandboxes. Called daily by Vercel Cron with
 * `Authorization: Bearer <CRON_SECRET>`; the daily query also keeps a free Supabase
 * project from pausing.
 */
export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) {
    return new Response("The demo clean-up isn't set up yet.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deleted = await cleanupSandboxes();
  return Response.json({ deleted });
}

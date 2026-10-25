import { getServerEnv } from "@/env/server";
import { sendDueReminders } from "@/jobs/reminders";

export const maxDuration = 300;

/** Called by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) {
    return new Response("Reminders aren't set up yet.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sent = await sendDueReminders();
  return Response.json({ sent });
}

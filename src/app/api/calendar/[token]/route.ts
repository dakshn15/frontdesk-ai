import { staffCalendarFeed } from "@/privileged/calendar-feed";

/** A staff member's private calendar feed. Calendar apps poll this URL. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/calendar/[token]">,
) {
  const { token } = await context.params;
  // Links end in .ics so calendar apps recognise them.
  const feed = await staffCalendarFeed(token.replace(/\.ics$/, ""));
  if (!feed) return new Response("Not found", { status: 404 });
  return new Response(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}

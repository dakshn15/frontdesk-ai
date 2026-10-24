// Reads auth emails caught by the local Mailpit server (started with the Supabase stack).
const mailUrl = () => process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MessageSummary = { ID: string; Created: string };

async function newestMessageId(to: string): Promise<string | null> {
  const res = await fetch(
    `${mailUrl()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { messages?: MessageSummary[] };
  const newest = [...(body.messages ?? [])].sort((a, b) =>
    b.Created.localeCompare(a.Created),
  )[0];
  return newest?.ID ?? null;
}

/** Waits for the newest email to `to` and returns its first link containing `pathIncludes`. */
export async function latestEmailLink(
  to: string,
  pathIncludes: string,
): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const id = await newestMessageId(to);
    if (id) {
      const message = (await (
        await fetch(`${mailUrl()}/api/v1/message/${id}`)
      ).json()) as { HTML?: string };
      const links = [...(message.HTML ?? "").matchAll(/href="([^"]+)"/g)].map(
        (match) => match[1].replaceAll("&amp;", "&"),
      );
      const link = links.find((href) => href.includes(pathIncludes));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email to ${to} with a link containing ${pathIncludes}`);
}

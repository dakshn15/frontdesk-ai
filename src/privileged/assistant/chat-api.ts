import "server-only";
import { z } from "zod";
import { allowRequest } from "../rate-limit";
import { MAX_MESSAGE_CHARS, runAgent } from "./agent";
import {
  createVisitorSession,
  openConversation,
  sessionFromToken,
} from "./sessions";

// Request handling for the chat endpoints, kept apart from the route files so it can be tested.

export const LIMITS = {
  sessionsPerIp: { limit: 30, windowSeconds: 3600 },
  messagesPerSession: { limit: 20, windowSeconds: 600 },
  messagesPerIp: { limit: 60, windowSeconds: 600 },
  previewPerUser: { limit: 30, windowSeconds: 600 },
} as const;

const json = (body: object, status = 200) => Response.json(body, { status });
const tooMany = () =>
  json(
    {
      error:
        "You're sending messages too quickly. Wait a minute and try again.",
    },
    429,
  );

/** The visitor's address as Vercel reports it; one bucket for everyone when it's missing. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const sessionBody = z.object({ workspace: z.string().min(1).max(64) });

export async function handleSession(request: Request): Promise<Response> {
  const body = sessionBody.safeParse(await readJson(request));
  if (!body.success) return json({ error: "Send the workspace." }, 400);
  const { limit, windowSeconds } = LIMITS.sessionsPerIp;
  if (
    !(await allowRequest(
      `chat-session:ip:${clientIp(request)}`,
      limit,
      windowSeconds,
    ))
  ) {
    return tooMany();
  }
  const session = await createVisitorSession(body.data.workspace);
  if (!session) return json({ error: "That workspace doesn't exist." }, 404);
  return json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
  });
}

const messageBody = z.object({
  conversationId: z.uuid().optional(),
  text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

const chatBody = messageBody.extend({ token: z.string().min(1).max(100) });

export async function handleChat(request: Request): Promise<Response> {
  const body = chatBody.safeParse(await readJson(request));
  if (!body.success)
    return json({ error: "Send a message of up to 2,000 characters." }, 400);
  const session = await sessionFromToken(body.data.token);
  if (!session)
    return json({ error: "This chat has expired. Reload the page." }, 401);

  const perSession = LIMITS.messagesPerSession;
  const perIp = LIMITS.messagesPerIp;
  const allowed =
    (await allowRequest(
      `chat:session:${session.sessionId}`,
      perSession.limit,
      perSession.windowSeconds,
    )) &&
    (await allowRequest(
      `chat:ip:${clientIp(request)}`,
      perIp.limit,
      perIp.windowSeconds,
    ));
  if (!allowed) return tooMany();

  const conversationId = await openConversation({
    workspaceId: session.workspaceId,
    channel: "widget",
    sessionId: session.sessionId,
    conversationId: body.data.conversationId,
  });
  const run = await runAgent({
    workspaceId: session.workspaceId,
    conversationId,
    mode: "live",
    text: body.data.text,
  });
  return run.response({ "x-conversation-id": conversationId });
}

/** The owner's preview: same agent, dry run, no visitor session. */
export async function handlePreview(
  request: Request,
  context: { workspaceId: string; userId: string },
): Promise<Response> {
  const body = messageBody.safeParse(await readJson(request));
  if (!body.success)
    return json({ error: "Send a message of up to 2,000 characters." }, 400);
  const { limit, windowSeconds } = LIMITS.previewPerUser;
  if (
    !(await allowRequest(`preview:${context.userId}`, limit, windowSeconds))
  ) {
    return tooMany();
  }
  const conversationId = await openConversation({
    workspaceId: context.workspaceId,
    channel: "preview",
    sessionId: null,
    conversationId: body.data.conversationId,
  });
  const run = await runAgent({
    workspaceId: context.workspaceId,
    conversationId,
    mode: "dry",
    text: body.data.text,
  });
  return run.response({ "x-conversation-id": conversationId });
}

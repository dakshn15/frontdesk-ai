import { handleSession } from "@/privileged/assistant/chat-api";

/** Starts a visitor chat session for a workspace (the widget calls this). */
export function POST(request: Request) {
  return handleSession(request);
}

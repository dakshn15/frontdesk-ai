import { handleChat } from "@/privileged/assistant/chat-api";

// Replies stream; tool calls and a fallback provider can take a while.
export const maxDuration = 60;

/** One visitor message in, the receptionist's reply streamed back. */
export function POST(request: Request) {
  return handleChat(request);
}

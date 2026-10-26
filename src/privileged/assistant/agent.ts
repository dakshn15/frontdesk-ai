import "server-only";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  type ModelMessage,
  streamText,
  toUIMessageStream,
} from "ai";
import { and, desc, eq, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { conversations, messages, usageEvents, workspaces } from "@/db/schema";
import { buildInstructions } from "@/features/assistant/instructions";
import { chooseModel } from "./models";
import { buildTools, type Source } from "./tools";

const HISTORY = 20;
const MAX_STEPS = 6;
export const MAX_MESSAGE_CHARS = 2000;

export const UNAVAILABLE_REPLY =
  "Sorry, I can't answer right now. Leave your name and email and the team will get back to you.";
const FAILED_REPLY =
  "Sorry, something went wrong on my side. Please try again.";

/** A streamed UI-message response, and a promise that settles once the reply is saved. */
export type AgentResult = {
  response: (headers?: HeadersInit) => Response;
  done: Promise<void>;
  /** The fixed reply when no model answered (no key set, or a person has taken over). */
  fixedReply?: string;
};

/** A one-message UI stream, for replies that don't come from the model. */
function fixed(text: string, conversationId: string): AgentResult {
  return {
    fixedReply: text,
    done: Promise.resolve(),
    response: (headers) =>
      createUIMessageStreamResponse({
        headers,
        stream: createUIMessageStream({
          execute: ({ writer }) => {
            writer.write({
              type: "message-metadata",
              messageMetadata: { conversationId, sources: [] },
            });
            if (!text) return;
            writer.write({ type: "text-start", id: "reply" });
            writer.write({ type: "text-delta", id: "reply", delta: text });
            writer.write({ type: "text-end", id: "reply" });
          },
        }),
      }),
  };
}

async function saveMessage(
  workspaceId: string,
  conversationId: string,
  role: "visitor" | "ai",
  content: string,
  sources: Source[] = [],
) {
  await adminDb
    .insert(messages)
    .values({ workspaceId, conversationId, role, content, sources });
  await adminDb
    .update(conversations)
    .set({ lastMessageAt: sql`now()` })
    .where(eq(conversations.id, conversationId));
}

/**
 * One visitor turn: saves the message, then streams the receptionist's reply. The reply,
 * its sources, every tool call and the token usage are saved when the stream ends.
 * `model` replaces the configured provider (tests).
 */
export async function runAgent(input: {
  workspaceId: string;
  conversationId: string;
  mode: "live" | "dry";
  text: string;
  model?: { model: LanguageModelV4; provider: string; modelId: string };
  now?: Date;
}): Promise<AgentResult> {
  const now = input.now ?? new Date();
  const { workspaceId, conversationId } = input;
  const [workspace] = await adminDb
    .select({
      name: workspaces.name,
      timeZone: workspaces.timezone,
      currency: workspaces.currency,
      assistantName: workspaces.assistantName,
      aiProvider: workspaces.aiProvider,
      status: conversations.status,
    })
    .from(conversations)
    .innerJoin(workspaces, eq(workspaces.id, conversations.workspaceId))
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.workspaceId, workspaceId),
      ),
    );
  if (!workspace) throw new Error("conversation not found in workspace");

  await saveMessage(
    workspaceId,
    conversationId,
    "visitor",
    input.text.slice(0, MAX_MESSAGE_CHARS),
  );
  // A person has taken over: the receptionist stays quiet (milestone 7 shows their replies).
  if (workspace.status === "human") return fixed("", conversationId);

  const choice = input.model
    ? { ...input.model, onFallback: () => {} }
    : chooseModel(workspace.aiProvider);
  if (!choice) {
    await saveMessage(workspaceId, conversationId, "ai", UNAVAILABLE_REPLY);
    return fixed(UNAVAILABLE_REPLY, conversationId);
  }
  let provider = choice.provider;
  let modelId = choice.modelId;
  let fellBack = false;
  choice.onFallback((nextProvider, nextModel) => {
    provider = nextProvider;
    modelId = nextModel;
    fellBack = true;
  });

  const history = await adminDb
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY);
  const conversation: ModelMessage[] = history.reverse().map((message) =>
    message.role === "visitor"
      ? { role: "user", content: message.content }
      : {
          role: "assistant",
          content:
            message.role === "staff"
              ? `(Team member) ${message.content}`
              : message.content,
        },
  );

  const sources = new Map<string, Source>();
  const tools = buildTools(
    {
      workspaceId,
      conversationId,
      mode: input.mode,
      timeZone: workspace.timeZone,
      currency: workspace.currency,
      now,
    },
    sources,
  );
  const started = Date.now();
  let saved: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    saved = resolve;
  });

  const result = streamText({
    model: choice.model,
    instructions: buildInstructions({
      business: workspace.name,
      assistantName: workspace.assistantName,
      timeZone: workspace.timeZone,
      now,
    }),
    messages: conversation,
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    onEnd: async (end) => {
      const text = end.text.trim() || FAILED_REPLY;
      await saveMessage(
        workspaceId,
        conversationId,
        "ai",
        text.slice(0, 8000),
        [...sources.values()],
      );
      await adminDb.insert(usageEvents).values({
        workspaceId,
        conversationId,
        provider,
        model: modelId,
        inputTokens: end.totalUsage.inputTokens ?? 0,
        outputTokens: end.totalUsage.outputTokens ?? 0,
        latencyMs: Date.now() - started,
        fellBack,
      });
      saved();
    },
    onError: async ({ error }) => {
      console.error("receptionist stream failed", error);
      saved();
    },
  });
  // Run to the end even if the visitor disconnects, so the reply is always saved.
  void result.consumeStream();
  return {
    done,
    response: (headers) =>
      createUIMessageStreamResponse({
        headers,
        stream: toUIMessageStream({
          stream: result.stream,
          // The browser learns which conversation it's in, then what the answer used.
          messageMetadata: ({ part }) =>
            part.type === "start"
              ? { conversationId, sources: [] }
              : part.type === "finish"
                ? { conversationId, sources: [...sources.values()] }
                : undefined,
        }),
      }),
  };
}

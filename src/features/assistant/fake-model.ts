import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";

// A scripted stand-in for a real model, for end-to-end tests (AI_FAKE=1, never on Vercel).
// It searches the knowledge with the visitor's words, then answers with the best passage,
// or says it isn't sure. It never calls any other tool.

const usage = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

const NOT_SURE =
  "I'm not sure about that. I can pass your question to the team if you leave your email.";

function lastUserText(options: LanguageModelV4CallOptions): string {
  for (const message of [...options.prompt].reverse()) {
    if (message.role !== "user") continue;
    return message.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

/** The first passage from the latest search_knowledge result, if there is one. */
function foundPassage(options: LanguageModelV4CallOptions): string | null {
  const last = options.prompt.at(-1);
  if (last?.role !== "tool") return null;
  for (const part of last.content) {
    if (part.type !== "tool-result") continue;
    const output = part.output as { type: string; value?: unknown };
    const value = output.value as
      { passages?: { content: string }[] } | undefined;
    const passage = value?.passages?.[0]?.content;
    if (passage) return passage;
  }
  return null;
}

function stream(parts: LanguageModelV4StreamPart[]) {
  return new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function respond(
  options: LanguageModelV4CallOptions,
): LanguageModelV4StreamPart[] {
  if (options.prompt.at(-1)?.role === "tool") {
    const text = foundPassage(options) ?? NOT_SURE;
    return [
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: text },
      { type: "text-end", id: "answer" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage,
      },
    ];
  }
  return [
    {
      type: "tool-call",
      toolCallId: `search-${options.prompt.length}`,
      toolName: "search_knowledge",
      input: JSON.stringify({ query: lastUserText(options) }),
    },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage,
    },
  ];
}

export function fakeModel(): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "fake",
    modelId: "scripted",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("The scripted model only streams.");
    },
    async doStream(options) {
      return { stream: stream(respond(options)) };
    },
  };
}

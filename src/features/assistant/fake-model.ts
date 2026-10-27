import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";

// A scripted stand-in for a real model, for end-to-end tests (AI_FAKE=1, never on Vercel).
// It searches the knowledge with the visitor's words, then answers with the best passage,
// or says it isn't sure. Asked to book, it offers the first free time for the first service;
// asked for a person, it hands off.

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

/** The output of the latest result from `toolName` in this turn, if there is one. */
function toolOutput<T>(
  options: LanguageModelV4CallOptions,
  toolName: string,
): T | undefined {
  for (const message of [...options.prompt].reverse()) {
    if (message.role === "user") return undefined;
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type === "tool-result" && part.toolName === toolName)
        return (part.output as { value?: unknown }).value as T;
    }
  }
  return undefined;
}

const say = (text: string): LanguageModelV4StreamPart[] => [
  { type: "text-start", id: "answer" },
  { type: "text-delta", id: "answer", delta: text },
  { type: "text-end", id: "answer" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
];

const call = (
  options: LanguageModelV4CallOptions,
  toolName: string,
  input: object,
): LanguageModelV4StreamPart[] => [
  {
    type: "tool-call",
    toolCallId: `${toolName}-${options.prompt.length}`,
    toolName,
    input: JSON.stringify(input),
  },
  {
    type: "finish",
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
  },
];

/** get_services, then check_availability, then propose_booking, then a short reply. */
function book(
  options: LanguageModelV4CallOptions,
): LanguageModelV4StreamPart[] {
  if (toolOutput(options, "propose_booking"))
    return say("Here's the next free time. Confirm it below to book.");
  const services = toolOutput<{ services: { id: string }[] }>(
    options,
    "get_services",
  );
  const serviceId = services?.services[0]?.id;
  if (!services) return call(options, "get_services", {});
  if (!serviceId) return say(NOT_SURE);
  const available = toolOutput<{
    slots: { staffId: string; startsAt: string }[];
  }>(options, "check_availability");
  if (!available)
    return call(options, "check_availability", { serviceId, days: 7 });
  const slot = available.slots[0];
  if (!slot) return say("There are no free times in the next week.");
  return call(options, "propose_booking", {
    serviceId,
    staffId: slot.staffId,
    startsAt: slot.startsAt,
  });
}

function respond(
  options: LanguageModelV4CallOptions,
): LanguageModelV4StreamPart[] {
  if (/\b(person|human)\b/i.test(lastUserText(options))) {
    return toolOutput(options, "handoff_to_human")
      ? say("I've asked the team to join. Someone will reply here soon.")
      : call(options, "handoff_to_human", {
          reason: "The visitor asked for a person.",
        });
  }
  if (/\bbook\b/i.test(lastUserText(options))) return book(options);
  if (options.prompt.at(-1)?.role === "tool") {
    return say(foundPassage(options) ?? NOT_SURE);
  }
  return call(options, "search_knowledge", { query: lastUserText(options) });
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

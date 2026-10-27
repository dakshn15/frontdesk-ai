"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { RotateCcw, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Inspect, Inspector } from "./inspector";

type Source = {
  kind: "answer" | "passage" | "policy";
  id: string;
  title: string;
};
type Meta = { conversationId?: string; sources?: Source[]; inspect?: Inspect };
type ChatMessage = UIMessage<Meta>;

const SOURCE_LABEL = {
  answer: "Verified answer",
  passage: "Knowledge",
  policy: "Policy",
} as const;

const textOf = (message: ChatMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

/** Tool names the receptionist used for one answer, in the order it used them. */
function toolsUsed(message: ChatMessage): string[] {
  const names = message.parts
    .filter((part) => part.type.startsWith("tool-"))
    .map((part) => part.type.slice("tool-".length));
  return [...new Set(names)];
}

type Offer = {
  serviceName: string;
  staffId: string;
  staffName: string;
  startsAt: string;
  label: string;
  duration: string;
  price: string;
};

/** Booking cards the receptionist offered in one answer. */
function offers(message: ChatMessage): Offer[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "tool-propose_booking") return [];
    const { state, output } = part as { state?: string; output?: unknown };
    const result = output as { ok?: boolean; card?: Offer } | undefined;
    return state === "output-available" && result?.ok && result.card
      ? [result.card]
      : [];
  });
}

export function PreviewChat({
  slug,
  assistantName,
  disabled,
}: {
  slug: string;
  assistantName: string;
  disabled: boolean;
}) {
  // The server keeps the history; each request sends only the new message, plus the
  // conversation id the last reply carried in its metadata.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: `/api/w/${slug}/assistant`,
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages.at(-1);
          const text =
            last?.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("") ?? "";
          const conversationId = messages.findLast(
            (message) => message.metadata?.conversationId,
          )?.metadata?.conversationId;
          return { body: { conversationId, text } };
        },
      }),
  );
  const { messages, sendMessage, setMessages, status, error } =
    useChat<ChatMessage>({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  // The inspector shows the reply picked, or else the latest one.
  const [picked, setPicked] = useState<string | null>(null);
  const replies = messages.filter((message) => message.role === "assistant");
  const selected =
    replies.find((message) => message.id === picked) ?? replies.at(-1);
  const selectedIndex = selected ? messages.indexOf(selected) : -1;
  const askedFor = selectedIndex > 0 ? textOf(messages[selectedIndex - 1]) : "";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || disabled) return;
    void sendMessage({ text });
    setInput("");
  }

  function startOver() {
    setMessages([]);
    setPicked(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="flex h-[60vh] min-h-96 flex-col rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">{assistantName}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={startOver}
            disabled={busy || messages.length === 0}
          >
            <RotateCcw />
            Start over
          </Button>
        </div>

        <ol
          aria-label="Conversation"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.length === 0 ? (
            <li className="m-auto max-w-xs text-center text-sm text-muted-foreground">
              Ask what a customer would, like &ldquo;Do you have parking?&rdquo;
              or &ldquo;Can I book a cut on Friday?&rdquo;
            </li>
          ) : null}
          {messages.map((message) => {
            const mine = message.role === "user";
            const text = textOf(message);
            const tools = mine ? [] : toolsUsed(message);
            const sources = message.metadata?.sources ?? [];
            return (
              <li
                key={message.id}
                className={cn(
                  "flex max-w-[85%] flex-col gap-1.5",
                  mine ? "self-end items-end" : "self-start",
                )}
              >
                <p
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {text || (busy ? "…" : "")}
                </p>
                {offers(message).map((offer) => (
                  <div
                    key={`${offer.staffId}:${offer.startsAt}`}
                    className="rounded-xl border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {offer.serviceName} with {offer.staffName}
                    </p>
                    <p>{offer.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.duration} · {offer.price}. Customers confirm this
                      card in the website chat.
                    </p>
                  </div>
                ))}
                {sources.length > 0 ? (
                  <div aria-label="Sources" className="flex flex-wrap gap-1">
                    {sources.map((source) => (
                      <Badge
                        key={`${source.kind}:${source.id}`}
                        variant="secondary"
                      >
                        {SOURCE_LABEL[source.kind]}: {source.title}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {tools.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Used {tools.join(", ")}
                  </p>
                ) : null}
                {!mine && message !== selected ? (
                  <button
                    type="button"
                    onClick={() => setPicked(message.id)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Show how this was made
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>

        {error ? (
          <p
            role="alert"
            className="border-t px-4 py-2 text-sm text-destructive"
          >
            Something went wrong. Try again in a moment.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="flex gap-2 border-t p-3">
          <Input
            aria-label="Message"
            placeholder={disabled ? "Add an AI key first" : "Type a question"}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={disabled}
            maxLength={2000}
            className="h-10"
          />
          <Button
            type="submit"
            className="h-10 px-4"
            disabled={disabled || busy || !input.trim()}
          >
            <Send />
            Send
          </Button>
        </form>
      </div>
      {selected ? (
        <Inspector
          slug={slug}
          question={askedFor}
          answer={textOf(selected)}
          parts={selected.parts}
          inspect={selected.metadata?.inspect}
        />
      ) : (
        <aside className="h-fit rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Ask something to see how the answer was made: the tools used, the
          knowledge found, the model, tokens and time.
        </aside>
      )}
    </div>
  );
}

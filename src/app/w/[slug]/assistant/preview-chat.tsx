"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { RotateCcw, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Source = {
  kind: "answer" | "passage" | "policy";
  id: string;
  title: string;
};
type Meta = { conversationId?: string; sources?: Source[] };
type ChatMessage = UIMessage<Meta>;

const SOURCE_LABEL = {
  answer: "Verified answer",
  passage: "Knowledge",
  policy: "Policy",
} as const;

/** Tool names the receptionist used for one answer, in the order it used them. */
function toolsUsed(message: ChatMessage): string[] {
  const names = message.parts
    .filter((part) => part.type.startsWith("tool-"))
    .map((part) => part.type.slice("tool-".length));
  return [...new Set(names)];
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || disabled) return;
    void sendMessage({ text });
    setInput("");
  }

  function startOver() {
    setMessages([]);
  }

  return (
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
          const text = message.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
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
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
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
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageCircle, Send, X } from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  parentHost,
  chatSessionStore,
  type StoredChat,
  textOn,
} from "@/features/widget/client";
import { cn } from "@/lib/utils";
import { type BookingOffer, BookingCard } from "./booking-card";
import { LeadForm } from "./lead-form";
import { postJson, type WidgetPost } from "./widget-api";

type Source = {
  kind: "answer" | "passage" | "policy";
  id: string;
  title: string;
};
type Meta = { conversationId?: string; sources?: Source[]; author?: string };
type ChatMessage = UIMessage<Meta>;
type ToolPart = { type: string; state?: string; output?: unknown };

type HistoryMessage = {
  id: string;
  role: "visitor" | "ai" | "staff";
  content: string;
  sources: Source[];
  author: string | null;
};
type History = {
  status?: "ai" | "needs_human" | "human" | "resolved";
  handler?: string | null;
  askForEmail?: boolean;
  messages?: HistoryMessage[];
};
/** What the server last said about the chat, and how many handoffs the stream had shown. */
type ServerState = {
  status: NonNullable<History["status"]>;
  handler: string | null;
  askForEmail: boolean;
  handoffs: number;
};

// While someone from the team is involved, the widget checks for their replies this often.
const POLL_MS = 4000;

function fromHistory(
  message: HistoryMessage,
  conversationId: string,
): ChatMessage {
  return {
    id: message.id,
    role: message.role === "visitor" ? "user" : "assistant",
    parts: [{ type: "text", text: message.content }],
    metadata: {
      conversationId,
      sources: message.sources,
      author: message.author ?? undefined,
    },
  };
}

const serverState = (data: History, handoffs: number): ServerState => ({
  status: data.status ?? "ai",
  handler: data.handler ?? null,
  askForEmail: data.askForEmail === true,
  handoffs,
});

export type WidgetChatConfig = {
  slug: string;
  business: string;
  assistantName: string;
  timeZone: string;
  color: string;
  greeting: string;
  suggestions: string[];
  position: "right" | "left";
};

const SOURCE_LABEL = {
  answer: "Verified answer",
  passage: "From our info",
  policy: "Policy",
} as const;

const noSubscribe = () => () => {};
const textOf = (message: ChatMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

function offerIn(part: ToolPart): BookingOffer | null {
  if (part.type !== "tool-propose_booking" || part.state !== "output-available")
    return null;
  const output = part.output as { ok?: boolean; card?: BookingOffer };
  return output?.ok && output.card ? output.card : null;
}

const handedOffIn = (message: ChatMessage) =>
  message.parts.some(
    (part) =>
      part.type === "tool-handoff_to_human" &&
      (part as ToolPart).state === "output-available",
  );

/** The chat a visitor sees on the business's website. */
export function WidgetChat({
  config,
  ready,
}: {
  config: WidgetChatConfig;
  ready: boolean;
}) {
  const { slug } = config;
  // Opened on its own (the dashboard's "Try it"), the chat shows without a launcher.
  const framed = useSyncExternalStore(
    noSubscribe,
    () => window.top !== window,
    () => true,
  );
  const [open, setOpen] = useState(false);
  const showPanel = open || !framed;
  const [blocked, setBlocked] = useState(false);
  const [server, setServer] = useState<ServerState | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [input, setInput] = useState("");
  const [session] = useState(() => chatSessionStore(slug));
  const inputRef = useRef<HTMLInputElement>(null);
  const brand = config.color;
  const onBrand = textOn(brand);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const conversationId =
            messages.findLast((message) => message.metadata?.conversationId)
              ?.metadata?.conversationId ?? session.get()?.conversationId;
          const last = messages.at(-1);
          return {
            body: {
              token: session.get()?.token,
              conversationId,
              text: last ? textOf(last) : "",
            },
          };
        },
      }),
  );
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat<ChatMessage>({ transport });
  const busy = status === "submitted" || status === "streaming";

  // Bring back this tab's conversation after a reload.
  useEffect(() => {
    const stored = session.load();
    if (!stored?.conversationId) return;
    let cancelled = false;
    void postJson("/api/widget/history", {
      token: stored.token,
      conversationId: stored.conversationId,
    }).then((result) => {
      const data = result.data as History;
      const conversationId = stored.conversationId;
      if (cancelled || !result.ok || !data.messages || !conversationId) return;
      setServer(serverState(data, 0));
      setMessages(
        data.messages.map((message) => fromHistory(message, conversationId)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [session, setMessages]);

  // Handoffs the receptionist made in this page's stream. A new one means the server's last
  // word is out of date until the next check.
  const handoffs = messages.filter(handedOffIn).length;
  const chatState: ServerState["status"] =
    server && server.handoffs === handoffs
      ? server.status
      : handoffs > 0
        ? "needs_human"
        : (server?.status ?? "ai");
  const withTeam = chatState === "needs_human" || chatState === "human";

  // While a person is (or should be) involved, check for their replies every few seconds.
  useEffect(() => {
    if (!withTeam) return;
    let cancelled = false;
    async function check() {
      const current = session.get();
      if (document.hidden || !current?.conversationId) return;
      const { conversationId } = current;
      const result = await postJson("/api/widget/history", {
        token: current.token,
        conversationId,
      });
      const data = result.data as History;
      if (cancelled || !result.ok || !data.messages) return;
      setServer(serverState(data, handoffs));
      const replies = data.messages.filter(
        (message) => message.role === "staff",
      );
      setMessages((shown) => {
        const seen = new Set(shown.map((message) => message.id));
        const fresh = replies.filter((reply) => !seen.has(reply.id));
        return fresh.length === 0
          ? shown
          : [
              ...shown,
              ...fresh.map((reply) => fromHistory(reply, conversationId)),
            ];
      });
    }
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [withTeam, handoffs, session, setMessages]);

  // Remember the conversation the server put this visitor in.
  useEffect(() => {
    const conversationId = messages.findLast(
      (message) => message.metadata?.conversationId,
    )?.metadata?.conversationId;
    const current = session.get();
    if (
      current &&
      conversationId &&
      current.conversationId !== conversationId
    ) {
      session.set({ ...current, conversationId });
    }
  }, [messages, session]);

  // Tell the embed script how big to make the iframe.
  useEffect(() => {
    if (!framed) return;
    window.parent.postMessage(
      { type: "frontdesk:state", open, position: config.position },
      "*",
    );
  }, [framed, open, config.position]);

  useEffect(() => {
    if (showPanel) inputRef.current?.focus();
  }, [showPanel]);

  const ensureSession = useCallback(async (): Promise<StoredChat | null> => {
    const existing = session.get();
    if (existing) return existing;
    const result = await postJson("/api/chat/session", {
      workspace: slug,
      host: parentHost(),
    });
    if (result.status === 403) {
      setBlocked(true);
      return null;
    }
    const data = result.data as { token?: string; expiresAt?: string };
    if (!result.ok || !data.token || !data.expiresAt) return null;
    const created = { token: data.token, expiresAt: data.expiresAt };
    session.set(created);
    return created;
  }, [session, slug]);

  const post: WidgetPost = useCallback(
    async (path, body) => {
      const current = await ensureSession();
      if (!current)
        return {
          ok: false,
          status: 0,
          data: { error: "The chat isn't available right now." },
        };
      const conversationId =
        messages.findLast((message) => message.metadata?.conversationId)
          ?.metadata?.conversationId ?? current.conversationId;
      return postJson(path, { ...body, token: current.token, conversationId });
    },
    [ensureSession, messages],
  );

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    clearError();
    if (!(await ensureSession())) return;
    void sendMessage({ text: question });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  function onBooked(message: string) {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: message }],
        metadata: { sources: [] },
      },
    ]);
  }

  function startOver() {
    session.set(null);
    setMessages([]);
    setServer(null);
    clearError();
  }

  const askForEmail =
    chatState === "needs_human" &&
    server?.handoffs === handoffs &&
    server.askForEmail;
  const style = { "--brand": brand } as CSSProperties;

  if (framed && !showPanel) {
    return (
      <div
        className={cn(
          "fixed bottom-4",
          config.position === "left" ? "left-4" : "right-4",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${config.assistantName}`}
          className="flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-zinc-300 focus-visible:outline-none"
          style={{ background: brand, color: onBrand }}
        >
          <MessageCircle className="size-6" />
        </button>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "fixed inset-0 flex p-3",
        framed
          ? config.position === "left"
            ? "items-end justify-start"
            : "items-end justify-end"
          : "items-center justify-center bg-zinc-100",
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape" && framed) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-label={`Chat with ${config.assistantName}`}
        className="flex h-full max-h-[720px] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl"
      >
        <header
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ background: brand, color: onBrand }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {config.assistantName}
            </p>
            <p className="truncate text-xs opacity-80">{config.business}</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={startOver}
                disabled={busy}
                className="rounded-md px-2 py-1 text-xs opacity-90 hover:bg-black/10"
              >
                New chat
              </button>
            ) : null}
            {framed ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-md p-1.5 hover:bg-black/10"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </header>

        <ol
          aria-label="Conversation"
          aria-live="polite"
          className="flex flex-1 flex-col gap-3 overflow-y-auto bg-zinc-50 p-4"
        >
          <li className="max-w-[85%] self-start rounded-2xl bg-white px-3.5 py-2 text-sm shadow-sm">
            {config.greeting}
          </li>
          {messages.map((message, index) => {
            const mine = message.role === "user";
            const text = textOf(message);
            const offers = mine
              ? []
              : message.parts
                  .map((part) => offerIn(part as ToolPart))
                  .filter((offer): offer is BookingOffer => offer !== null);
            const sources = message.metadata?.sources ?? [];
            const author = message.metadata?.author;
            const waiting =
              !mine && busy && index === messages.length - 1 && !offers.length;
            // While the team handles the chat, the AI's turn is an empty reply: skip it.
            if (!mine && !text && !waiting && !offers.length) return null;
            return (
              <li
                key={message.id}
                className={cn(
                  "flex max-w-[85%] flex-col gap-1.5",
                  mine ? "items-end self-end" : "self-start",
                )}
              >
                {author ? (
                  <p className="text-[11px] text-zinc-500">
                    {author} from the team
                  </p>
                ) : null}
                {text || waiting ? (
                  <p
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                      mine ? "" : "bg-white shadow-sm",
                    )}
                    style={mine ? { background: brand, color: onBrand } : {}}
                  >
                    {text || "…"}
                  </p>
                ) : null}
                {offers.map((offer) => (
                  <BookingCard
                    key={`${offer.staffId}:${offer.startsAt}`}
                    offer={offer}
                    timeZone={config.timeZone}
                    brand={brand}
                    onBrand={onBrand}
                    post={post}
                    onBooked={onBooked}
                  />
                ))}
                {sources.length > 0 ? (
                  <ul aria-label="Sources" className="flex flex-wrap gap-1">
                    {sources.map((source) => (
                      <li
                        key={`${source.kind}:${source.id}`}
                        className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600"
                      >
                        {SOURCE_LABEL[source.kind]}: {source.title}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
          {messages.length === 0 && ready && config.suggestions.length > 0 ? (
            <li className="flex flex-wrap gap-1.5 self-start">
              {config.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void ask(suggestion)}
                  className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-100"
                  style={{ borderColor: brand }}
                >
                  {suggestion}
                </button>
              ))}
            </li>
          ) : null}
          {withTeam ? (
            <li
              role="status"
              className="self-stretch rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              {chatState === "human"
                ? `You're chatting with ${server?.handler ?? "someone"} from the team.`
                : "A team member will reply here as soon as they can."}
            </li>
          ) : null}
          {blocked ? (
            <li role="alert" className="self-stretch text-sm text-red-700">
              This chat isn&apos;t set up for this website.
            </li>
          ) : null}
          {error ? (
            <li role="alert" className="self-stretch text-sm text-red-700">
              Something went wrong. Try again in a moment, or leave your
              details.
            </li>
          ) : null}
          {!ready || leadOpen || askForEmail ? (
            <li className="self-stretch">
              <LeadForm
                intro={
                  !ready
                    ? "Our assistant isn't available right now. Leave your details and the team will get back to you."
                    : askForEmail
                      ? "Nobody on the team is free right now. Leave your email and they'll reply by email."
                      : "Leave your details and the team will get back to you."
                }
                brand={brand}
                onBrand={onBrand}
                post={post}
                onCancel={
                  ready && !askForEmail ? () => setLeadOpen(false) : undefined
                }
              />
            </li>
          ) : null}
        </ol>

        {ready && !blocked ? (
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-zinc-200 p-3"
          >
            <input
              ref={inputRef}
              aria-label="Message"
              placeholder="Type your question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2000}
              className="h-10 min-w-0 flex-1 rounded-full border border-zinc-300 px-4 text-sm outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={busy || !input.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
              style={{ background: brand, color: onBrand }}
            >
              <Send className="size-4" />
            </button>
          </form>
        ) : null}
        <footer className="flex items-center justify-between border-t border-zinc-100 px-4 py-1.5 text-[11px] text-zinc-500">
          <span>AI assistant. It can make mistakes.</span>
          {ready && !leadOpen ? (
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="underline underline-offset-2 hover:text-zinc-800"
            >
              Leave your details
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { ArrowLeft, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { InboxLiveUpdates } from "@/components/app-shell/live-updates";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, TOOL_LABEL } from "@/features/inbox/constants";
import { getConversation } from "@/features/inbox/queries";
import { requireMembership } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { ConversationActions, ReplyForm } from "./conversation-controls";

export const metadata: Metadata = { title: "Conversation" };

const SOURCE_LABEL: Record<string, string> = {
  answer: "Verified answer",
  passage: "Knowledge",
  policy: "Policy",
};

/** A short, readable summary of what a tool was asked. */
function toolDetail(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const entries = Object.entries(input as Record<string, unknown>).filter(
    ([key]) => !key.endsWith("Id"),
  );
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

export default async function ConversationPage({
  params,
}: PageProps<"/w/[slug]/inbox/[id]">) {
  const { slug, id } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace } = membership;
  if (!z.uuid().safeParse(id).success) notFound();
  const conversation = await getConversation(claims, workspace.id, id);
  if (!conversation) notFound();
  const lead = conversation.leads.at(-1) ?? null;
  const time = (at: Date) =>
    format(new TZDate(at, workspace.timezone), "MMM d, h:mm a");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:py-10">
      <InboxLiveUpdates workspaceId={workspace.id} />
      <Link
        href={`/w/${slug}/inbox`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Inbox
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {lead ? lead.name || lead.email : "Website visitor"}
        </h1>
        <Badge
          variant={
            conversation.status === "needs_human" ? "destructive" : "secondary"
          }
        >
          {STATUS_LABEL[conversation.status]}
          {conversation.status === "human" && conversation.handler
            ? `: ${conversation.handler}`
            : ""}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Started {time(conversation.createdAt)}
        {conversation.status === "needs_human" && conversation.handoffReason
          ? `. Handed off: ${conversation.handoffReason}`
          : ""}
      </p>

      <div className="mt-6">
        <ConversationActions
          slug={slug}
          conversationId={conversation.id}
          status={conversation.status}
          mine={conversation.assignedTo === claims.sub}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_16rem]">
        <section aria-labelledby="transcript">
          <h2 id="transcript" className="sr-only">
            Transcript
          </h2>
          <ol aria-label="Transcript" className="flex flex-col gap-3">
            {conversation.timeline.map((item) =>
              item.kind === "tool" ? (
                <li
                  key={item.id}
                  className="flex items-start gap-2 pl-1 text-xs text-muted-foreground"
                >
                  <Wrench className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {TOOL_LABEL[item.tool] ?? item.tool}
                    {toolDetail(item.input)
                      ? ` (${toolDetail(item.input)})`
                      : ""}
                  </span>
                </li>
              ) : (
                <li
                  key={item.id}
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1",
                    item.role === "visitor"
                      ? "self-start"
                      : "self-end items-end",
                  )}
                >
                  <p className="text-xs text-muted-foreground">
                    {item.role === "visitor"
                      ? "Visitor"
                      : item.role === "ai"
                        ? "AI"
                        : (item.author ?? "Team")}{" "}
                    · {time(item.at)}
                  </p>
                  <p
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                      item.role === "visitor"
                        ? "bg-muted"
                        : item.role === "staff"
                          ? "bg-primary text-primary-foreground"
                          : "border",
                    )}
                  >
                    {item.content}
                  </p>
                  {item.sources.length > 0 ? (
                    <div aria-label="Sources" className="flex flex-wrap gap-1">
                      {item.sources.map((source) => (
                        <Badge
                          key={`${source.kind}:${source.id}`}
                          variant="outline"
                        >
                          {SOURCE_LABEL[source.kind] ?? source.kind}:{" "}
                          {source.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ol>

          <div className="mt-8 border-t pt-6">
            {conversation.status === "human" ? (
              <ReplyForm
                slug={slug}
                conversationId={conversation.id}
                email={lead?.email ?? null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Take over the chat to reply. The AI stops answering until you
                hand it back.
              </p>
            )}
          </div>
        </section>

        <aside
          aria-labelledby="visitor"
          className="h-fit rounded-xl border p-4"
        >
          <h2 id="visitor" className="text-sm font-semibold">
            Visitor details
          </h2>
          {lead ? (
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd>{lead.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-all">{lead.email}</dd>
              </div>
              {lead.phone ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{lead.phone}</dd>
                </div>
              ) : null}
              {lead.message ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Message</dt>
                  <dd className="whitespace-pre-line">{lead.message}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              They haven&apos;t left their details.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

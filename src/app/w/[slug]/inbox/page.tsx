import { formatDistanceStrict } from "date-fns";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InboxLiveUpdates } from "@/components/app-shell/live-updates";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FILTER_LABEL, STATUS_LABEL } from "@/features/inbox/constants";
import {
  INBOX_FILTERS,
  type InboxFilter,
  listConversations,
} from "@/features/inbox/queries";
import { requireMembership } from "@/lib/auth/session";
import { firstParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/inbox">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace } = membership;
  const query = await searchParams;
  const requested = firstParam(query.status);
  const filter: InboxFilter = INBOX_FILTERS.includes(requested as InboxFilter)
    ? (requested as InboxFilter)
    : "all";
  const q = (firstParam(query.q) ?? "").slice(0, 100);
  const { rows, counts } = await listConversations(claims, workspace.id, {
    filter,
    q,
  });
  const now = new Date();
  const hrefFor = (next: InboxFilter) => {
    const search = new URLSearchParams();
    if (next !== "all") search.set("status", next);
    if (q) search.set("q", q);
    const text = search.toString();
    return `/w/${slug}/inbox${text ? `?${text}` : ""}`;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:py-10">
      <InboxLiveUpdates workspaceId={workspace.id} />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Inbox
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every chat from your website. Take one over to reply yourself; the list
        updates as visitors write.
      </p>

      <nav
        aria-label="Filter conversations"
        className="mt-6 flex flex-wrap gap-1.5"
      >
        {INBOX_FILTERS.map((option) => (
          <Link
            key={option}
            href={hrefFor(option)}
            aria-current={option === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              option === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {FILTER_LABEL[option]}{" "}
            <span className="tabular-nums">{counts[option]}</span>
          </Link>
        ))}
      </nav>

      <form className="relative mt-4 max-w-sm" role="search">
        {filter !== "all" ? (
          <input type="hidden" name="status" value={filter} />
        ) : null}
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search conversations"
          placeholder="Search messages, names or emails"
          className="h-10 pl-9"
        />
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {q || filter !== "all"
            ? "No conversations match."
            : "No conversations yet. They appear here once the widget is on your website."}
        </p>
      ) : (
        <ul
          aria-label="Conversations"
          className="mt-6 divide-y rounded-xl border"
        >
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/w/${slug}/inbox/${row.id}`}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {row.visitor ?? "Website visitor"}
                    </p>
                    <Badge
                      variant={
                        row.status === "needs_human"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {STATUS_LABEL[row.status]}
                      {row.handler ? `: ${row.handler}` : ""}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {row.preview || "No messages yet"}
                  </p>
                </div>
                <time
                  dateTime={row.lastMessageAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatDistanceStrict(row.lastMessageAt, now, {
                    addSuffix: true,
                  })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

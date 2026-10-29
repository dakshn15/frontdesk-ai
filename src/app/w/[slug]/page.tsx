import { TZDate } from "@date-fns/tz";
import { format, formatDistanceStrict } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Inbox,
  MessageCircle,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getAnalytics } from "@/features/analytics/queries";
import { listBookingsForDay } from "@/features/bookings/queries";
import { STATUS_LABEL } from "@/features/inbox/constants";
import { countWaiting, listConversations } from "@/features/inbox/queries";
import { setupChecklist } from "@/features/setup/checklist";
import { getSetupFacts } from "@/features/setup/queries";
import { requireMembership } from "@/lib/auth/session";
import { addDays, localDate } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { SetupChecklist } from "./setup-checklist";

export async function generateMetadata({
  params,
}: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { membership } = await requireMembership(slug);
  return { title: membership.workspace.name };
}

function Stat({
  label,
  value,
  href,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40",
        highlight &&
          "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
      )}
    >
      <span className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <span className="text-muted-foreground/70 group-hover:text-primary">
          {icon}
        </span>
      </span>
      <span className="mt-2 block text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
    </Link>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col rounded-2xl border bg-card shadow-xs"
    >
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="font-semibold">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export default async function WorkspaceOverviewPage({
  params,
}: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace, role } = membership;
  const canEdit = role === "owner" || role === "admin";
  const today = localDate(workspace.timezone);
  const [facts, bookings, waiting, chats, week] = await Promise.all([
    // Staff don't see the checklist or the numbers, so skip those queries.
    canEdit ? getSetupFacts(claims, workspace.id) : null,
    listBookingsForDay(claims, workspace.id, today, workspace.timezone),
    countWaiting(claims, workspace.id),
    listConversations(claims, workspace.id, { filter: "all", q: "" }),
    canEdit
      ? getAnalytics(claims, workspace.id, {
          from: addDays(today, -6),
          to: today,
          timeZone: workspace.timezone,
        })
      : null,
  ]);
  const checklist = facts ? setupChecklist(workspace.slug, facts) : null;
  const upcoming = bookings.filter((booking) => booking.status !== "cancelled");
  const now = new Date();
  const time = (at: Date) =>
    format(new TZDate(at, workspace.timezone), "h:mm a");
  const base = `/w/${workspace.slug}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <p className="text-sm text-muted-foreground">
        {format(new TZDate(now, workspace.timezone), "EEEE, MMMM d")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
        Welcome to {workspace.name}
      </h1>

      {checklist && checklist.doneCount < checklist.total ? (
        <div className="mt-8">
          <SetupChecklist {...checklist} />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Waiting for a person"
          value={waiting}
          href={`${base}/inbox?status=needs_human`}
          icon={<UserRoundPlus className="size-4" />}
          highlight={waiting > 0}
        />
        <Stat
          label="Appointments today"
          value={upcoming.length}
          href={`${base}/calendar`}
          icon={<CalendarDays className="size-4" />}
        />
        {week ? (
          <>
            <Stat
              label="Chats this week"
              value={week.summary.conversations}
              href={`${base}/analytics?days=7`}
              icon={<MessageCircle className="size-4" />}
            />
            <Stat
              label="Booked by the AI this week"
              value={week.summary.aiBookings}
              href={`${base}/analytics?days=7`}
              icon={<Sparkles className="size-4" />}
            />
          </>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Today's appointments"
          href={`${base}/calendar`}
          linkLabel="Open calendar"
        >
          {upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nothing booked today.
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 7).map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center gap-4 px-5 py-3"
                >
                  <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
                    {time(booking.startsAt)}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-8 w-1 shrink-0 rounded-full",
                      booking.endsAt < now ? "bg-border" : "bg-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {booking.customerName ?? "Customer"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {booking.serviceName} with {booking.staffName}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent conversations"
          href={`${base}/inbox`}
          linkLabel="Open inbox"
        >
          {chats.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No chats yet. They appear here once the widget is on your website.
            </p>
          ) : (
            <ul className="divide-y">
              {chats.rows.slice(0, 6).map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={`${base}/inbox/${chat.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Inbox aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {chat.visitor ?? "Website visitor"}
                        </span>
                        {chat.status === "needs_human" ? (
                          <Badge variant="destructive">
                            {STATUS_LABEL[chat.status]}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {chat.preview || "No messages yet"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceStrict(chat.lastMessageAt, now, {
                        addSuffix: true,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {checklist && checklist.doneCount === checklist.total ? (
        <div className="mt-6">
          <SetupChecklist {...checklist} />
        </div>
      ) : null}
    </div>
  );
}

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { listEmails } from "@/features/emails/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Emails" };

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  not_sent: "Not sent",
};

export default async function EmailsPage({
  params,
}: PageProps<"/w/[slug]/emails">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const emails = await listEmails(claims, workspace.id);
  const demo = workspace.demoExpiresAt !== null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Emails
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {demo
          ? "Every email the demo would have sent: booking confirmations, reminders, replies and alerts. Nothing here reaches a real inbox."
          : "Every email FrontDesk AI sent for this workspace, or would have sent if email isn't set up yet."}
      </p>

      {emails.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No emails yet. Booking confirmations and alerts appear here.
        </p>
      ) : (
        <ul aria-label="Emails" className="mt-8 divide-y rounded-xl border">
          {emails.map((email) => (
            <li key={email.id}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-start gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-medium">{email.subject}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      To {email.to}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        email.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {STATUS_LABEL[email.status] ?? email.status}
                    </Badge>
                    <time
                      dateTime={email.createdAt.toISOString()}
                      className="text-xs text-muted-foreground"
                    >
                      {format(
                        new TZDate(email.createdAt, workspace.timezone),
                        "MMM d, h:mm a",
                      )}
                    </time>
                  </div>
                </summary>
                <pre className="mt-3 rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">
                  {email.text}
                </pre>
                {email.error ? (
                  <p className="mt-2 text-sm text-destructive">{email.error}</p>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

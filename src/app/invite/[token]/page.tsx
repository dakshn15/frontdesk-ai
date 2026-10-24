import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { roleLabels, teamErrorMessage } from "@/features/team/messages";
import { getInvitePreview } from "@/features/team/queries";
import { getAuthClaims } from "@/lib/auth/session";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join a workspace" };

const STATUS_CODES = {
  accepted: "invite_used",
  revoked: "invite_revoked",
  expired: "invite_expired",
} as const;

function Unavailable({ code }: { code: string }) {
  return (
    <AuthShell
      title="Invite not available"
      description={teamErrorMessage(code)}
    >
      <Link
        href="/"
        className={buttonVariants({
          variant: "outline",
          className: "h-10 w-full",
        })}
      >
        Go to FrontDesk AI
      </Link>
    </AuthShell>
  );
}

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const claims = await getAuthClaims();
  const preview = await getInvitePreview(claims, token);

  if (!preview) return <Unavailable code="invite_not_found" />;
  if (preview.status !== "pending") {
    return <Unavailable code={STATUS_CODES[preview.status]} />;
  }

  const invitePath = `/invite/${token}`;
  const role = roleLabels[preview.role];
  const intro = preview.inviterName
    ? `${preview.inviterName} invited you to join ${preview.workspaceName} as ${role}.`
    : `You've been invited to join ${preview.workspaceName} as ${role}.`;
  const sameEmail =
    claims?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <AuthShell title={`Join ${preview.workspaceName}`} description={intro}>
      {!claims ? (
        <div className="grid gap-3">
          <p className="text-sm">This invite is for {preview.email}.</p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(invitePath)}`}
            className={buttonVariants({ className: "h-10 w-full" })}
          >
            Sign in to accept
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(invitePath)}`}
            className={buttonVariants({
              variant: "outline",
              className: "h-10 w-full",
            })}
          >
            Create an account
          </Link>
        </div>
      ) : sameEmail ? (
        <AcceptForm token={token} />
      ) : (
        <div className="grid gap-4">
          <p className="text-sm">
            {teamErrorMessage("invite_email_mismatch", {
              email: preview.email,
            })}
          </p>
          <form action="/auth/sign-out" method="post">
            <input type="hidden" name="next" value={invitePath} />
            <button
              type="submit"
              className={buttonVariants({
                variant: "outline",
                className: "h-10 w-full",
              })}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}

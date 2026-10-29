import type { Metadata } from "next";
import { listMembers, listPendingInvites } from "@/features/team/queries";
import { canManageTeam } from "@/features/workspaces/permissions";
import { requireMembership } from "@/lib/auth/session";
import { InviteDialog } from "./invite-dialog";
import { MembersList } from "./members-list";
import { PendingInvites } from "./pending-invites";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({
  params,
}: PageProps<"/w/[slug]/team">) {
  const { slug } = await params;
  const { claims, membership } = await requireMembership(slug);
  const { workspace, role } = membership;
  const manages = canManageTeam(role);
  const [members, invites] = await Promise.all([
    listMembers(claims, workspace.id),
    manages ? listPendingInvites(claims, workspace.id) : Promise.resolve([]),
  ]);

  // Dates are formatted here, in the workspace's time zone, so server and browser agree.
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: workspace.timezone,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Team
        </h1>
        {manages ? <InviteDialog slug={workspace.slug} /> : null}
      </div>

      <section className="mt-8" aria-labelledby="members-heading">
        <h2 id="members-heading" className="sr-only">
          Members
        </h2>
        <MembersList
          slug={workspace.slug}
          workspaceName={workspace.name}
          me={{ userId: claims.sub, role }}
          members={members.map((member) => ({
            membershipId: member.membershipId,
            userId: member.userId,
            fullName: member.fullName,
            email: member.email,
            role: member.role,
            joined: date.format(member.joinedAt),
          }))}
        />
      </section>

      {invites.length > 0 ? (
        <section className="mt-10" aria-labelledby="invites-heading">
          <h2 id="invites-heading" className="mb-4 text-lg font-semibold">
            Pending invites
          </h2>
          <PendingInvites
            slug={workspace.slug}
            invites={invites.map((invite) => ({
              id: invite.id,
              email: invite.email,
              role: invite.role,
              expires: date.format(invite.expiresAt),
              expired: invite.status === "expired",
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}

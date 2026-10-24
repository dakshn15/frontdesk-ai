"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "@/features/team/actions";
import { roleLabels } from "@/features/team/messages";

export type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "staff";
  expires: string;
  expired: boolean;
};

export function PendingInvites({
  slug,
  invites,
}: {
  slug: string;
  invites: InviteRow[];
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {invites.map((invite) => (
        <li
          key={invite.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
        >
          <div className="min-w-0 flex-1 basis-56">
            <p className="truncate font-medium">{invite.email}</p>
            <p className="text-sm text-muted-foreground">
              {roleLabels[invite.role]},{" "}
              {invite.expired ? "expired" : `expires ${invite.expires}`}
            </p>
          </div>
          <RevokeButton slug={slug} inviteId={invite.id} />
        </li>
      ))}
    </ul>
  );
}

function RevokeButton({ slug, inviteId }: { slug: string; inviteId: string }) {
  const { state, onSubmit, pending } = useActionForm(
    revokeInvite.bind(null, slug),
  );
  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-9"
        disabled={pending}
      >
        Revoke
      </Button>
    </form>
  );
}

"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceRole } from "@/db/schema/enums";
import { changeMemberRole, removeMember } from "@/features/team/actions";
import { roleLabels } from "@/features/team/messages";
import {
  canChangeRole,
  canRemoveMember,
} from "@/features/workspaces/permissions";

export type MemberRow = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  joined: string;
};

const ROLES: WorkspaceRole[] = ["owner", "admin", "staff"];

export function MembersList({
  slug,
  workspaceName,
  members,
  me,
}: {
  slug: string;
  workspaceName: string;
  members: MemberRow[];
  me: { userId: string; role: WorkspaceRole };
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {members.map((member) => {
        const isSelf = member.userId === me.userId;
        const roleChoices = ROLES.filter(
          (role) =>
            role === member.role || canChangeRole(me.role, member.role, role),
        );
        return (
          <li
            key={member.membershipId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-medium">
                {member.fullName || member.email}
                {isSelf ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (you)
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {member.fullName ? `${member.email}, ` : ""}joined{" "}
                {member.joined}
              </p>
            </div>
            {roleChoices.length > 1 && !isSelf ? (
              <RoleSelect slug={slug} member={member} choices={roleChoices} />
            ) : (
              <Badge variant="secondary">{roleLabels[member.role]}</Badge>
            )}
            {canRemoveMember(me.role, member.role, isSelf) ? (
              <RemoveButton
                slug={slug}
                member={member}
                isSelf={isSelf}
                workspaceName={workspaceName}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RoleSelect({
  slug,
  member,
  choices,
}: {
  slug: string;
  member: MemberRow;
  choices: WorkspaceRole[];
}) {
  const [state, dispatch, pending] = useActionState(
    changeMemberRole.bind(null, slug),
    null,
  );
  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
    if (state?.ok) toast.success("Role updated.");
  }, [state]);

  return (
    <select
      aria-label={`Role for ${member.fullName || member.email}`}
      defaultValue={member.role}
      disabled={pending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("membershipId", member.membershipId);
        formData.set("role", event.currentTarget.value);
        startTransition(() => dispatch(formData));
      }}
      className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {choices.map((role) => (
        <option key={role} value={role}>
          {roleLabels[role]}
        </option>
      ))}
    </select>
  );
}

function RemoveButton({
  slug,
  member,
  isSelf,
  workspaceName,
}: {
  slug: string;
  member: MemberRow;
  isSelf: boolean;
  workspaceName: string;
}) {
  const { onSubmit, pending, formError } = useActionForm(
    removeMember.bind(null, slug),
  );
  const name = member.fullName || member.email;
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="h-9" />}
      >
        {isSelf ? "Leave workspace" : "Remove"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input
            type="hidden"
            name="membershipId"
            value={member.membershipId}
          />
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSelf ? `Leave ${workspaceName}?` : `Remove ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSelf
                ? "You'll need a new invite to come back."
                : "They'll lose access right away."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {isSelf ? "Leave workspace" : "Remove from workspace"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

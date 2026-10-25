"use client";

import { Copy, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMember } from "@/features/team/actions";

export function InviteDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  // A new key each time it opens gives a fresh, empty form.
  const [session, setSession] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((count) => count + 1);
      }}
    >
      <DialogTrigger render={<Button className="h-9 px-3" />}>
        <UserPlus />
        Invite teammate
      </DialogTrigger>
      <DialogContent>
        <InviteForm key={session} slug={slug} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    inviteMember.bind(null, slug),
  );

  if (state?.ok) {
    const { inviteUrl, email } = state.data;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invite link ready</DialogTitle>
          <DialogDescription>
            Send this link to {email}. It works once and expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-link">Invite link</Label>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              readOnly
              value={inviteUrl}
              className="h-10"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast.success("Link copied.");
              }}
            >
              <Copy />
              Copy link
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>
          You&apos;ll get a link to send them. They join when they open it and
          sign in with this email.
        </DialogDescription>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="off"
        required
        errors={fieldErrors?.email}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="staff"
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Admins can change settings and manage the team. Staff can see the team
          and take over chats.
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Create invite link
        </Button>
      </DialogFooter>
    </form>
  );
}

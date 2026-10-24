"use client";

import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/features/team/actions";

export function AcceptForm({ token }: { token: string }) {
  const { onSubmit, pending, formError } = useActionForm(
    acceptInvite.bind(null, token),
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Button type="submit" className="h-10" disabled={pending}>
        Accept and join
      </Button>
    </form>
  );
}

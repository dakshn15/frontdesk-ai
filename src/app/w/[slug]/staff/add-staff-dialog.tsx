"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStaff } from "@/features/staff/actions";

/** Creating a staff member goes straight to their page. */
export function AddStaffDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  // A new key each time it opens gives a fresh form.
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
        <Plus />
        Add staff member
      </DialogTrigger>
      <DialogContent>
        <AddStaffForm key={session} slug={slug} />
      </DialogContent>
    </Dialog>
  );
}

function AddStaffForm({ slug }: { slug: string }) {
  const { onSubmit, pending, fieldErrors, formError } = useActionForm(
    createStaff.bind(null, slug),
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Add a staff member</DialogTitle>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field label="Name" name="name" required errors={fieldErrors?.name} />
      <Field
        label="Job title (optional)"
        name="title"
        placeholder="Senior stylist"
        errors={fieldErrors?.title}
      />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Add staff member
        </Button>
      </DialogFooter>
    </form>
  );
}

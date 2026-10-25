"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deletePolicy, savePolicy } from "@/features/policies/actions";

type CustomPolicy = { id: string; title: string; body: string };

export function CustomPolicies({
  slug,
  policies,
}: {
  slug: string;
  policies: CustomPolicy[];
}) {
  if (policies.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No custom policies yet.
      </p>
    );
  }
  return (
    <ul aria-label="Custom policies" className="divide-y rounded-xl border">
      {policies.map((policy) => (
        <li
          key={policy.id}
          className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
        >
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-medium">{policy.title}</p>
            <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">
              {policy.body}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <CustomPolicyDialog slug={slug} policy={policy} />
            <DeletePolicyButton slug={slug} policy={policy} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Add a policy", or "Edit" on a row when `policy` is given. */
export function CustomPolicyDialog({
  slug,
  policy,
}: {
  slug: string;
  policy?: CustomPolicy;
}) {
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
      {policy ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              aria-label={`Edit ${policy.title}`}
            />
          }
        >
          <Pencil />
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9 px-3" />}>
          <Plus />
          Add a policy
        </DialogTrigger>
      )}
      <DialogContent>
        <CustomPolicyForm
          key={session}
          slug={slug}
          policy={policy}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomPolicyForm({
  slug,
  policy,
  onDone,
}: {
  slug: string;
  policy?: CustomPolicy;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    savePolicy.bind(null, slug),
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success("Saved.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{policy ? "Edit policy" : "Add a policy"}</DialogTitle>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="kind" value="custom" />
      <input type="hidden" name="id" value={policy?.id ?? ""} />
      <Field
        label="Title"
        name="title"
        placeholder="Children"
        defaultValue={policy?.title}
        required
        errors={fieldErrors?.title}
      />
      <TextareaField
        label="Policy"
        name="body"
        rows={4}
        placeholder="Children under 12 are welcome with an adult."
        defaultValue={policy?.body}
        required
        errors={fieldErrors?.body}
      />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Save policy
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeletePolicyButton({
  slug,
  policy,
}: {
  slug: string;
  policy: CustomPolicy;
}) {
  const { onSubmit, pending, formError } = useActionForm(
    deletePolicy.bind(null, slug),
  );
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            aria-label={`Delete ${policy.title}`}
          />
        }
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="policyId" value={policy.id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {policy.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The receptionist stops quoting it right away.
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
              Delete
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

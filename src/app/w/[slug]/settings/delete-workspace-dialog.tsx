"use client";

import { Field } from "@/components/forms/field";
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
import { deleteWorkspace } from "@/features/workspaces/actions";

export function DeleteWorkspaceDialog({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const { onSubmit, pending, fieldErrors, formError } = useActionForm(
    deleteWorkspace.bind(null, slug),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Delete workspace
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {name}, its team and everything in it. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError ? (
            <FormMessage tone="error">{formError}</FormMessage>
          ) : null}
          <Field
            label={`Type ${name} to confirm`}
            name="confirmName"
            autoComplete="off"
            errors={fieldErrors?.confirmName}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              Delete workspace
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

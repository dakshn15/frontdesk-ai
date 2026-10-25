"use client";

import { Trash2 } from "lucide-react";
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
import { deleteService } from "@/features/services/actions";

export function DeleteServiceButton({
  slug,
  serviceId,
  name,
}: {
  slug: string;
  serviceId: string;
  name: string;
}) {
  const { onSubmit, pending, formError } = useActionForm(
    deleteService.bind(null, slug),
  );
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            aria-label={`Delete ${name}`}
          />
        }
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="serviceId" value={serviceId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Staff who perform it will be unlinked.
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

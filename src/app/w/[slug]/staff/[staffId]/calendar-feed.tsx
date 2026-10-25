"use client";

import { Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetCalendarFeed } from "@/features/staff/actions";

/** The private feed link, with copy and reset. */
export function CalendarFeed({
  slug,
  staffId,
  url,
}: {
  slug: string;
  staffId: string;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  return (
    <div className="grid max-w-xl gap-3">
      <Input
        readOnly
        value={url}
        aria-label="Calendar feed link"
        className="h-10 font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-9 px-3" onClick={copy}>
          <Copy />
          Copy link
        </Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button variant="outline" className="h-9 px-3" />}
          >
            Reset link
          </AlertDialogTrigger>
          <AlertDialogContent>
            <ResetForm slug={slug} staffId={staffId} onDone={close} />
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ResetForm({
  slug,
  staffId,
  onDone,
}: {
  slug: string;
  staffId: string;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, formError } = useActionForm(
    resetCalendarFeed.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("New link made. The old one no longer works.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="staffId" value={staffId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Reset the calendar link?</AlertDialogTitle>
        <AlertDialogDescription>
          Calendars using the old link stop updating. Subscribe again with the
          new one.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button type="submit" disabled={pending}>
          Reset link
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

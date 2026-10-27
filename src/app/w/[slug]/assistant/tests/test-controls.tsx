"use client";

import { Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
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
import { deleteTest, runTests } from "@/features/testlab/actions";

/** Starts a run of every test and opens its results page. */
export function RunTestsButton({
  slug,
  disabled,
}: {
  slug: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      const result = await runTests(slug);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/w/${slug}/assistant/runs/${result.data.runId}`);
    });
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 px-3"
      onClick={run}
      disabled={disabled || pending}
    >
      <Play />
      {pending ? "Starting…" : "Run all tests"}
    </Button>
  );
}

export function DeleteTestDialog({
  slug,
  testId,
  question,
}: {
  slug: string;
  testId: string;
  question: string;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            aria-label={`Delete test: ${question}`}
          />
        }
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <DeleteTestForm
          slug={slug}
          testId={testId}
          question={question}
          onDone={close}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteTestForm({
  slug,
  testId,
  question,
  onDone,
}: {
  slug: string;
  testId: string;
  question: string;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, formError } = useActionForm(
    deleteTest.bind(null, slug),
  );
  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Test deleted.");
    onDone();
  }, [state, onDone]);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="testId" value={testId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this test?</AlertDialogTitle>
        <AlertDialogDescription>
          &ldquo;{question}&rdquo; won&apos;t run any more. Past results stay in
          the run history.
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
          Delete test
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

/** While a run is going, check for new results every couple of seconds. */
export function RefreshWhileRunning({ running }: { running: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [running, router]);
  return null;
}

"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TextareaField } from "@/components/forms/field";
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
import { saveAnswer } from "@/features/answers/actions";

type Answer = { id: string; question: string; answer: string };

/** "Add answer", or "Edit" on a row when `answer` is given. */
export function AnswerDialog({
  slug,
  answer,
}: {
  slug: string;
  answer?: Answer;
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
      {answer ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              aria-label={`Edit answer: ${answer.question}`}
            />
          }
        >
          <Pencil />
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9 px-3" />}>
          <Plus />
          Add answer
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <AnswerForm
          key={session}
          slug={slug}
          answer={answer}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AnswerForm({
  slug,
  answer,
  onDone,
}: {
  slug: string;
  answer?: Answer;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveAnswer.bind(null, slug),
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
        <DialogTitle>{answer ? "Edit answer" : "Add an answer"}</DialogTitle>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="answerId" value={answer?.id ?? ""} />
      <TextareaField
        label="Question"
        name="question"
        rows={2}
        placeholder="Do you do bridal hair?"
        defaultValue={answer?.question}
        required
        errors={fieldErrors?.question}
      />
      <TextareaField
        label="Answer"
        name="answer"
        rows={5}
        defaultValue={answer?.answer}
        required
        errors={fieldErrors?.answer}
      />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Save answer
        </Button>
      </DialogFooter>
    </form>
  );
}

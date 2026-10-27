"use client";

import { Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TextareaField } from "@/components/forms/field";
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
import { saveAnswer } from "@/features/answers/actions";

/** Turns a reply into a verified answer, which the receptionist checks before anything else. */
export function FixAnswerDialog({
  slug,
  question,
  answer,
}: {
  slug: string;
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="h-8" />}
      >
        <Wrench />
        Fix this answer
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <FixForm
            slug={slug}
            question={question}
            answer={answer}
            onDone={close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FixForm({
  slug,
  question,
  answer,
  onDone,
}: {
  slug: string;
  question: string;
  answer: string;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveAnswer.bind(null, slug),
  );
  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Saved as a verified answer.");
    onDone();
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Fix this answer</DialogTitle>
        <DialogDescription>
          Write the answer you want. It&apos;s saved as a verified answer, and
          the receptionist uses it whenever someone asks this.
        </DialogDescription>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="answerId" value="" />
      <TextareaField
        label="Question"
        name="question"
        rows={2}
        defaultValue={question}
        errors={fieldErrors?.question}
      />
      <TextareaField
        label="Answer"
        name="answer"
        rows={5}
        defaultValue={answer}
        errors={fieldErrors?.answer}
      />
      <DialogFooter>
        <Button type="submit" className="h-10 px-4" disabled={pending}>
          Save verified answer
        </Button>
      </DialogFooter>
    </form>
  );
}

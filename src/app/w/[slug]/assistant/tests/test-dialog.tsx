"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckboxField,
  SelectField,
  TextareaField,
} from "@/components/forms/field";
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
import type { TestChecks } from "@/db/schema/testlab";
import { TOOL_LABEL } from "@/features/inbox/constants";
import { saveTest } from "@/features/testlab/actions";

export type SavedTest = {
  id: string;
  question: string;
  checks: TestChecks;
  mustPass: boolean;
};

/** "Add test", "Edit" on a saved test, or "Add as test" with a question from a real chat. */
export function TestDialog({
  slug,
  test,
  question,
}: {
  slug: string;
  test?: SavedTest;
  question?: string;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {test ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              aria-label={`Edit test: ${test.question}`}
            />
          }
        >
          <Pencil />
          Edit
        </DialogTrigger>
      ) : question ? (
        <DialogTrigger
          render={<Button variant="outline" size="sm" className="h-8" />}
        >
          <Plus />
          Add as test
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9 px-3" />}>
          <Plus />
          Add test
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open ? (
          <TestForm
            slug={slug}
            test={test}
            question={question}
            onDone={close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TestForm({
  slug,
  test,
  question,
  onDone,
}: {
  slug: string;
  test?: SavedTest;
  question?: string;
  onDone: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveTest.bind(null, slug),
  );
  useEffect(() => {
    if (!state?.ok) return;
    toast.success(test ? "Test saved." : "Test added.");
    onDone();
  }, [state, onDone, test]);
  const checks = test?.checks ?? {};
  const checksError = fieldErrors?.checks?.[0];

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{test ? "Edit test" : "Add test"}</DialogTitle>
        <DialogDescription>
          A question a customer might ask, and what a good answer does. Use as
          many checks as you need.
        </DialogDescription>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      {checksError ? (
        <FormMessage tone="error">{checksError}</FormMessage>
      ) : null}
      <input type="hidden" name="testId" value={test?.id ?? ""} />
      <TextareaField
        label="Question"
        name="question"
        rows={2}
        maxLength={500}
        defaultValue={test?.question ?? question ?? ""}
        errors={fieldErrors?.question}
      />
      <SelectField
        label="Must use"
        name="mustUseTool"
        defaultValue={checks.mustUseTool ?? ""}
        errors={fieldErrors?.mustUseTool}
      >
        <option value="">Any tool, or none</option>
        {Object.entries(TOOL_LABEL).map(([name, label]) => (
          <option key={name} value={name}>
            {label} ({name})
          </option>
        ))}
      </SelectField>
      <TextareaField
        label="Must mention"
        name="mustContain"
        rows={2}
        defaultValue={(checks.mustContain ?? []).join("\n")}
        hint="One phrase per line, like $195. Capital letters don't matter."
        errors={fieldErrors?.mustContain}
      />
      <TextareaField
        label="Must not mention"
        name="mustNotContain"
        rows={2}
        defaultValue={(checks.mustNotContain ?? []).join("\n")}
        hint="One phrase per line."
        errors={fieldErrors?.mustNotContain}
      />
      <div className="grid gap-2">
        <CheckboxField
          label="Must say it isn't sure"
          name="mustSayNotSure"
          defaultChecked={checks.mustSayNotSure}
        />
        <CheckboxField
          label="Must hand the chat to the team"
          name="mustHandOff"
          defaultChecked={checks.mustHandOff}
        />
      </div>
      <TextareaField
        label="Expected answer (optional)"
        name="expectedAnswer"
        rows={3}
        maxLength={1000}
        defaultValue={checks.expectedAnswer ?? ""}
        hint="An AI grader checks the answer means the same thing. It needs an AI key."
        errors={fieldErrors?.expectedAnswer}
      />
      <CheckboxField
        label="Must pass: an answer you can't afford to get wrong"
        name="mustPass"
        defaultChecked={test?.mustPass}
      />
      <DialogFooter>
        <Button type="submit" className="h-10 px-4" disabled={pending}>
          {test ? "Save test" : "Add test"}
        </Button>
      </DialogFooter>
    </form>
  );
}

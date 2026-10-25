"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deletePolicy, savePolicy } from "@/features/policies/actions";
import type { StandardPolicyKind } from "@/features/policies/schemas";

/** One standard policy: write it and save, or clear it when it doesn't apply. */
export function PolicyCard({
  slug,
  kind,
  title,
  placeholder,
  policy,
}: {
  slug: string;
  kind: StandardPolicyKind;
  title: string;
  placeholder: string;
  policy?: { id: string; body: string };
}) {
  const save = useActionForm(savePolicy.bind(null, slug));
  const clear = useActionForm(deletePolicy.bind(null, slug));

  useEffect(() => {
    if (save.state?.ok) toast.success("Saved.");
  }, [save.state]);
  useEffect(() => {
    if (clear.state?.ok) toast.success("Cleared.");
  }, [clear.state]);

  const fieldId = `policy-${kind}`;
  const clearFormId = `${fieldId}-clear`;
  const errors = save.fieldErrors?.body;
  const formError = save.formError ?? clear.formError;

  return (
    <div className="rounded-xl border p-4">
      <form onSubmit={save.onSubmit} className="grid gap-3" noValidate>
        <input type="hidden" name="kind" value={kind} />
        <Label htmlFor={fieldId} className="text-base font-semibold">
          {title}
        </Label>
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        {/* A new key when the policy is created or cleared resets the text. */}
        <Textarea
          key={policy?.id ?? "empty"}
          id={fieldId}
          name="body"
          rows={3}
          placeholder={placeholder}
          defaultValue={policy?.body}
          aria-invalid={errors ? true : undefined}
          aria-describedby={errors ? `${fieldId}-error` : undefined}
        />
        {errors ? (
          <p id={`${fieldId}-error`} className="text-xs text-destructive">
            {errors[0]}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="submit"
            className="h-9 px-3"
            aria-label={`Save ${title}`}
            disabled={save.pending}
          >
            Save
          </Button>
          {policy ? (
            <Button
              type="submit"
              form={clearFormId}
              variant="ghost"
              className="h-9 px-3"
              aria-label={`Clear ${title}`}
              disabled={clear.pending}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>
      {policy ? (
        <form id={clearFormId} onSubmit={clear.onSubmit} hidden>
          <input type="hidden" name="policyId" value={policy.id} />
        </form>
      ) : null}
    </div>
  );
}

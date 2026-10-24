"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { updatePassword } from "@/features/auth/actions";

export function UpdatePasswordForm() {
  const { onSubmit, pending, fieldErrors, formError } =
    useActionForm(updatePassword);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        required
        errors={fieldErrors?.password}
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors?.confirmPassword}
      />
      <Button type="submit" className="mt-2 h-10" disabled={pending}>
        Save password
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/features/auth/actions";

export function ForgotPasswordForm() {
  const { state, onSubmit, pending, fieldErrors, formError } =
    useActionForm(requestPasswordReset);

  return (
    <>
      {state?.ok ? (
        <FormMessage tone="success">
          If there&apos;s an account for that email, we&apos;ve sent a reset
          link.
        </FormMessage>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {formError ? (
            <FormMessage tone="error">{formError}</FormMessage>
          ) : null}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            errors={fieldErrors?.email}
          />
          <Button type="submit" className="mt-2 h-10" disabled={pending}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

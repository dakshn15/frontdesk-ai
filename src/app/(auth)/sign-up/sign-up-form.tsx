"use client";

import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { signUp } from "@/features/auth/actions";

export function SignUpForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } =
    useActionForm(signUp);
  const signInHref = next
    ? `/sign-in?next=${encodeURIComponent(next)}`
    : "/sign-in";

  if (state?.ok) {
    return (
      <FormMessage tone="success">
        Check your inbox. We sent a link to confirm your email.
      </FormMessage>
    );
  }

  return (
    <>
      {googleEnabled ? (
        <>
          <GoogleButton next={next ?? "/dashboard"} />
          <OrDivider />
        </>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
          errors={fieldErrors?.fullName}
        />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          required
          errors={fieldErrors?.password}
        />
        <Button type="submit" className="mt-2 h-10" disabled={pending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={signInHref} className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </>
  );
}

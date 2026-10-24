"use client";

import Link from "next/link";
import { useRef } from "react";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { resendConfirmation, signIn } from "@/features/auth/actions";
import { EMAIL_NOT_CONFIRMED } from "@/features/auth/schemas";

export function SignInForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } =
    useActionForm(signIn);
  const resend = useActionForm(resendConfirmation);
  const emailRef = useRef<HTMLInputElement>(null);
  const unconfirmed = state && !state.ok && state.code === EMAIL_NOT_CONFIRMED;
  const signUpHref = next
    ? `/sign-up?next=${encodeURIComponent(next)}`
    : "/sign-up";

  return (
    <>
      {googleEnabled ? (
        <>
          <GoogleButton next={next ?? "/dashboard"} />
          <OrDivider />
        </>
      ) : null}
      {unconfirmed ? (
        <form
          onSubmit={(event) => {
            const email = event.currentTarget.elements.namedItem("email");
            if (email instanceof HTMLInputElement) {
              email.value = emailRef.current?.value ?? "";
            }
            resend.onSubmit(event);
          }}
          className="mb-4 grid gap-2"
        >
          <FormMessage tone="error">Confirm your email first.</FormMessage>
          <input type="hidden" name="email" />
          <input type="hidden" name="next" value={next ?? ""} />
          {resend.state?.ok ? (
            <FormMessage tone="success">We sent a new link.</FormMessage>
          ) : (
            <Button type="submit" variant="outline" disabled={resend.pending}>
              Send the link again
            </Button>
          )}
        </form>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {formError && !unconfirmed ? (
          <FormMessage tone="error">{formError}</FormMessage>
        ) : null}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          ref={emailRef}
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          errors={fieldErrors?.email}
        />
        <div className="grid gap-1.5">
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errors={fieldErrors?.password}
          />
          <Link
            href="/forgot-password"
            className="justify-self-end text-xs font-medium text-primary"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="mt-2 h-10" disabled={pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href={signUpHref} className="font-medium text-primary">
          Create an account
        </Link>
      </p>
    </>
  );
}

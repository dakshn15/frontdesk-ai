"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import type { FormState } from "@/lib/action-result";

/**
 * Runs a server action from a form's submit event. React resets a form that uses the
 * `action` prop after every submit, which would wipe what someone typed when the server
 * sends back errors; submitting through `onSubmit` keeps the values.
 */
export function useActionForm<T = undefined>(
  action: (state: FormState<T>, formData: FormData) => Promise<FormState<T>>,
) {
  const [state, dispatch, pending] = useActionState(action, null);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Include the clicked button's name and value, as a normal submit would.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  // A form-level error is shown only when no single field explains the failure.
  const formError =
    state && !state.ok && !fieldErrors ? state.error : undefined;
  return { state, onSubmit, pending, fieldErrors, formError };
}

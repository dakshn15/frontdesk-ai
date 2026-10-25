/** What every server action returns. Expected failures come back as data, not exceptions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      /** A stable name for failures the form handles specially. */
      code?: string;
    };

/** `useActionState` starts from null, before the form is first submitted. */
export type FormState<T = undefined> = ActionResult<T> | null;

export function ok<T = undefined>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
  code?: string,
): ActionResult<never> {
  return { ok: false, error, fieldErrors, code };
}

/** Shared form messages. */
export const CHECK_FIELDS = "Check the highlighted fields.";
export const NOT_ALLOWED = "You don't have permission to do that.";

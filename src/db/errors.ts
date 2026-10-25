export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_CHECK_VIOLATION = "23514";
export const PG_INSUFFICIENT_PRIVILEGE = "42501";
// `raise exception '<name>'` in our SQL functions uses this code, with the name as the message.
export const PG_RAISE = "P0001";

export type PgError = { code: string; message: string };

function asPgError(value: unknown): PgError | null {
  if (typeof value !== "object" || value === null) return null;
  const { code, message } = value as { code?: unknown; message?: unknown };
  if (
    typeof code === "string" &&
    code.length === 5 &&
    typeof message === "string"
  ) {
    return { code, message };
  }
  return null;
}

// Drizzle wraps driver errors in its own error with the original as `cause`.
export function getPgError(err: unknown): PgError | null {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    const found = asPgError(current);
    if (found) return found;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

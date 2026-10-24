import { z } from "zod";

/** The failure code sign-in returns when the account's email isn't confirmed yet. */
export const EMAIL_NOT_CONFIRMED = "email_not_confirmed";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

const newPassword = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  // bcrypt, which Supabase Auth uses, ignores anything past 72 bytes.
  .max(72, { error: "Use 72 characters or fewer." });

const next = z.string().optional();

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Enter your name." })
    .max(80, { error: "Use 80 characters or fewer." }),
  email,
  password: newPassword,
  next,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
  next,
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords don't match.",
  });

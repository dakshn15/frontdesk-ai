import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireUser } from "@/lib/auth/session";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function UpdatePasswordPage() {
  await requireUser("/account/update-password");
  return (
    <AuthShell title="Choose a new password">
      <UpdatePasswordForm />
    </AuthShell>
  );
}

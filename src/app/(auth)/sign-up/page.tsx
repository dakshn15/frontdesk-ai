import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { clientEnv } from "@/env/client";
import { firstParam } from "@/lib/search-params";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const next = firstParam((await searchParams).next);
  return (
    <AuthShell
      title="Create your account"
      description="Set up your business, then add your team."
    >
      <SignUpForm
        next={next}
        googleEnabled={clientEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}
      />
    </AuthShell>
  );
}

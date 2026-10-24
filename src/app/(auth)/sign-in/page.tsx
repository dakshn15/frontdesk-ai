import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { clientEnv } from "@/env/client";
import { firstParam } from "@/lib/search-params";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const next = firstParam((await searchParams).next);
  return (
    <AuthShell title="Sign in">
      <SignInForm
        next={next}
        googleEnabled={clientEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}
      />
    </AuthShell>
  );
}

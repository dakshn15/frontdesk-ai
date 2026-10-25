import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign-in problem" };

const messages: Record<string, string> = {
  link: "That link has expired or was already used. Request a new one.",
  callback:
    "We couldn't finish signing you in. If you opened a link from an email, open it in the same browser you signed up in, or request a new one.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const { reason } = await searchParams;
  const message =
    (typeof reason === "string" && messages[reason]) ||
    "Something went wrong signing you in.";
  return (
    <AuthShell title="We couldn't sign you in" description={message}>
      <Link
        href="/sign-in"
        className={buttonVariants({ className: "h-10 w-full" })}
      >
        Go to sign in
      </Link>
    </AuthShell>
  );
}

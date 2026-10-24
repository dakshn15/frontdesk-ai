import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign-in problem" };

const messages: Record<string, string> = {
  link: "That link has expired or was already used. Request a new one.",
  oauth: "Google sign-in didn't finish. Try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const { reason } = await searchParams;
  const message =
    (typeof reason === "string" && messages[reason]) ||
    "Something went wrong signing you in.";
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8 rounded-lg">
        <Logo />
      </Link>
      <main className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          We couldn&apos;t sign you in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          href="/sign-in"
          className={buttonVariants({ className: "mt-6 w-full" })}
        >
          Go to sign in
        </Link>
      </main>
    </div>
  );
}

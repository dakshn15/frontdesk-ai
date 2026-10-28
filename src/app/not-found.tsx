import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link may be old, or you may not have access to it with this account.
      </p>
      <Link
        href="/dashboard"
        className={buttonVariants({ className: "mt-6 w-fit px-4" })}
      >
        Go to your dashboard
      </Link>
    </main>
  );
}

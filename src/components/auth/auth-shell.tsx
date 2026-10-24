import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** The centred single-column frame used by sign-in, sign-up and the other account screens. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-10 rounded-lg">
        <Logo />
      </Link>
      <main className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

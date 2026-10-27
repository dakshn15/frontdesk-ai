import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { ExampleConversation } from "./example-conversation";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "ghost" })}
          >
            Sign in
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div className="max-w-xl">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl">
            The AI front desk that never guesses.
          </h1>
          <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            FrontDesk AI answers your customers from your own business data,
            books appointments into your real calendar, and hands the chat to
            your team when it isn&apos;t sure.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className={buttonVariants({ size: "lg", className: "px-4" })}
            >
              Create your workspace
            </Link>
            <Link
              href="/demo"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "px-4",
              })}
            >
              Try the live demo
            </Link>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <ExampleConversation />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
        © 2026 FrontDesk AI · A portfolio project by Daksh Nimavat
      </footer>
    </div>
  );
}

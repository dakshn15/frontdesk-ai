import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { clientEnv } from "@/env/client";
import { getAuthClaims } from "@/lib/auth/session";
import { liveSandboxSlug } from "@/privileged/demo/sandboxes";
import { StartDemo } from "./start-demo";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Try FrontDesk AI on a private copy of a salon: chat as a customer, then run the front desk.",
};

const STEPS = [
  "Ask the salon's receptionist anything a customer would, or book an appointment in the chat.",
  "Open the dashboard and watch the booking land in the calendar and the chat in the inbox.",
  "Take a chat over from the AI, change a price, or add an answer. It's your copy.",
];

export default async function DemoPage() {
  const claims = await getAuthClaims();
  const guest = claims?.is_anonymous === true;
  const existing = guest && claims ? await liveSandboxSlug(claims.sub) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 md:py-20">
        <h1 className="text-4xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
          Run the front desk of a real-looking salon.
        </h1>
        <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          You get your own private copy of Bloom Hair & Beauty, a sample salon
          in Austin, with its website, receptionist and dashboard already full
          of bookings and chats. No sign-up. It&apos;s deleted after 24 hours.
        </p>
        <ol className="mt-8 grid gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm sm:text-base">
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-10">
          {claims && !guest ? (
            <div className="grid gap-3 rounded-xl border p-4 text-sm">
              <p>
                You&apos;re signed in to your account. The demo uses a separate
                guest session, so sign out first.
              </p>
              <form action="/auth/sign-out" method="post">
                <input type="hidden" name="next" value="/demo" />
                <button
                  type="submit"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : existing ? (
            <Link
              href={`/demo/${existing}`}
              className={buttonVariants({ size: "lg", className: "px-4" })}
            >
              Go back to your demo
            </Link>
          ) : (
            <StartDemo
              turnstileSiteKey={
                clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null
              }
            />
          )}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Emails from the demo go to an in-app outbox, not real inboxes. Please
          don&apos;t enter real customer details.
        </p>
      </main>
    </div>
  );
}

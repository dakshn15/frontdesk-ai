import { BookOpenText, CalendarCheck, Inbox } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  {
    icon: BookOpenText,
    text: "Answers from your services, policies and documents, with the source",
  },
  {
    icon: CalendarCheck,
    text: "Books real times in your calendar, never double-booked",
  },
  {
    icon: Inbox,
    text: "Hands the chat to your team when it isn't sure",
  },
];

/**
 * The frame for sign-in, sign-up and the other account screens: the form on the left, and
 * on wide screens a panel saying what the product does.
 */
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
    <div className="grid min-h-full flex-1 lg:grid-cols-[1fr_minmax(0,34rem)]">
      <div className="flex flex-col px-4 py-8 sm:px-8 sm:py-10">
        <Link href="/" className="w-fit rounded-lg">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          ) : null}
          <div className="mt-8">{children}</div>
        </main>
      </div>
      <aside
        aria-label="About FrontDesk AI"
        className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between"
      >
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/40 blur-3xl"
        />
        <p className="relative max-w-sm text-3xl leading-tight font-semibold tracking-[-0.02em]">
          The AI front desk that never guesses.
        </p>
        <ul className="relative grid gap-5">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background/10">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="text-background/85">{text}</span>
            </li>
          ))}
        </ul>
        <p className="relative text-sm text-background/70">
          Try it first:{" "}
          <Link href="/demo" className="font-medium text-background underline">
            open the live demo
          </Link>
          , no sign-up.
        </p>
      </aside>
    </div>
  );
}

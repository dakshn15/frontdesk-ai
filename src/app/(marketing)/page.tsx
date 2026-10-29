import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  CalendarCheck,
  Code2,
  FlaskConical,
  Inbox,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TestTubeDiagonal,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./product-visual";

const STEPS = [
  {
    title: "Tell it about your business",
    body: "Services and prices, staff and their hours, policies, and the answers you give every day. Add your website, PDFs or price lists and it reads them too.",
  },
  {
    title: "Add one line to your website",
    body: "Paste the script tag before </body>. The chat appears in the corner, in your colours, only on the sites you allow.",
  },
  {
    title: "It answers, books and hands over",
    body: "Customers get answers from your own facts and book real times in your calendar. Anything it isn't sure about goes to your team.",
  },
];

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="max-w-2xl">
        <h2
          id={`${id}-title`}
          className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl"
        >
          {title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {intro}
        </p>
      </div>
      <div className="mt-12">{children}</div>
    </section>
  );
}

function Feature({
  icon,
  title,
  children,
  className,
  visual,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  visual?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border bg-card p-6 sm:p-7",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
      {visual ? <div className="mt-6 flex-1">{visual}</div> : null}
    </div>
  );
}

/** A day of appointments, as the dashboard calendar shows it. */
function MiniCalendar() {
  const rows = [
    ["9:30", "Bridal hair trial", "Maya"],
    ["10:00", "Balayage", "Jordan"],
    ["11:00", "Lash lift and tint", "Sofia"],
  ];
  return (
    <ul aria-hidden className="grid gap-2">
      {rows.map(([time, service, person]) => (
        <li
          key={time}
          className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 text-xs"
        >
          <span className="w-10 font-medium tabular-nums text-muted-foreground">
            {time}
          </span>
          <span className="h-6 w-1 rounded-full bg-primary" />
          <span className="font-medium">{service}</span>
          <span className="ml-auto text-muted-foreground">{person}</span>
        </li>
      ))}
    </ul>
  );
}

/** The answer's source, the part that makes it trustworthy. */
function SourcedAnswer() {
  return (
    <div aria-hidden className="grid gap-2 text-xs">
      <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 leading-relaxed">
        Free guest parking in the lot behind the salon, from Elizabeth Street.
      </p>
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-muted-foreground">
        <BookOpenText className="size-3" />
        Policy: Parking
      </p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <a
              href="#how"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline"
            >
              Features
            </a>
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "ghost",
                className: "px-3",
              })}
            >
              Sign in
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[linear-gradient(to_bottom,var(--primary-soft),transparent)] opacity-70"
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 pt-12 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground shadow-xs">
                <Sparkles aria-hidden className="size-4 text-primary" />
                An AI receptionist for salons, spas and studios
              </p>
              <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.25rem]">
                The AI front desk that never guesses.
              </h1>
              <p className="mt-6 max-w-[56ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
                FrontDesk AI answers your customers from your own business data,
                books appointments into your real calendar, and hands the chat
                to your team when it isn&apos;t sure.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className={buttonVariants({
                    size: "lg",
                    className: "h-11 px-5 text-[15px]",
                  })}
                >
                  Try the live demo
                  <ArrowRight aria-hidden />
                </Link>
                <Link
                  href="/sign-up"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className: "h-11 bg-card px-5 text-[15px]",
                  })}
                >
                  Create your workspace
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                The demo is a private copy of a salon, ready in seconds, with no
                sign-up.
              </p>
            </div>
            <ProductVisual />
          </div>
        </section>

        <Section
          id="how"
          title="Live on your website in an afternoon"
          intro="No scripts to write and no flows to design. It learns from what you already know about your business."
        >
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-3xl border bg-card p-6 sm:p-7"
              >
                <span className="grid size-9 place-items-center rounded-full bg-foreground text-sm font-semibold text-background tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                {index === 1 ? (
                  <pre
                    aria-hidden
                    className="mt-5 overflow-hidden rounded-xl bg-foreground p-3 font-mono text-[11px] leading-relaxed text-background/85"
                  >
                    {`<script src=".../embed.js"\n  data-workspace="bloom" async>\n</script>`}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        <div className="border-y bg-muted/40">
          <Section
            id="features"
            title="Everything a good front desk does"
            intro="Answers, bookings, follow-ups and handovers, with the checks and numbers you need to trust it."
          >
            <div className="grid gap-4 lg:grid-cols-6">
              <Feature
                className="lg:col-span-3"
                icon={<BookOpenText className="size-5" />}
                title="Answers from your data, with the source"
                visual={<SourcedAnswer />}
              >
                It reads your services, policies, verified answers and
                documents, shows where each answer came from, and says so when
                it doesn&apos;t know.
              </Feature>
              <Feature
                className="lg:col-span-3"
                icon={<CalendarCheck className="size-5" />}
                title="Books into your real calendar"
                visual={<MiniCalendar />}
              >
                It offers times that are actually free, across staff hours,
                breaks and buffers. The customer confirms, gets an email and a
                link to change it. Double booking can&apos;t happen.
              </Feature>
              <Feature
                className="lg:col-span-2"
                icon={<Inbox className="size-5" />}
                title="A live inbox for your team"
              >
                Take any chat over from the AI, reply in the chat or by email,
                and hand it back when you&apos;re done.
              </Feature>
              <Feature
                className="lg:col-span-2"
                icon={<FlaskConical className="size-5" />}
                title="A test lab before you go live"
              >
                See how each answer was made, fix a weak one in one click, and
                save questions it must always get right.
              </Feature>
              <Feature
                className="lg:col-span-2"
                icon={<BarChart3 className="size-5" />}
                title="Numbers that matter"
              >
                Chats, bookings made by the AI, leads, what people ask about,
                and what the AI costs you each day.
              </Feature>
            </div>
          </Section>
        </div>

        <Section
          id="trust"
          title="Built like software you can rely on"
          intro="It runs your front desk, so it's built and tested to the standard that deserves."
        >
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <LockKeyhole className="size-5" />,
                title: "Your data stays yours",
                body: "Every table is protected by row level security, so one business can never see another's data.",
              },
              {
                icon: <ShieldCheck className="size-5" />,
                title: "No guessing, no going rogue",
                body: "It can only act through checked tools, never books without the customer's confirmation, and treats documents as information, not instructions.",
              },
              {
                icon: <TestTubeDiagonal className="size-5" />,
                title: "Tested every day",
                body: "Hundreds of automated tests run on every change, and the demo salon's questions are checked against the real AI every night.",
              },
              {
                icon: <Code2 className="size-5" />,
                title: "Works on any website",
                body: "One script tag in an isolated frame, so your site's styles can't break it and it only loads where you allow.",
              },
            ].map((item) => (
              <li key={item.title}>
                <span className="grid size-10 place-items-center rounded-xl border bg-card text-primary">
                  {item.icon}
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto grid w-full max-w-6xl gap-8 overflow-hidden rounded-[2rem] bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
                See it run a real front desk.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-background/80">
                Chat with Bloom Hair &amp; Beauty&apos;s receptionist as a
                customer, book a time, then open the dashboard and watch it land
                in the calendar and inbox.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href="/demo"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-background px-5 text-[15px] font-medium text-foreground transition-colors hover:bg-background/90 focus-visible:ring-3 focus-visible:ring-background/50 focus-visible:outline-none"
              >
                Open the live demo
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <Logo />
          <p>© 2026 FrontDesk AI. All rights reserved.</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/demo" className="hover:text-foreground">
              Demo
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

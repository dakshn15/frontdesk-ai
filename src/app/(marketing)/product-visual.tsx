import {
  BookOpenText,
  CalendarCheck,
  CalendarClock,
  MessageCircle,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

// The hero's product picture, built from real pieces of the product: the website chat
// answering from the salon's data, the booking it made, and a chat handed to the team.

function Visitor({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
      {children}
    </p>
  );
}

function Assistant({
  children,
  source,
}: {
  children: ReactNode;
  source?: string;
}) {
  return (
    <div className="max-w-[90%]">
      <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
        {children}
      </div>
      {source ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
          <BookOpenText aria-hidden className="size-3" />
          {source}
        </p>
      ) : null}
    </div>
  );
}

export function ProductVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[30rem] lg:mr-0">
      <figure
        aria-label="The receptionist answering a customer on a salon's website"
        className="relative z-10 overflow-hidden rounded-3xl border bg-card shadow-[0_24px_60px_-24px_rgb(15_40_50/0.35)]"
      >
        <figcaption className="flex items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
          <span className="grid size-8 place-items-center rounded-full bg-white/15">
            <MessageCircle aria-hidden className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Bea</span>
            <span className="block text-xs text-primary-foreground">
              Bloom Hair &amp; Beauty
            </span>
          </span>
        </figcaption>
        <div className="space-y-3 p-4 text-sm leading-relaxed sm:p-5">
          <Visitor>Any time Saturday for a balayage?</Visitor>
          <Assistant source="Services and Jordan's hours">
            Jordan has 10:00 and 1:30 on Saturday. Balayage takes about 3 hours
            and starts at $195.
            <span className="mt-2.5 flex flex-wrap gap-2">
              {["Sat 10:00", "Sat 1:30"].map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium"
                >
                  <CalendarClock
                    aria-hidden
                    className="size-3.5 text-primary"
                  />
                  {slot}
                </span>
              ))}
            </span>
          </Assistant>
          <Visitor>Do you do microblading?</Visitor>
          <Assistant>
            I don&apos;t see microblading in Bloom&apos;s services, so I
            won&apos;t guess. I can ask the team to reply here.
          </Assistant>
        </div>
      </figure>

      {/* The booking it just made, as the dashboard shows it. */}
      <div
        aria-hidden
        className="absolute -bottom-20 -left-8 z-20 hidden w-60 rounded-2xl border bg-card p-3.5 shadow-[0_16px_40px_-16px_rgb(15_40_50/0.35)] sm:block"
      >
        <p className="flex items-center gap-2 text-xs font-medium text-primary">
          <CalendarCheck className="size-4" />
          New booking from the website
        </p>
        <p className="mt-2 text-sm font-semibold">Balayage with Jordan</p>
        <p className="text-xs text-muted-foreground">Saturday, 10:00 to 1:00</p>
      </div>

      {/* A chat the receptionist passed to a person. */}
      <div
        aria-hidden
        className="absolute -top-6 -right-6 z-20 hidden w-56 rounded-2xl border bg-card p-3 shadow-[0_16px_40px_-16px_rgb(15_40_50/0.35)] md:block"
      >
        <p className="flex items-center gap-2 text-xs font-medium">
          <span className="grid size-6 place-items-center rounded-full bg-amber-100 text-amber-900">
            <UserRound className="size-3.5" />
          </span>
          Needs a person
        </p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          &ldquo;Can you do hair for a bridal party of five?&rdquo;
        </p>
      </div>

      {/* Soft colour behind the composition. */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-0 rounded-[3rem] bg-[radial-gradient(60%_60%_at_60%_40%,var(--primary-soft),transparent_70%)]"
      />
    </div>
  );
}

import { BookOpenText, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";

// A static example of the receptionist at work: one answer from real data with its source,
// and one question it refuses to guess at.
export function ExampleConversation() {
  return (
    <figure
      aria-label="Example conversation with the receptionist at Bloom Hair & Beauty"
      className="w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <figcaption className="mb-4 flex items-center justify-between border-b pb-3 text-sm">
        <span className="font-medium">Bloom Hair &amp; Beauty</span>
        <span className="text-muted-foreground">AI assistant</span>
      </figcaption>

      <div className="space-y-3 text-sm leading-relaxed">
        <Visitor>Any time Saturday for a balayage?</Visitor>
        <Assistant source="Services and Maya's hours">
          Maya has 10:30 and 2:15 on Saturday. A balayage takes about 3 hours
          and starts at $180.
          <span className="mt-3 flex flex-wrap gap-2">
            <Slot>Sat 10:30</Slot>
            <Slot>Sat 2:15</Slot>
          </span>
        </Assistant>

        <Visitor>Do you do microblading?</Visitor>
        <Assistant>
          I don&apos;t see microblading in Bloom&apos;s services, so I
          won&apos;t guess. I can pass your question to the team and
          they&apos;ll reply here.
        </Assistant>
      </div>
    </figure>
  );
}

function Visitor({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2">
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
    <div className="max-w-[92%]">
      <p className="rounded-2xl rounded-bl-md bg-primary-soft px-3.5 py-2.5">
        {children}
      </p>
      {source ? (
        <p className="mt-1.5 flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
          <BookOpenText aria-hidden className="size-3.5" />
          From: {source}
        </p>
      ) : null}
    </div>
  );
}

function Slot({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background px-2.5 py-1 text-xs font-medium text-primary">
      <CalendarClock aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}

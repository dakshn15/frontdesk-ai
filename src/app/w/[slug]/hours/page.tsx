import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { getOpeningHours, listClosedDays } from "@/features/hours/queries";
import { requireManager } from "@/lib/auth/session";
import { ClosedDays } from "./closed-days";
import { OpeningHoursForm } from "./opening-hours-form";

export const metadata: Metadata = { title: "Opening hours" };

export default async function HoursPage({
  params,
}: PageProps<"/w/[slug]/hours">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const [hours, closedDays] = await Promise.all([
    getOpeningHours(claims, workspace.id),
    listClosedDays(claims, workspace.id, workspace.timezone),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Opening hours
      </h1>

      <section className="mt-8" aria-labelledby="weekly-hours">
        <h2 id="weekly-hours" className="text-lg font-semibold">
          Weekly hours
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          When customers can visit. Staff hours are set on each person&apos;s
          page.
        </p>
        <OpeningHoursForm slug={workspace.slug} hours={hours} />
      </section>

      <Separator className="my-10" />

      <section aria-labelledby="closed-days">
        <h2 id="closed-days" className="text-lg font-semibold">
          Closed days
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Holidays and other days nobody can book.
        </p>
        <ClosedDays
          slug={workspace.slug}
          days={closedDays.map((day) => ({
            id: day.id,
            name: day.name,
            label: format(parseISO(day.date), "EEE, MMM d, yyyy"),
          }))}
        />
      </section>
    </div>
  );
}

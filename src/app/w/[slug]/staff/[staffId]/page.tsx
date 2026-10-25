import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { getServerEnv } from "@/env/server";
import { getOpeningHours } from "@/features/hours/queries";
import { WEEKDAYS } from "@/features/hours/weekly-hours";
import { listServices } from "@/features/services/queries";
import { formatTimeOff } from "@/features/staff/format";
import { getStaffDetail } from "@/features/staff/queries";
import { requireManager } from "@/lib/auth/session";
import { CalendarFeed } from "./calendar-feed";
import { DeleteStaffDialog } from "./delete-staff-dialog";
import { HoursForm } from "./hours-form";
import { ProfileForm } from "./profile-form";
import { ServicesForm } from "./services-form";
import { TimeOff } from "./time-off";

export const metadata: Metadata = { title: "Staff" };

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

export default async function StaffMemberPage({
  params,
}: PageProps<"/w/[slug]/staff/[staffId]">) {
  const { slug, staffId } = await params;
  const { claims, membership } = await requireManager(slug);
  if (!z.uuid().safeParse(staffId).success) notFound();
  const { workspace } = membership;
  const [detail, services, openingHours] = await Promise.all([
    getStaffDetail(claims, workspace.id, staffId),
    listServices(claims, workspace.id),
    getOpeningHours(claims, workspace.id),
  ]);
  if (!detail) notFound();
  const { profile } = detail;
  const hasOpeningHours = WEEKDAYS.some(({ day }) => openingHours[day].length);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <Link
        href={`/w/${workspace.slug}/staff`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Staff
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
        {profile.name}
      </h1>
      {profile.title ? (
        <p className="mt-1 text-muted-foreground">{profile.title}</p>
      ) : null}

      <div className="mt-8 divide-y *:py-10 *:first:pt-0 *:last:pb-0">
        <Section
          id="profile"
          title="Profile"
          description="How this person appears to customers and the team."
        >
          <ProfileForm
            slug={workspace.slug}
            profile={profile}
            members={detail.linkableMembers}
          />
        </Section>

        <Section
          id="services"
          title="Services"
          description="What customers can book with this person."
        >
          <ServicesForm
            slug={workspace.slug}
            staffId={profile.id}
            services={services.map(({ id, name }) => ({ id, name }))}
            selected={detail.serviceIds}
          />
        </Section>

        <Section
          id="weekly-hours"
          title="Weekly hours"
          description="When this person works. Customers can only book them in these hours."
        >
          <HoursForm
            slug={workspace.slug}
            staffId={profile.id}
            hours={detail.hours}
            openingHours={hasOpeningHours ? openingHours : undefined}
          />
        </Section>

        <Section
          id="time-off"
          title="Time off"
          description={`Holidays and appointments, in ${workspace.timezone.replaceAll("_", " ")} time.`}
        >
          <TimeOff
            slug={workspace.slug}
            staffId={profile.id}
            entries={detail.timeOff.map((entry) => ({
              id: entry.id,
              note: entry.note,
              label: formatTimeOff(
                entry.startsAt,
                entry.endsAt,
                workspace.timezone,
              ),
            }))}
          />
        </Section>

        <Section
          id="calendar-feed"
          title="Calendar feed"
          description="Subscribe to this link in Google Calendar, Apple Calendar or Outlook to see this person's bookings there. Keep it private: anyone with the link can see them."
        >
          <CalendarFeed
            slug={workspace.slug}
            staffId={profile.id}
            url={`${getServerEnv().NEXT_PUBLIC_SITE_URL}/api/calendar/${profile.calendarToken}.ics`}
          />
        </Section>

        <Section
          id="delete-staff"
          title="Delete staff member"
          description="Removes this person from your staff. Their team login, if any, stays."
        >
          <DeleteStaffDialog
            slug={workspace.slug}
            staffId={profile.id}
            name={profile.name}
          />
        </Section>
      </div>
    </div>
  );
}

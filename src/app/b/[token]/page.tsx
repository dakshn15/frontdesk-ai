import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/forms/form-message";
import { formatAppointment, timeZoneLabel } from "@/features/bookings/format";
import { localDate } from "@/lib/clock";
import { getManagedBooking } from "@/privileged/manage";
import { ManageBooking } from "./manage-booking";

export const metadata: Metadata = {
  title: "Your appointment",
  robots: { index: false, follow: false },
};

export default async function ManageBookingPage({
  params,
}: PageProps<"/b/[token]">) {
  const { token } = await params;
  const booking = await getManagedBooking(token);
  if (!booking) notFound();
  const { business, timeZone } = booking;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm text-muted-foreground">{business}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Your appointment
      </h1>
      <div className="mt-6 rounded-xl border p-4">
        <p className="font-medium">
          {booking.serviceName} with {booking.staffName}
        </p>
        <p className="mt-1 text-sm">
          {formatAppointment(booking.startsAt, timeZone)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {timeZoneLabel(timeZone)}
        </p>
      </div>
      <div className="mt-6">
        {booking.state === "cancelled" ? (
          <FormMessage tone="success">
            This appointment was cancelled.
          </FormMessage>
        ) : booking.state === "passed" ? (
          <FormMessage tone="success">This appointment has passed.</FormMessage>
        ) : booking.state === "too_late" ? (
          <FormMessage tone="success">
            It&apos;s too close to your appointment to change it online. Please
            contact {business}.
          </FormMessage>
        ) : (
          <ManageBooking
            token={token}
            timeZone={timeZone}
            date={localDate(timeZone, booking.startsAt)}
            today={localDate(timeZone)}
          />
        )}
      </div>
    </main>
  );
}

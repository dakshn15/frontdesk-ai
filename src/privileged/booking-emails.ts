import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { bookings, customers, workspaces } from "@/db/schema";
import { getServerEnv } from "@/env/server";
import { formatAppointment, timeZoneLabel } from "@/features/bookings/format";
import { icsCalendar } from "@/lib/ics";
import { createSecretToken } from "@/lib/secret-token";
import { sendEmail } from "./mailer";

export type BookingEmailKind =
  "confirmed" | "rescheduled" | "cancelled" | "reminder" | "link";

const SUBJECT: Record<BookingEmailKind, string> = {
  confirmed: "is booked",
  rescheduled: "has moved",
  cancelled: "is cancelled",
  reminder: "is coming up",
  link: "and how to change it",
};

const INTRO: Record<BookingEmailKind, string> = {
  confirmed: "You're booked in.",
  rescheduled: "Your appointment has a new time.",
  cancelled: "Your appointment has been cancelled.",
  reminder: "A reminder of your appointment.",
  link: "Here's the link to cancel or change your appointment.",
};

// Reminders carry no new link, so the one in the booking email keeps working.
const REMINDER_NOTE =
  "To cancel or change it, use the link in your booking email.";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The subject and both bodies of a booking email. */
export function bookingEmailContent(
  kind: BookingEmailKind,
  details: {
    business: string;
    customerName: string;
    serviceName: string;
    staffName: string;
    when: string;
    manageUrl?: string;
  },
): { subject: string; text: string; html: string } {
  const subject = `Your appointment at ${details.business} ${SUBJECT[kind]}`;
  const what = `${details.serviceName} with ${details.staffName}`;
  const manage = details.manageUrl
    ? `Need to cancel or change it? ${details.manageUrl}`
    : kind === "reminder"
      ? REMINDER_NOTE
      : null;
  const text = [
    `Hi ${details.customerName},`,
    INTRO[kind],
    `${what}\n${details.when}`,
    manage,
    details.business,
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.5">
<p>Hi ${escapeHtml(details.customerName)},</p>
<p>${INTRO[kind]}</p>
<p style="padding:12px 16px;border:1px solid #e7e5e4;border-radius:8px"><strong>${escapeHtml(what)}</strong><br>${escapeHtml(details.when)}</p>
${
  details.manageUrl
    ? `<p>Need to cancel or change it? <a href="${escapeHtml(details.manageUrl)}">Manage your appointment</a></p>`
    : kind === "reminder"
      ? `<p>${REMINDER_NOTE}</p>`
      : ""
}
<p>${escapeHtml(details.business)}</p>
</body></html>`;
  return { subject, text, html };
}

/** A fresh manage token for a booking; the old link stops working. */
async function rotateManageToken(bookingId: string): Promise<string> {
  const { token, hash } = createSecretToken();
  await adminDb
    .update(bookings)
    .set({ manageTokenHash: hash })
    .where(eq(bookings.id, bookingId));
  return token;
}

/**
 * Emails the customer about their booking, with a calendar file. Confirmations and moves
 * include a manage link: the caller's token if it has one, otherwise a new one.
 */
export async function sendBookingEmail(input: {
  bookingId: string;
  kind: BookingEmailKind;
  manageToken?: string;
}): Promise<void> {
  const [booking] = await adminDb
    .select({
      workspaceId: bookings.workspaceId,
      business: workspaces.name,
      timeZone: workspaces.timezone,
      customerName: customers.name,
      customerEmail: customers.email,
      serviceName: bookings.serviceName,
      staffName: bookings.staffName,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      changedAt: sql<number>`extract(epoch from ${bookings.updatedAt})::int`,
    })
    .from(bookings)
    .innerJoin(workspaces, eq(workspaces.id, bookings.workspaceId))
    .innerJoin(
      customers,
      and(
        eq(customers.id, bookings.customerId),
        eq(customers.workspaceId, bookings.workspaceId),
      ),
    )
    .where(eq(bookings.id, input.bookingId));
  if (!booking) return;

  const withLink = input.kind !== "cancelled" && input.kind !== "reminder";
  const token = withLink
    ? (input.manageToken ?? (await rotateManageToken(input.bookingId)))
    : undefined;
  const siteUrl = getServerEnv().NEXT_PUBLIC_SITE_URL;
  const when = `${formatAppointment(booking.startsAt, booking.timeZone)} (${timeZoneLabel(booking.timeZone)})`;
  const content = bookingEmailContent(input.kind, {
    business: booking.business,
    customerName: booking.customerName,
    serviceName: booking.serviceName,
    staffName: booking.staffName,
    when,
    manageUrl: token ? `${siteUrl}/b/${token}` : undefined,
  });
  const ics = icsCalendar({
    method: input.kind === "cancelled" ? "CANCEL" : "PUBLISH",
    now: new Date(),
    events: [
      {
        uid: `${input.bookingId}@frontdesk-ai`,
        start: booking.startsAt,
        end: booking.endsAt,
        summary: `${booking.serviceName} at ${booking.business}`,
        description: `${booking.serviceName} with ${booking.staffName}`,
        status: input.kind === "cancelled" ? "CANCELLED" : "CONFIRMED",
        // Calendar apps keep the highest sequence, so later changes win.
        sequence: input.kind === "confirmed" ? 0 : booking.changedAt,
      },
    ],
  });

  await sendEmail({
    workspaceId: booking.workspaceId,
    bookingId: input.bookingId,
    kind: `booking_${input.kind}`,
    to: booking.customerEmail,
    ...content,
    // The calendar already has the appointment by the time a reminder goes out.
    attachments:
      input.kind === "reminder" || input.kind === "link"
        ? undefined
        : [
            {
              filename: "appointment.ics",
              content: ics,
              contentType: "text/calendar; charset=utf-8",
            },
          ],
  });
}

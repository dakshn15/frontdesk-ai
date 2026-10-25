import "server-only";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { bookings } from "@/db/schema";
import { sendBookingEmail } from "@/privileged/booking-emails";

const HOUR_MS = 3_600_000;

/**
 * Emails a reminder for confirmed bookings starting 12 to 36 hours from now that haven't had
 * one. Each booking is claimed (reminder_sent_at set) before its email goes out, so running
 * this twice, or twice at once, never sends two. Runs once a day from Vercel Cron.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const due = await adminDb
    .update(bookings)
    .set({ reminderSentAt: now })
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.reminderSentAt),
        gte(bookings.startsAt, new Date(now.getTime() + 12 * HOUR_MS)),
        lt(bookings.startsAt, new Date(now.getTime() + 36 * HOUR_MS)),
      ),
    )
    .returning({ id: bookings.id });
  for (const { id } of due) {
    await sendBookingEmail({ bookingId: id, kind: "reminder" });
  }
  return due.length;
}

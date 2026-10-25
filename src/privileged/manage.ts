import "server-only";
import { eq } from "drizzle-orm";
import { adminDb } from "@/db/admin";
import { bookings, workspaces } from "@/db/schema";
import {
  cancelBooking,
  findSlots,
  moveBooking,
  type SlotOption,
} from "@/features/bookings/engine";
import { hashSecretToken } from "@/lib/secret-token";
import { sendBookingEmail } from "./booking-emails";

// The customer's manage link. The token is the only credential, so every lookup starts from
// its hash and every change stays inside that booking's workspace.

/** open: can change; too_late: inside the cancellation window; passed: started or closed out. */
export type ManagedState = "open" | "too_late" | "passed" | "cancelled";

export type ManagedBooking = {
  id: string;
  workspaceId: string;
  business: string;
  timeZone: string;
  serviceId: string | null;
  staffId: string | null;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
  state: ManagedState;
};

export async function getManagedBooking(
  token: string,
  now = new Date(),
): Promise<ManagedBooking | null> {
  if (!token) return null;
  const [row] = await adminDb
    .select({
      id: bookings.id,
      workspaceId: bookings.workspaceId,
      business: workspaces.name,
      timeZone: workspaces.timezone,
      windowHours: workspaces.cancellationWindowHours,
      serviceId: bookings.serviceId,
      staffId: bookings.staffId,
      serviceName: bookings.serviceName,
      staffName: bookings.staffName,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(workspaces, eq(workspaces.id, bookings.workspaceId))
    .where(eq(bookings.manageTokenHash, hashSecretToken(token)));
  if (!row) return null;

  const { windowHours, status, ...booking } = row;
  const msLeft = booking.startsAt.getTime() - now.getTime();
  const state: ManagedState =
    status === "cancelled"
      ? "cancelled"
      : status !== "confirmed" || msLeft <= 0
        ? "passed"
        : msLeft < windowHours * 3_600_000
          ? "too_late"
          : "open";
  return { ...booking, state };
}

/** Free times for the same person and service, under the customer booking rules. */
export async function managedSlots(
  token: string,
  date: string,
): Promise<SlotOption[]> {
  const booking = await getManagedBooking(token);
  if (booking?.state !== "open" || !booking.serviceId || !booking.staffId) {
    return [];
  }
  const { serviceId, staffId } = booking;
  return adminDb.transaction((tx) =>
    findSlots(
      tx,
      booking.workspaceId,
      { serviceId, staffId, date, excludeBookingId: booking.id },
      { ignoreWindow: false, now: new Date() },
    ),
  );
}

export async function cancelManagedBooking(
  token: string,
): Promise<"ok" | "not_allowed" | "too_late"> {
  const booking = await getManagedBooking(token);
  if (booking?.state === "too_late") return "too_late";
  if (booking?.state !== "open") return "not_allowed";
  const result = await adminDb.transaction((tx) =>
    cancelBooking(tx, booking.workspaceId, booking.id, null),
  );
  if (result === "ok") {
    await sendBookingEmail({ bookingId: booking.id, kind: "cancelled" });
  }
  return result;
}

export async function rescheduleManagedBooking(
  token: string,
  startsAt: Date,
): Promise<"ok" | "slot_taken" | "not_allowed" | "too_late"> {
  const booking = await getManagedBooking(token);
  if (booking?.state === "too_late") return "too_late";
  if (booking?.state !== "open" || !booking.staffId) return "not_allowed";
  const { staffId } = booking;
  const result = await adminDb.transaction((tx) =>
    moveBooking(
      tx,
      booking.workspaceId,
      booking.id,
      { staffId, startsAt },
      { actorId: null, ignoreWindow: false, now: new Date() },
    ),
  );
  if (result === "ok") {
    await sendBookingEmail({
      bookingId: booking.id,
      kind: "rescheduled",
      manageToken: token,
    });
  }
  return result;
}

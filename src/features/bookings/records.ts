import "server-only";
import { eq } from "drizzle-orm";
import { type AuthClaims, withRls } from "@/db";
import { workspaces } from "@/db/schema";
import type { BookingRules } from "./availability";
import {
  cancelBooking,
  type CreateResult,
  findSlots,
  insertBooking,
  moveBooking,
  type NewBooking,
  type SlotOption,
  setBookingStatus,
} from "./engine";

// Dashboard bookings, as the signed-in member. Staff can book outside the customer booking
// window (walk-ins, last-minute changes), but never into time that isn't free.
const dashboard = (claims: AuthClaims) => ({
  actorId: claims.sub,
  ignoreWindow: true,
  now: new Date(),
});

export function getSlotsRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: {
    serviceId: string;
    staffId: string | "any";
    date: string;
    excludeBookingId?: string;
  },
): Promise<SlotOption[]> {
  return withRls(claims, (tx) =>
    findSlots(tx, workspaceId, input, dashboard(claims)),
  );
}

export function createBookingRecord(
  claims: AuthClaims,
  workspaceId: string,
  input: NewBooking,
): Promise<CreateResult> {
  return withRls(claims, (tx) =>
    insertBooking(tx, workspaceId, input, {
      ...dashboard(claims),
      source: "dashboard",
    }),
  );
}

export function rescheduleBookingRecord(
  claims: AuthClaims,
  workspaceId: string,
  bookingId: string,
  target: { staffId: string; startsAt: Date },
): Promise<"ok" | "slot_taken" | "not_allowed"> {
  return withRls(claims, (tx) =>
    moveBooking(tx, workspaceId, bookingId, target, dashboard(claims)),
  );
}

export function cancelBookingRecord(
  claims: AuthClaims,
  workspaceId: string,
  bookingId: string,
): Promise<"ok" | "not_allowed"> {
  return withRls(claims, (tx) =>
    cancelBooking(tx, workspaceId, bookingId, claims.sub),
  );
}

export function setBookingStatusRecord(
  claims: AuthClaims,
  workspaceId: string,
  bookingId: string,
  status: "completed" | "no_show",
): Promise<"ok" | "not_allowed"> {
  return withRls(claims, (tx) =>
    setBookingStatus(tx, workspaceId, bookingId, status, claims.sub),
  );
}

/** Saves the workspace's booking rules. Row level security lets only owners and admins. */
export async function updateBookingRulesRecord(
  claims: AuthClaims,
  workspaceId: string,
  rules: BookingRules,
): Promise<"ok" | "not_allowed"> {
  const updated = await withRls(claims, (tx) =>
    tx
      .update(workspaces)
      .set(rules)
      .where(eq(workspaces.id, workspaceId))
      .returning({ id: workspaces.id }),
  );
  return updated.length > 0 ? "ok" : "not_allowed";
}

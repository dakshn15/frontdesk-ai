"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getManagerContext,
  getMemberContext,
} from "@/features/workspaces/manager-context";
import {
  type ActionResult,
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/validation";
import { sendBookingEmail } from "@/privileged/booking-emails";
import {
  cancelBookingRecord,
  createBookingRecord,
  getSlotsRecord,
  rescheduleBookingRecord,
  setBookingStatusRecord,
  updateBookingRulesRecord,
} from "./records";
import {
  bookingRulesSchema,
  customerSchema,
  newBookingSchema,
  rescheduleSchema,
  type SlotChoice,
  staffChoiceSchema,
} from "./schemas";

const SLOT_TAKEN = "That time was just taken. Pick another.";

const slotQuerySchema = z.object({
  serviceId: z.uuid(),
  staffId: staffChoiceSchema,
  date: z.iso.date(),
  excludeBookingId: z.uuid().optional(),
});

/** Free start times for the booking dialogs. Any member may ask. */
export async function loadSlots(
  slug: string,
  query: z.input<typeof slotQuerySchema>,
): Promise<ActionResult<SlotChoice[]>> {
  const context = await getMemberContext(slug);
  const parsed = slotQuerySchema.safeParse(query);
  if (!context || !parsed.success) return fail(NOT_ALLOWED);
  const slots = await getSlotsRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  return ok(
    slots.map((slot) => ({ ...slot, startsAt: slot.startsAt.toISOString() })),
  );
}

function refresh(slug: string) {
  revalidatePath(`/w/${slug}/calendar`);
}

export async function createBooking(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getMemberContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const fields = Object.fromEntries(formData);
  const booking = newBookingSchema.safeParse(fields);
  const customer = customerSchema.safeParse(fields);
  if (!booking.success || !customer.success) {
    return fail(CHECK_FIELDS, {
      ...(booking.success ? {} : zodFieldErrors(booking.error)),
      ...(customer.success ? {} : zodFieldErrors(customer.error)),
    });
  }
  const result = await createBookingRecord(
    context.claims,
    context.workspace.id,
    { ...booking.data, customer: customer.data },
  );
  if (!result.ok) {
    return result.error === "slot_taken"
      ? fail(CHECK_FIELDS, { startsAt: [SLOT_TAKEN] })
      : fail(NOT_ALLOWED);
  }
  await sendBookingEmail({
    bookingId: result.id,
    kind: "confirmed",
    manageToken: result.manageToken,
  });
  refresh(slug);
  return ok();
}

export async function rescheduleBooking(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getMemberContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const { bookingId, ...target } = parsed.data;
  const result = await rescheduleBookingRecord(
    context.claims,
    context.workspace.id,
    bookingId,
    target,
  );
  if (result === "slot_taken") {
    return fail(CHECK_FIELDS, { startsAt: [SLOT_TAKEN] });
  }
  if (result !== "ok") return fail(NOT_ALLOWED);
  // A new manage link goes out with the new time.
  await sendBookingEmail({ bookingId, kind: "rescheduled" });
  refresh(slug);
  return ok();
}

const statusSchema = z.object({
  bookingId: z.uuid(),
  status: z.enum(["cancelled", "completed", "no_show"]),
});

/** Cancels a booking or marks how it went. */
export async function updateBookingStatus(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getMemberContext(slug);
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!context || !parsed.success) return fail(NOT_ALLOWED);
  const { bookingId, status } = parsed.data;
  const { claims, workspace } = context;
  const result =
    status === "cancelled"
      ? await cancelBookingRecord(claims, workspace.id, bookingId)
      : await setBookingStatusRecord(claims, workspace.id, bookingId, status);
  if (result !== "ok") return fail(NOT_ALLOWED);
  if (status === "cancelled") {
    await sendBookingEmail({ bookingId, kind: "cancelled" });
  }
  refresh(slug);
  return ok();
}

export async function saveBookingRules(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = bookingRulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await updateBookingRulesRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ActionResult,
  CHECK_FIELDS,
  fail,
  type FormState,
  ok,
} from "@/lib/action-result";
import {
  cancelManagedBooking,
  managedSlots,
  rescheduleManagedBooking,
} from "@/privileged/manage";
import { instantSchema, type SlotChoice } from "./schemas";

// Actions behind a customer's manage link. The token in the URL is the only credential.

const tokenSchema = z.string().min(20).max(100);

const MESSAGES = {
  too_late: "It's too close to your appointment to change it online.",
  not_allowed: "This appointment can't be changed online.",
  slot_taken: "That time was just taken. Pick another.",
} as const;

export async function loadManagedSlots(
  token: string,
  date: string,
): Promise<ActionResult<SlotChoice[]>> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedDate = z.iso.date().safeParse(date);
  if (!parsedToken.success || !parsedDate.success) {
    return fail(MESSAGES.not_allowed);
  }
  const slots = await managedSlots(parsedToken.data, parsedDate.data);
  return ok(
    slots.map((slot) => ({ ...slot, startsAt: slot.startsAt.toISOString() })),
  );
}

export async function cancelManaged(token: string): Promise<FormState> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return fail(MESSAGES.not_allowed);
  const result = await cancelManagedBooking(parsed.data);
  if (result !== "ok") return fail(MESSAGES[result]);
  revalidatePath(`/b/${parsed.data}`);
  return ok();
}

export async function rescheduleManaged(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success) return fail(MESSAGES.not_allowed);
  const startsAt = instantSchema.safeParse(formData.get("startsAt"));
  if (!startsAt.success) {
    return fail(CHECK_FIELDS, { startsAt: ["Pick a time."] });
  }
  const result = await rescheduleManagedBooking(
    parsedToken.data,
    startsAt.data,
  );
  if (result === "slot_taken") {
    return fail(CHECK_FIELDS, { startsAt: [MESSAGES.slot_taken] });
  }
  if (result !== "ok") return fail(MESSAGES[result]);
  revalidatePath(`/b/${parsedToken.data}`);
  return ok();
}

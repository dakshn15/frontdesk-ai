"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { localDate } from "@/lib/clock";
import { zodFieldErrors } from "@/lib/validation";
import {
  addClosedDayRecord,
  deleteClosedDayRecord,
  replaceOpeningHoursRecord,
} from "./records";
import { closedDaySchema } from "./schemas";
import { parseWeeklyHours } from "./weekly-hours";

export async function saveOpeningHours(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = parseWeeklyHours(String(formData.get("hours") ?? ""));
  if (!parsed.ok) return fail(parsed.error);
  const result = await replaceOpeningHoursRecord(
    context.claims,
    context.workspace.id,
    parsed.hours,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/hours`);
  return ok();
}

export async function addClosedDay(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = closedDaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  // A past date would be saved but never listed.
  if (parsed.data.date < localDate(context.workspace.timezone)) {
    return fail(CHECK_FIELDS, { date: ["Pick today or a later date."] });
  }
  const result = await addClosedDayRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  if (result === "duplicate_date") {
    return fail(CHECK_FIELDS, { date: ["That day is already marked closed."] });
  }
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/hours`);
  return ok();
}

export async function deleteClosedDay(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const closedDayId = z.uuid().safeParse(formData.get("closedDayId"));
  if (!context || !closedDayId.success) return fail(NOT_ALLOWED);
  const result = await deleteClosedDayRecord(
    context.claims,
    context.workspace.id,
    closedDayId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/hours`);
  return ok();
}

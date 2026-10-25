"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseWeeklyHours } from "@/features/hours/weekly-hours";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/validation";
import {
  addTimeOffRecord,
  createStaffRecord,
  deleteStaffRecord,
  deleteTimeOffRecord,
  replaceStaffHoursRecord,
  setStaffServicesRecord,
  updateStaffProfileRecord,
} from "./records";
import {
  staffProfileSchema,
  staffServicesSchema,
  timeOffRange,
  timeOffSchema,
} from "./schemas";

const ALREADY_LINKED = {
  userId: ["That team member is already linked to another staff profile."],
};

/** Staff appear on the services page and the setup checklist too. */
function refresh(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}

/** The manager context and the form's `staffId`, or null. */
async function staffContext(slug: string, formData: FormData) {
  const context = await getManagerContext(slug);
  const staffId = z.uuid().safeParse(formData.get("staffId"));
  if (!context || !staffId.success) return null;
  return { ...context, staffId: staffId.data };
}

export async function createStaff(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  // The dialog asks only for a name and title; new people can be booked.
  const parsed = staffProfileSchema.safeParse({
    ...Object.fromEntries(formData),
    active: "on",
  });
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await createStaffRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  if (!result.ok) return fail(NOT_ALLOWED);
  refresh(slug);
  redirect(`/w/${slug}/staff/${result.id}`);
}

export async function saveStaffProfile(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await staffContext(slug, formData);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = staffProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await updateStaffProfileRecord(
    context.claims,
    context.workspace.id,
    context.staffId,
    parsed.data,
  );
  if (result === "member_already_linked") {
    return fail(CHECK_FIELDS, ALREADY_LINKED);
  }
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export async function saveStaffServices(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await staffContext(slug, formData);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = staffServicesSchema.safeParse({
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return fail(NOT_ALLOWED);
  const result = await setStaffServicesRecord(
    context.claims,
    context.workspace.id,
    context.staffId,
    parsed.data.serviceIds,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export async function saveStaffHours(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await staffContext(slug, formData);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = parseWeeklyHours(String(formData.get("hours") ?? ""));
  if (!parsed.ok) return fail(parsed.error);
  const result = await replaceStaffHoursRecord(
    context.claims,
    context.workspace.id,
    context.staffId,
    parsed.hours,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export async function addTimeOff(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await staffContext(slug, formData);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const range = timeOffRange(parsed.data, context.workspace.timezone);
  // Time off that has already ended would be saved but never listed.
  if (range.endsAt <= new Date()) {
    return fail(CHECK_FIELDS, {
      endDate: ["That time off has already ended."],
    });
  }
  const result = await addTimeOffRecord(
    context.claims,
    context.workspace.id,
    context.staffId,
    { ...range, note: parsed.data.note },
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export async function deleteTimeOff(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const timeOffId = z.uuid().safeParse(formData.get("timeOffId"));
  if (!context || !timeOffId.success) return fail(NOT_ALLOWED);
  const result = await deleteTimeOffRecord(
    context.claims,
    context.workspace.id,
    timeOffId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  return ok();
}

export async function deleteStaff(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await staffContext(slug, formData);
  if (!context) return fail(NOT_ALLOWED);
  const result = await deleteStaffRecord(
    context.claims,
    context.workspace.id,
    context.staffId,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug);
  redirect(`/w/${slug}/staff`);
}

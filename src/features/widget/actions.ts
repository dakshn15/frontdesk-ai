"use server";

import { revalidatePath } from "next/cache";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/validation";
import { updateWidgetSettingsRecord } from "./records";
import { widgetSettingsSchema } from "./schemas";

export async function saveWidgetSettings(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = widgetSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const saved = await updateWidgetSettingsRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  if (!saved) return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/widget`);
  return ok();
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withRls } from "@/db";
import { workspaces } from "@/db/schema";
import { getManagerContext } from "@/features/workspaces/manager-context";
import {
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { zodFieldErrors } from "@/lib/validation";
import { receptionistSettingsSchema } from "./schemas";

export async function saveReceptionistSettings(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = receptionistSettingsSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const updated = await withRls(context.claims, (tx) =>
    tx
      .update(workspaces)
      .set(parsed.data)
      .where(eq(workspaces.id, context.workspace.id))
      .returning({ id: workspaces.id }),
  );
  if (updated.length === 0) return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

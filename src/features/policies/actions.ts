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
import { zodFieldErrors } from "@/lib/validation";
import { deletePolicyRecord, savePolicyRecord } from "./records";
import { policyInputSchema } from "./schemas";

export async function savePolicy(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  const parsed = policyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await savePolicyRecord(
    context.claims,
    context.workspace.id,
    parsed.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  // The setup checklist on the overview counts policies too.
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

export async function deletePolicy(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const policyId = z.uuid().safeParse(formData.get("policyId"));
  if (!context || !policyId.success) return fail(NOT_ALLOWED);
  const result = await deletePolicyRecord(
    context.claims,
    context.workspace.id,
    policyId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

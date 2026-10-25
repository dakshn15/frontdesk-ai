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
import {
  createServiceRecord,
  deleteServiceRecord,
  updateServiceRecord,
} from "./records";
import { serviceInputSchema } from "./schemas";

const optionalId = z.union([z.literal(""), z.uuid()]);

export async function saveService(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const serviceId = optionalId.safeParse(formData.get("serviceId") ?? "");
  if (!context || !serviceId.success) return fail(NOT_ALLOWED);

  const parsed = serviceInputSchema(context.workspace.currency).safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));

  const { claims, workspace } = context;
  const error = serviceId.data
    ? await updateServiceRecord(
        claims,
        workspace.id,
        serviceId.data,
        parsed.data,
      )
    : await createServiceRecord(claims, workspace.id, parsed.data).then((r) =>
        r.ok ? "ok" : r.error,
      );
  if (error === "duplicate_name") {
    return fail(CHECK_FIELDS, {
      name: ["You already have a service with that name."],
    });
  }
  if (error !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/services`);
  return ok();
}

export async function deleteService(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const serviceId = z.uuid().safeParse(formData.get("serviceId"));
  if (!context || !serviceId.success) return fail(NOT_ALLOWED);
  const result = await deleteServiceRecord(
    context.claims,
    context.workspace.id,
    serviceId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}/services`);
  return ok();
}

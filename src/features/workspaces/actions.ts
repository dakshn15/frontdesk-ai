"use server";

import { redirect } from "next/navigation";
import { fail, type FormState } from "@/lib/action-result";
import { getAuthClaims } from "@/lib/auth/session";
import { zodFieldErrors } from "@/lib/validation";
import { createWorkspaceRecord } from "./records";
import { workspaceDetailsSchema } from "./schemas";

const TRY_AGAIN = "Something went wrong. Try again in a moment.";
const CHECK_FIELDS = "Check the highlighted fields.";

export async function createWorkspace(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await getAuthClaims();
  if (!claims) redirect("/sign-in?next=%2Fonboarding");

  const parsed = workspaceDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));

  let slug: string;
  try {
    ({ slug } = await createWorkspaceRecord(claims, parsed.data));
  } catch (err) {
    console.error("createWorkspace failed", err);
    return fail(TRY_AGAIN);
  }
  redirect(`/w/${slug}`);
}

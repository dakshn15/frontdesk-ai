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
import { deleteAnswerRecord, saveAnswerRecord } from "./records";
import { answerInputSchema } from "./schemas";

const optionalId = z.union([z.literal(""), z.uuid()]);

export async function saveAnswer(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const answerId = optionalId.safeParse(formData.get("answerId") ?? "");
  if (!context || !answerId.success) return fail(NOT_ALLOWED);
  const parsed = answerInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(CHECK_FIELDS, zodFieldErrors(parsed.error));
  const result = await saveAnswerRecord(context.claims, context.workspace.id, {
    ...parsed.data,
    id: answerId.data || null,
  });
  if (result === "duplicate_question") {
    return fail(CHECK_FIELDS, {
      question: ["You already have an answer for this question."],
    });
  }
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

export async function deleteAnswer(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  const answerId = z.uuid().safeParse(formData.get("answerId"));
  if (!context || !answerId.success) return fail(NOT_ALLOWED);
  const result = await deleteAnswerRecord(
    context.claims,
    context.workspace.id,
    answerId.data,
  );
  if (result !== "ok") return fail(NOT_ALLOWED);
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

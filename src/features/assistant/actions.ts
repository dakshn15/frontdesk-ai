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
import { getServerEnv } from "@/env/server";
import {
  type AiKeyProvider,
  checkAiKey,
  storeAiKey,
} from "@/privileged/ai-keys";
import { aiKeySchema, receptionistSettingsSchema } from "./schemas";

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

const KEY_LABEL = { openai: "OpenAI", google: "Google Gemini" } as const;

/** Saves or removes the workspace's own key for one AI provider, after checking it works. */
export async function saveAiKey(
  slug: string,
  provider: AiKeyProvider,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getManagerContext(slug);
  if (!context) return fail(NOT_ALLOWED);
  if (context.workspace.demoExpiresAt !== null)
    return fail("The demo uses FrontDesk AI's own keys, so it can't save one.");

  let key: string | null = null;
  if (formData.get("intent") !== "remove") {
    const parsed = aiKeySchema(provider).safeParse(formData.get("key"));
    if (!parsed.success)
      return fail(CHECK_FIELDS, { key: [parsed.error.issues[0].message] });
    key = parsed.data;
    // The scripted test model never calls a provider, so tests skip the check.
    const check =
      getServerEnv().AI_FAKE === "1" && !process.env.VERCEL
        ? "valid"
        : await checkAiKey(provider, key);
    if (check === "invalid")
      return fail(CHECK_FIELDS, {
        key: [`${KEY_LABEL[provider]} didn't accept this key.`],
      });
    if (check === "unreachable")
      return fail(
        `We couldn't reach ${KEY_LABEL[provider]} to check the key. Try again in a minute.`,
      );
  }
  if (!(await storeAiKey(context.workspace.id, provider, key)))
    return fail("Saving AI keys isn't set up on this server yet.");
  revalidatePath(`/w/${slug}`, "layout");
  return ok();
}

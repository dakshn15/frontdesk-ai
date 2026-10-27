"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMyProfile } from "@/features/account/queries";
import { getMemberContext } from "@/features/workspaces/manager-context";
import {
  CHECK_FIELDS,
  fail,
  type FormState,
  NOT_ALLOWED,
  ok,
} from "@/lib/action-result";
import { sendReplyEmail } from "@/privileged/inbox-emails";
import {
  handBackRecord,
  replyRecord,
  resolveRecord,
  takeOverRecord,
} from "./records";

const conversationIdSchema = z.uuid();

function refresh(slug: string, conversationId: string) {
  revalidatePath(`/w/${slug}/inbox`);
  revalidatePath(`/w/${slug}/inbox/${conversationId}`);
}

/** Take over, hand back or resolve, chosen by the clicked button's value. */
export async function changeConversation(
  slug: string,
  conversationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getMemberContext(slug);
  const id = conversationIdSchema.safeParse(conversationId);
  if (!context || !id.success) return fail(NOT_ALLOWED);
  const args = [context.claims, context.workspace.id, id.data] as const;
  const action = formData.get("action");
  const result =
    action === "take_over"
      ? await takeOverRecord(...args)
      : action === "hand_back"
        ? await handBackRecord(...args)
        : action === "resolve"
          ? await resolveRecord(...args)
          : "not_found";
  if (result === "taken")
    return fail("Someone else on the team is already handling this chat.");
  if (result !== "ok") return fail(NOT_ALLOWED);
  refresh(slug, id.data);
  return ok();
}

const replySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: "Write a reply." })
    .max(4000, { error: "Use 4,000 characters or fewer." }),
  emailCopy: z.literal("on").optional(),
});

/** A reply in the visitor's chat, and optionally by email to the address they left. */
export async function replyToConversation(
  slug: string,
  conversationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getMemberContext(slug);
  const id = conversationIdSchema.safeParse(conversationId);
  if (!context || !id.success) return fail(NOT_ALLOWED);
  const parsed = replySchema.safeParse({
    content: formData.get("content"),
    emailCopy: formData.get("emailCopy") ?? undefined,
  });
  if (!parsed.success)
    return fail(CHECK_FIELDS, z.flattenError(parsed.error).fieldErrors);
  const result = await replyRecord(
    context.claims,
    context.workspace.id,
    id.data,
    parsed.data.content,
  );
  if (result === "not_handling")
    return fail("Take over the chat before replying.");
  if (result !== "ok") return fail(NOT_ALLOWED);
  if (parsed.data.emailCopy) {
    const profile = await getMyProfile(context.claims);
    const sent = await sendReplyEmail({
      workspaceId: context.workspace.id,
      conversationId: id.data,
      staffName: profile.fullName.trim().split(/\s+/)[0] || "The team",
      content: parsed.data.content,
    });
    if (sent === "failed")
      return fail("Your reply is in the chat, but the email didn't send.");
  }
  refresh(slug, id.data);
  return ok();
}

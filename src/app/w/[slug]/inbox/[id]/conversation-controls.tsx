"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckboxField, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import type { ConversationStatus } from "@/db/schema/enums";
import {
  changeConversation,
  replyToConversation,
} from "@/features/inbox/actions";

/** Take over, hand back to the AI, or resolve. */
export function ConversationActions({
  slug,
  conversationId,
  status,
  mine,
}: {
  slug: string;
  conversationId: string;
  status: ConversationStatus;
  mine: boolean;
}) {
  const { onSubmit, pending, formError } = useActionForm(
    changeConversation.bind(null, slug, conversationId),
  );
  const handling = status === "human";

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        {!handling || !mine ? (
          <Button
            type="submit"
            name="action"
            value="take_over"
            className="h-9 px-3"
            disabled={pending}
          >
            Take over
          </Button>
        ) : null}
        {handling ? (
          <Button
            type="submit"
            name="action"
            value="hand_back"
            variant="outline"
            className="h-9 px-3"
            disabled={pending}
          >
            Hand back to AI
          </Button>
        ) : null}
        {status !== "resolved" ? (
          <Button
            type="submit"
            name="action"
            value="resolve"
            variant="outline"
            className="h-9 px-3"
            disabled={pending}
          >
            Resolve
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** The team's reply, shown in the visitor's chat and optionally emailed. */
export function ReplyForm({
  slug,
  conversationId,
  email,
}: {
  slug: string;
  conversationId: string;
  email: string | null;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    replyToConversation.bind(null, slug, conversationId),
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    form.current?.reset();
    toast.success("Reply sent.");
  }, [state]);

  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <TextareaField
        label="Reply"
        name="content"
        rows={3}
        maxLength={4000}
        hint="The visitor sees this in the chat on your website."
        errors={fieldErrors?.content}
      />
      {email ? (
        <CheckboxField
          label={`Also email this reply to ${email}`}
          name="emailCopy"
        />
      ) : null}
      <Button type="submit" className="h-10 w-fit px-4" disabled={pending}>
        Send reply
      </Button>
    </form>
  );
}

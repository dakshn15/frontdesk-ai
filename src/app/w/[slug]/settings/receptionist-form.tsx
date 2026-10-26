"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Field, SelectField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveReceptionistSettings } from "@/features/assistant/actions";

export function ReceptionistForm({
  slug,
  assistantName,
  aiProvider,
}: {
  slug: string;
  assistantName: string;
  aiProvider: "openai" | "google";
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveReceptionistSettings.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Assistant name"
        name="assistantName"
        defaultValue={assistantName}
        hint="Customers see this name in the chat."
        errors={fieldErrors?.assistantName}
      />
      <SelectField
        label="AI provider"
        name="aiProvider"
        defaultValue={aiProvider}
        hint="If it's unavailable, the other provider answers instead when both are set up."
        errors={fieldErrors?.aiProvider}
      >
        <option value="openai">OpenAI</option>
        <option value="google">Google Gemini</option>
      </SelectField>
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save receptionist
      </Button>
    </form>
  );
}

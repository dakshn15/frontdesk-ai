"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Field, SelectField, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveWidgetSettings } from "@/features/widget/actions";
import type { WidgetSettings } from "@/features/widget/schemas";

export function WidgetForm({
  slug,
  settings,
}: {
  slug: string;
  settings: WidgetSettings;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveWidgetSettings.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Colour"
          name="widgetColor"
          type="color"
          defaultValue={settings.widgetColor}
          className="h-10 w-20 p-1"
          errors={fieldErrors?.widgetColor}
        />
        <SelectField
          label="Corner"
          name="widgetPosition"
          defaultValue={settings.widgetPosition}
          errors={fieldErrors?.widgetPosition}
        >
          <option value="right">Bottom right</option>
          <option value="left">Bottom left</option>
        </SelectField>
      </div>
      <TextareaField
        label="Greeting"
        name="widgetGreeting"
        defaultValue={settings.widgetGreeting}
        rows={2}
        maxLength={300}
        hint="The first message visitors see."
        errors={fieldErrors?.widgetGreeting}
      />
      <TextareaField
        label="Suggested questions"
        name="widgetSuggestions"
        defaultValue={settings.widgetSuggestions.join("\n")}
        rows={4}
        hint="One per line, up to 4. Visitors can tap one to ask it."
        errors={fieldErrors?.widgetSuggestions}
      />
      <TextareaField
        label="Allowed websites"
        name="allowedDomains"
        defaultValue={settings.allowedDomains.join("\n")}
        rows={3}
        hint="One domain per line, like bloomsalon.com. Subdomains are included. Until you add one, the chat works on any site."
        errors={fieldErrors?.allowedDomains}
      />
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save widget
      </Button>
    </form>
  );
}

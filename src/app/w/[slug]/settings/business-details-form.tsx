"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { updateWorkspaceDetails } from "@/features/workspaces/actions";
import type { Option } from "@/lib/locale-options";

export function BusinessDetailsForm({
  slug,
  details,
  timeZones,
  currencies,
}: {
  slug: string;
  details: {
    name: string;
    website: string | null;
    timezone: string;
    currency: string;
  };
  timeZones: Option[];
  currencies: Option[];
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    updateWorkspaceDetails.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Business name"
        name="name"
        autoComplete="organization"
        defaultValue={details.name}
        required
        errors={fieldErrors?.name}
      />
      <Field
        label="Website (optional)"
        name="website"
        inputMode="url"
        placeholder="bloomsalon.com"
        defaultValue={details.website ?? ""}
        errors={fieldErrors?.website}
      />
      <SearchableSelect
        name="timezone"
        label="Time zone"
        options={timeZones}
        defaultValue={details.timezone}
        errors={fieldErrors?.timezone}
      />
      <SearchableSelect
        name="currency"
        label="Currency"
        options={currencies}
        defaultValue={details.currency}
        errors={fieldErrors?.currency}
      />
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save changes
      </Button>
    </form>
  );
}

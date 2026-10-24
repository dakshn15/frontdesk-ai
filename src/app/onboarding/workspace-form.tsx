"use client";

import { useSyncExternalStore } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/features/workspaces/actions";
import type { Option } from "@/lib/locale-options";

const FALLBACK_TIME_ZONE = "America/Chicago";
const noSubscription = () => () => {};

function useBrowserTimeZone(): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

export function WorkspaceForm({
  timeZones,
  currencies,
}: {
  timeZones: Option[];
  currencies: Option[];
}) {
  const { onSubmit, pending, fieldErrors, formError } =
    useActionForm(createWorkspace);
  const browserZone = useBrowserTimeZone();
  const defaultZone =
    browserZone && timeZones.some((zone) => zone.value === browserZone)
      ? browserZone
      : FALLBACK_TIME_ZONE;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Business name"
        name="name"
        autoComplete="organization"
        required
        errors={fieldErrors?.name}
      />
      <Field
        label="Website (optional)"
        name="website"
        inputMode="url"
        placeholder="bloomsalon.com"
        errors={fieldErrors?.website}
      />
      {/* Remounts once the browser's time zone is known, so it becomes the default. */}
      <SearchableSelect
        key={defaultZone}
        name="timezone"
        label="Time zone"
        options={timeZones}
        defaultValue={defaultZone}
        errors={fieldErrors?.timezone}
      />
      <SearchableSelect
        name="currency"
        label="Currency"
        options={currencies}
        defaultValue="USD"
        errors={fieldErrors?.currency}
      />
      <Button type="submit" className="mt-2 h-10" disabled={pending}>
        Create workspace
      </Button>
    </form>
  );
}

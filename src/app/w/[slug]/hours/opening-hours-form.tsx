"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { WeeklyHoursEditor } from "@/components/business/weekly-hours-editor";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveOpeningHours } from "@/features/hours/actions";
import type { WeeklyHours } from "@/features/hours/weekly-hours";

export function OpeningHoursForm({
  slug,
  hours,
}: {
  slug: string;
  hours: WeeklyHours;
}) {
  const { state, onSubmit, pending, formError } = useActionForm(
    saveOpeningHours.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <WeeklyHoursEditor name="hours" defaultValue={hours} />
      <Button type="submit" className="h-10 w-fit px-4" disabled={pending}>
        Save hours
      </Button>
    </form>
  );
}

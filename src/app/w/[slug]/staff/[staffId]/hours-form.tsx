"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { WeeklyHoursEditor } from "@/components/business/weekly-hours-editor";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import type { WeeklyHours } from "@/features/hours/weekly-hours";
import { saveStaffHours } from "@/features/staff/actions";

export function HoursForm({
  slug,
  staffId,
  hours,
  openingHours,
}: {
  slug: string;
  staffId: string;
  hours: WeeklyHours;
  /** Offered as a starting point when the business has opening hours. */
  openingHours?: WeeklyHours;
}) {
  const { state, onSubmit, pending, formError } = useActionForm(
    saveStaffHours.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="staffId" value={staffId} />
      <WeeklyHoursEditor
        name="hours"
        defaultValue={hours}
        template={
          openingHours
            ? { label: "Copy opening hours", hours: openingHours }
            : undefined
        }
      />
      <Button type="submit" className="h-10 w-fit px-4" disabled={pending}>
        Save hours
      </Button>
    </form>
  );
}

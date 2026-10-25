"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Field, SelectField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveBookingRules } from "@/features/bookings/actions";
import type { BookingRules } from "@/features/bookings/availability";
import { SLOT_STEPS } from "@/features/bookings/schemas";

export function BookingRulesForm({
  slug,
  rules,
}: {
  slug: string;
  rules: BookingRules;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveBookingRules.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <SelectField
        label="Time between start times"
        name="slotStepMinutes"
        defaultValue={String(rules.slotStepMinutes)}
        hint="Customers see start times this far apart."
        errors={fieldErrors?.slotStepMinutes}
      >
        {SLOT_STEPS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} minutes
          </option>
        ))}
      </SelectField>
      <Field
        label="Minimum notice (hours)"
        name="minNoticeHours"
        type="number"
        inputMode="numeric"
        min={0}
        max={168}
        defaultValue={Math.round(rules.minNoticeMinutes / 60)}
        hint="How soon customers can book online. Staff can always book."
        errors={fieldErrors?.minNoticeHours}
      />
      <Field
        label="Book up to (days ahead)"
        name="maxDaysAhead"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        defaultValue={rules.maxDaysAhead}
        errors={fieldErrors?.maxDaysAhead}
      />
      <Field
        label="Cancellation window (hours)"
        name="cancellationWindowHours"
        type="number"
        inputMode="numeric"
        min={0}
        max={168}
        defaultValue={rules.cancellationWindowHours}
        hint="Closer than this to the start, customers can't cancel or move online."
        errors={fieldErrors?.cancellationWindowHours}
      />
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save rules
      </Button>
    </form>
  );
}

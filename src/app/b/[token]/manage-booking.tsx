"use client";

import { useState } from "react";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import {
  cancelManaged,
  rescheduleManaged,
} from "@/features/bookings/manage-actions";

type Mode = "idle" | "moving" | "cancelling";

/** Cancel or reschedule from the customer's manage link. */
export function ManageBooking({
  token,
  timeZone,
  date: bookedDate,
  today,
}: {
  token: string;
  timeZone: string;
  date: string;
  today: string;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [date, setDate] = useState(bookedDate);
  const cancel = useActionForm(() => cancelManaged(token));
  const move = useActionForm(rescheduleManaged.bind(null, token));

  if (move.state?.ok) {
    return (
      <FormMessage tone="success">
        Your appointment has moved. We&apos;ve emailed you the new time.
      </FormMessage>
    );
  }

  if (mode === "moving") {
    return (
      <form onSubmit={move.onSubmit} className="grid gap-4" noValidate>
        {move.formError ? (
          <FormMessage tone="error">{move.formError}</FormMessage>
        ) : null}
        <Field
          label="New date"
          name="date"
          type="date"
          min={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <SlotPicker
          key={date}
          token={token}
          date={date}
          timeZone={timeZone}
          errors={move.fieldErrors?.startsAt}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-10 px-4" disabled={move.pending}>
            Confirm new time
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-4"
            onClick={() => setMode("idle")}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "cancelling") {
    return (
      <form
        onSubmit={cancel.onSubmit}
        className="grid gap-3 rounded-xl border p-4"
      >
        {cancel.formError ? (
          <FormMessage tone="error">{cancel.formError}</FormMessage>
        ) : null}
        <p className="text-sm">Cancel this appointment?</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="destructive"
            className="h-10 px-4"
            disabled={cancel.pending}
          >
            Cancel appointment
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-4"
            onClick={() => setMode("idle")}
          >
            Keep it
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="h-10 px-4" onClick={() => setMode("moving")}>
        Reschedule
      </Button>
      <Button
        variant="outline"
        className="h-10 px-4"
        onClick={() => setMode("cancelling")}
      >
        Cancel appointment
      </Button>
    </div>
  );
}

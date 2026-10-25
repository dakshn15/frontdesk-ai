"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { addTimeOff, deleteTimeOff } from "@/features/staff/actions";

type Entry = { id: string; label: string; note: string };

export function TimeOff({
  slug,
  staffId,
  entries,
}: {
  slug: string;
  staffId: string;
  entries: Entry[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    addTimeOff.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="grid gap-6">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="group/time-off grid max-w-md gap-4"
        noValidate
      >
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        <input type="hidden" name="staffId" value={staffId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="From"
            name="startDate"
            type="date"
            required
            errors={fieldErrors?.startDate}
          />
          <Field
            label="To"
            name="endDate"
            type="date"
            required
            errors={fieldErrors?.endDate}
          />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            id="time-off-all-day"
            type="checkbox"
            name="allDay"
            defaultChecked
            className="size-4 accent-primary"
          />
          All day
        </label>
        {/* Times only matter when it isn't all day. CSS hides them, so a reset brings them back. */}
        <div className="grid gap-4 group-has-[#time-off-all-day:checked]/time-off:hidden sm:grid-cols-2">
          <Field
            label="Start time"
            name="startTime"
            type="time"
            step={300}
            errors={fieldErrors?.startTime}
          />
          <Field
            label="End time"
            name="endTime"
            type="time"
            step={300}
            errors={fieldErrors?.endTime}
          />
        </div>
        <Field
          label="Note (optional)"
          name="note"
          placeholder="Holiday"
          errors={fieldErrors?.note}
        />
        <Button
          type="submit"
          className="mt-2 h-10 w-fit px-4"
          disabled={pending}
        >
          Add time off
        </Button>
      </form>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No time off coming up.
        </p>
      ) : (
        <ul
          aria-label="Time off coming up"
          className="divide-y rounded-xl border"
        >
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{entry.label}</p>
                {entry.note ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {entry.note}
                  </p>
                ) : null}
              </div>
              <RemoveTimeOffButton slug={slug} entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemoveTimeOffButton({ slug, entry }: { slug: string; entry: Entry }) {
  const { state, onSubmit, pending } = useActionForm(
    deleteTimeOff.bind(null, slug),
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="timeOffId" value={entry.id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-9"
        aria-label={`Remove time off ${entry.label}`}
        disabled={pending}
      >
        <Trash2 />
        Remove
      </Button>
    </form>
  );
}

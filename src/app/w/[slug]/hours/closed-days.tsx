"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { addClosedDay, deleteClosedDay } from "@/features/hours/actions";

type ClosedDay = { id: string; label: string; name: string };

export function ClosedDays({ slug, days }: { slug: string; days: ClosedDay[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    addClosedDay.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="grid gap-6">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="grid gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-start"
        noValidate
      >
        {formError ? (
          <div className="sm:col-span-3">
            <FormMessage tone="error">{formError}</FormMessage>
          </div>
        ) : null}
        <Field
          label="Date"
          name="date"
          type="date"
          required
          errors={fieldErrors?.date}
        />
        <Field
          label="Name (optional)"
          name="name"
          placeholder="Christmas Day"
          errors={fieldErrors?.name}
        />
        <Button
          type="submit"
          className="h-10 w-fit px-4 sm:mt-5"
          disabled={pending}
        >
          Add closed day
        </Button>
      </form>

      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No closed days coming up.
        </p>
      ) : (
        <ul aria-label="Closed days coming up" className="divide-y rounded-xl border">
          {days.map((day) => (
            <li key={day.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{day.label}</p>
                {day.name ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {day.name}
                  </p>
                ) : null}
              </div>
              <RemoveClosedDayButton slug={slug} day={day} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemoveClosedDayButton({ slug, day }: { slug: string; day: ClosedDay }) {
  const { state, onSubmit, pending } = useActionForm(
    deleteClosedDay.bind(null, slug),
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="closedDayId" value={day.id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-9"
        aria-label={`Remove ${day.label}`}
        disabled={pending}
      >
        <Trash2 />
        Remove
      </Button>
    </form>
  );
}

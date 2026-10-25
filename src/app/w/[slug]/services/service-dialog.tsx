"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckboxField, Field, TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveService } from "@/features/services/actions";
import type { Service } from "@/features/services/queries";
import { centsToInput } from "@/lib/money";

type Props = {
  slug: string;
  currency: string;
  categories: string[];
  service?: Service;
};

/** "Add service", or "Edit" on a row when `service` is given. */
export function ServiceDialog(props: Props) {
  const [open, setOpen] = useState(false);
  // A new key each time it opens gives a fresh form.
  const [session, setSession] = useState(0);
  const { service } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((count) => count + 1);
      }}
    >
      {service ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              aria-label={`Edit ${service.name}`}
            />
          }
        >
          <Pencil />
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="h-9 px-3" />}>
          <Plus />
          Add service
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <ServiceForm key={session} {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({
  slug,
  currency,
  categories,
  service,
  onDone,
}: Props & { onDone: () => void }) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveService.bind(null, slug),
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success("Saved.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{service ? "Edit service" : "Add a service"}</DialogTitle>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="serviceId" value={service?.id ?? ""} />
      <Field
        label="Name"
        name="name"
        defaultValue={service?.name}
        required
        errors={fieldErrors?.name}
      />
      <Field
        label="Category (optional)"
        name="category"
        list="service-categories"
        placeholder="Colour"
        defaultValue={service?.category}
        errors={fieldErrors?.category}
      />
      <datalist id="service-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <TextareaField
        label="Description (optional)"
        name="description"
        rows={3}
        defaultValue={service?.description}
        errors={fieldErrors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Duration (minutes)"
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={5}
          max={720}
          step={5}
          defaultValue={service?.durationMinutes ?? 60}
          errors={fieldErrors?.durationMinutes}
        />
        <Field
          label="Buffer after (minutes)"
          name="bufferMinutes"
          type="number"
          inputMode="numeric"
          min={0}
          max={240}
          step={5}
          hint="Cleanup time before the next booking."
          defaultValue={service?.bufferMinutes ?? 0}
          errors={fieldErrors?.bufferMinutes}
        />
      </div>
      <Field
        label="Price (optional)"
        name="price"
        inputMode="decimal"
        hint={`In ${currency}. Leave blank if it varies.`}
        defaultValue={service ? centsToInput(service.priceCents, currency) : ""}
        errors={fieldErrors?.price}
      />
      <div className="grid gap-2.5">
        <CheckboxField
          label="Show as a starting price"
          name="priceIsFrom"
          defaultChecked={service?.priceIsFrom ?? false}
        />
        <CheckboxField
          label="Customers can book this online"
          name="bookableOnline"
          defaultChecked={service?.bookableOnline ?? true}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Save service
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, SelectField, TextareaField } from "@/components/forms/field";
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
import { createBooking } from "@/features/bookings/actions";
import { SlotPicker } from "./slot-picker";

export type ServiceOption = { id: string; name: string };
export type StaffOption = { id: string; name: string; serviceIds: string[] };

type Props = {
  slug: string;
  date: string;
  timeZone: string;
  services: ServiceOption[];
  staff: StaffOption[];
};

export function NewBookingDialog(props: Props) {
  const [open, setOpen] = useState(false);
  // A new key each time it opens gives a fresh form.
  const [session, setSession] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSession((count) => count + 1);
      }}
    >
      <DialogTrigger render={<Button className="h-9 px-3" />}>
        <Plus />
        New booking
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <NewBookingForm
          key={session}
          {...props}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewBookingForm({
  slug,
  date: initialDate,
  timeZone,
  services,
  staff,
  onDone,
}: Props & { onDone: () => void }) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    createBooking.bind(null, slug),
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [chosenStaff, setChosenStaff] = useState("any");
  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Booked.");
      onDone();
    }
  }, [state, onDone]);

  const qualified = staff.filter((person) =>
    person.serviceIds.includes(serviceId),
  );
  // A person who doesn't do the newly chosen service falls back to "Any available".
  const staffId = qualified.some((person) => person.id === chosenStaff)
    ? chosenStaff
    : "any";

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>New booking</DialogTitle>
      </DialogHeader>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <SelectField
        label="Service"
        name="serviceId"
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
        errors={fieldErrors?.serviceId}
      >
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Staff member"
          name="staffId"
          value={staffId}
          onChange={(event) => setChosenStaff(event.target.value)}
          errors={fieldErrors?.staffId}
        >
          <option value="any">Any available</option>
          {qualified.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Date"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <SlotPicker
        key={`${serviceId}|${staffId}|${date}`}
        slug={slug}
        serviceId={serviceId}
        staffId={staffId}
        date={date}
        timeZone={timeZone}
        errors={fieldErrors?.startsAt}
      />
      <Field
        label="Customer name"
        name="name"
        autoComplete="off"
        errors={fieldErrors?.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          hint="The confirmation and manage link go here."
          errors={fieldErrors?.email}
        />
        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="off"
          errors={fieldErrors?.phone}
        />
      </div>
      <TextareaField
        label="Notes (optional)"
        name="notes"
        rows={2}
        errors={fieldErrors?.notes}
      />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Book appointment
        </Button>
      </DialogFooter>
    </form>
  );
}

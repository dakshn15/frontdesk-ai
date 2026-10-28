"use client";

import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, SelectField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  rescheduleBooking,
  updateBookingStatus,
} from "@/features/bookings/actions";
import { localMinutes } from "@/features/bookings/calendar-layout";
import { formatClock, localDate } from "@/lib/clock";
import { cn } from "@/lib/utils";
import type { StaffOption } from "./new-booking-dialog";
import { SlotPicker } from "@/components/booking/slot-picker";

export type CalendarBooking = {
  id: string;
  staffId: string | null;
  staffName: string;
  serviceId: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: "confirmed" | "completed" | "no_show" | "cancelled";
  notes: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

const STATUS_LABEL = {
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
} as const;

export function timeRange(booking: CalendarBooking, timeZone: string) {
  const start = formatClock(localMinutes(new Date(booking.startsAt), timeZone));
  const end = formatClock(localMinutes(new Date(booking.endsAt), timeZone));
  return `${start} – ${end}`;
}

/** A booking on the grid; clicking it opens its details. */
export function BookingBlock({
  slug,
  booking,
  timeZone,
  staff,
  style,
}: {
  slug: string;
  booking: CalendarBooking;
  timeZone: string;
  staff: StaffOption[];
  style: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's success effect runs once per result.
  const close = useCallback(() => setOpen(false), []);
  const customer = booking.customerName ?? "Deleted customer";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={style}
        aria-label={`${customer}, ${booking.serviceName}, ${timeRange(booking, timeZone)}`}
        className={cn(
          "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          booking.status === "confirmed" &&
            "border-primary/30 bg-primary-soft hover:bg-primary-soft/80",
          booking.status === "completed" &&
            "border-border bg-muted text-foreground",
          booking.status === "no_show" &&
            "border-destructive/30 bg-destructive/10 text-red-800 dark:text-red-200",
        )}
      >
        <span className="block truncate font-medium">{customer}</span>
        <span className="block truncate">{booking.serviceName}</span>
        <span className="block truncate">{timeRange(booking, timeZone)}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {open ? (
            <BookingDetails
              slug={slug}
              booking={booking}
              timeZone={timeZone}
              staff={staff}
              onDone={close}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingDetails({
  slug,
  booking,
  timeZone,
  staff,
  onDone,
}: {
  slug: string;
  booking: CalendarBooking;
  timeZone: string;
  staff: StaffOption[];
  onDone: () => void;
}) {
  const [moving, setMoving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const status = useActionForm(updateBookingStatus.bind(null, slug));

  useEffect(() => {
    if (status.state?.ok) {
      toast.success("Saved.");
      onDone();
    }
  }, [status.state, onDone]);

  const day = new Date(booking.startsAt).toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const statusButton = (
    value: "completed" | "no_show" | "cancelled",
    label: string,
    variant: "outline" | "destructive" = "outline",
  ) => (
    <Button
      type="submit"
      name="status"
      value={value}
      variant={variant}
      className="h-9 px-3"
      disabled={status.pending}
    >
      {label}
    </Button>
  );

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{booking.customerName ?? "Deleted customer"}</DialogTitle>
        <DialogDescription>
          {booking.serviceName} with {booking.staffName}
        </DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">When</dt>
        <dd>
          {day}, {timeRange(booking, timeZone)}
        </dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant="secondary">{STATUS_LABEL[booking.status]}</Badge>
        </dd>
        {booking.customerEmail ? (
          <>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{booking.customerEmail}</dd>
          </>
        ) : null}
        {booking.customerPhone ? (
          <>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{booking.customerPhone}</dd>
          </>
        ) : null}
        {booking.notes ? (
          <>
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{booking.notes}</dd>
          </>
        ) : null}
      </dl>

      {status.formError ? (
        <FormMessage tone="error">{status.formError}</FormMessage>
      ) : null}

      {moving && booking.serviceId ? (
        <RescheduleForm
          slug={slug}
          booking={booking}
          serviceId={booking.serviceId}
          timeZone={timeZone}
          staff={staff}
          onDone={onDone}
          onCancel={() => setMoving(false)}
        />
      ) : confirmingCancel ? (
        <form
          onSubmit={status.onSubmit}
          className="grid gap-3 rounded-lg border p-3"
        >
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="status" value="cancelled" />
          <p className="text-sm">
            Cancel this booking? The time becomes free again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              className="h-9 px-3"
              disabled={status.pending}
            >
              Cancel booking
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3"
              onClick={() => setConfirmingCancel(false)}
            >
              Keep it
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={status.onSubmit} className="flex flex-wrap gap-2">
          <input type="hidden" name="bookingId" value={booking.id} />
          {booking.status === "confirmed" && booking.serviceId ? (
            <Button
              type="button"
              className="h-9 px-3"
              onClick={() => setMoving(true)}
            >
              Reschedule
            </Button>
          ) : null}
          {booking.status !== "completed"
            ? statusButton("completed", "Mark completed")
            : null}
          {booking.status !== "no_show"
            ? statusButton("no_show", "Mark no-show")
            : null}
          {booking.status === "confirmed" ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-destructive"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel booking
            </Button>
          ) : null}
        </form>
      )}
    </div>
  );
}

function RescheduleForm({
  slug,
  booking,
  serviceId,
  timeZone,
  staff,
  onDone,
  onCancel,
}: {
  slug: string;
  booking: CalendarBooking;
  serviceId: string;
  timeZone: string;
  staff: StaffOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    rescheduleBooking.bind(null, slug),
  );
  const qualified = staff.filter((person) =>
    person.serviceIds.includes(serviceId),
  );
  const [staffId, setStaffId] = useState(
    booking.staffId ?? qualified[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    localDate(timeZone, new Date(booking.startsAt)),
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Moved.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-lg border p-3"
      noValidate
    >
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="bookingId" value={booking.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Staff member"
          name="staffId"
          value={staffId}
          onChange={(event) => setStaffId(event.target.value)}
          errors={fieldErrors?.staffId}
        >
          {qualified.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="New date"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <SlotPicker
        key={`${staffId}|${date}`}
        slug={slug}
        serviceId={serviceId}
        staffId={staffId}
        date={date}
        timeZone={timeZone}
        excludeBookingId={booking.id}
        errors={fieldErrors?.startsAt}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-9 px-3" disabled={pending}>
          Move booking
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3"
          onClick={onCancel}
        >
          Back
        </Button>
      </div>
    </form>
  );
}

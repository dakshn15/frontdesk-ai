"use client";

import { useEffect, useState, useTransition } from "react";
import { loadSlots } from "@/features/bookings/actions";
import { localMinutes } from "@/features/bookings/calendar-layout";
import { loadManagedSlots } from "@/features/bookings/manage-actions";
import type { SlotChoice } from "@/features/bookings/schemas";
import { formatClock } from "@/lib/clock";
import { cn } from "@/lib/utils";

/** Where the times come from: a signed-in member, or a customer's manage link. */
type Source =
  | {
      slug: string;
      serviceId: string;
      staffId: string;
      excludeBookingId?: string;
      token?: never;
    }
  | {
      token: string;
      slug?: never;
      serviceId?: never;
      staffId?: never;
      excludeBookingId?: never;
    };

/**
 * Free start times as buttons; the chosen time is sent as `startsAt`. Give it a new key
 * when the service, person or date changes, so the choice resets.
 */
export function SlotPicker({
  date,
  timeZone,
  errors,
  ...source
}: Source & { date: string; timeZone: string; errors?: string[] }) {
  const [slots, setSlots] = useState<SlotChoice[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [pending, startTransition] = useTransition();
  const { token, slug, serviceId, staffId, excludeBookingId } = source;

  useEffect(() => {
    if (!date || (!token && (!serviceId || !staffId))) return;
    startTransition(async () => {
      const result = token
        ? await loadManagedSlots(token, date)
        : await loadSlots(slug ?? "", {
            serviceId: serviceId ?? "",
            staffId: staffId ?? "",
            date,
            excludeBookingId,
          });
      setSlots(result.ok ? result.data : []);
    });
  }, [token, slug, serviceId, staffId, excludeBookingId, date]);

  // With "any available", several people share a time; show each time once.
  const times = [...new Set((slots ?? []).map((slot) => slot.startsAt))];
  const errorId = "slot-picker-error";

  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={errors ? errorId : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">Time</legend>
      <input type="hidden" name="startsAt" value={chosen} />
      {!token && !serviceId ? (
        <p className="text-sm text-muted-foreground">Pick a service first.</p>
      ) : pending || slots === null ? (
        <p className="text-sm text-muted-foreground">Finding free times…</p>
      ) : times.length === 0 ? (
        <p className="text-sm text-muted-foreground">No free times that day.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {times.map((startsAt) => (
            <button
              key={startsAt}
              type="button"
              aria-pressed={chosen === startsAt}
              onClick={() => setChosen(startsAt)}
              className={cn(
                "h-9 rounded-lg border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                chosen === startsAt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {formatClock(localMinutes(new Date(startsAt), timeZone))}
            </button>
          ))}
        </div>
      )}
      {errors?.length ? (
        <p id={errorId} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

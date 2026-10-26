"use client";

import { CalendarCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { WidgetPost } from "./widget-api";
import { WidgetField } from "./widget-fields";

export type BookingOffer = {
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  startsAt: string;
  label: string;
  duration: string;
  price: string;
};

/** The time in the visitor's own zone, when it differs from the business's. */
function visitorTime(startsAt: string, businessZone: string): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone || zone === businessZone) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startsAt));
}

/** A time the receptionist offered. The visitor books it with their name and email. */
export function BookingCard({
  offer,
  timeZone,
  brand,
  onBrand,
  post,
  onBooked,
}: {
  offer: BookingOffer;
  timeZone: string;
  brand: string;
  onBrand: string;
  post: WidgetPost;
  onBooked: (message: string) => void;
}) {
  const [step, setStep] = useState<"offer" | "details" | "booked">("offer");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const local = visitorTime(offer.startsAt, timeZone);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await post("/api/widget/book", {
      serviceId: offer.serviceId,
      staffId: offer.staffId,
      startsAt: offer.startsAt,
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
    });
    setPending(false);
    if (result.ok && result.data.message) {
      setStep("booked");
      onBooked(result.data.message);
      return;
    }
    setFieldErrors(result.data.fieldErrors ?? {});
    setError(result.data.error ?? "Couldn't book that. Try again.");
  }

  return (
    <section
      aria-label={`Booking: ${offer.serviceName}`}
      className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900"
    >
      <div className="flex items-start gap-2">
        <CalendarCheck className="mt-0.5 size-4 shrink-0 text-zinc-500" />
        <div className="grid gap-0.5">
          <p className="font-medium">
            {offer.serviceName} with {offer.staffName}
          </p>
          <p>{offer.label}</p>
          {local ? (
            <p className="text-xs text-zinc-500">Your time: {local}</p>
          ) : null}
          <p className="text-xs text-zinc-500">
            {offer.duration} · {offer.price}
          </p>
        </div>
      </div>

      {step === "offer" ? (
        <button
          type="button"
          onClick={() => setStep("details")}
          className="mt-3 h-9 w-full rounded-lg text-sm font-medium"
          style={{ background: brand, color: onBrand }}
        >
          Book this time
        </button>
      ) : null}

      {step === "details" ? (
        <form onSubmit={onSubmit} className="mt-3 grid gap-2" noValidate>
          <WidgetField
            label="Name"
            name="name"
            autoComplete="name"
            maxLength={120}
            required
            errors={fieldErrors.name}
          />
          <WidgetField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            errors={fieldErrors.email}
          />
          <WidgetField
            label="Phone (optional)"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            errors={fieldErrors.phone}
          />
          {error ? (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ background: brand, color: onBrand }}
          >
            {pending ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      ) : null}

      {step === "booked" ? (
        <p className="mt-3 text-xs font-medium text-emerald-700">Booked.</p>
      ) : null}
    </section>
  );
}

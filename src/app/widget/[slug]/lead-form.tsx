"use client";

import { type FormEvent, useState } from "react";
import type { WidgetPost } from "./widget-api";
import { WidgetField } from "./widget-fields";

/** Name, email and a note, so the team can get back to the visitor. */
export function LeadForm({
  intro,
  brand,
  onBrand,
  post,
  onCancel,
}: {
  intro: string;
  brand: string;
  onBrand: string;
  post: WidgetPost;
  onCancel?: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await post("/api/widget/lead", {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      message: form.get("message"),
    });
    setPending(false);
    if (result.ok) {
      setSent(true);
      return;
    }
    setFieldErrors(result.data.fieldErrors ?? {});
    setError(result.data.error ?? "Couldn't send that. Try again.");
  }

  if (sent) {
    return (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
      >
        Thanks. The team will get back to you by email.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Leave your details"
      className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3"
      noValidate
    >
      <p className="text-sm text-zinc-700">{intro}</p>
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
      <WidgetField
        label="Message (optional)"
        name="message"
        multiline
        maxLength={1000}
        errors={fieldErrors.message}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 flex-1 rounded-lg text-sm font-medium disabled:opacity-60"
          style={{ background: brand, color: onBrand }}
        >
          {pending ? "Sending…" : "Send"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

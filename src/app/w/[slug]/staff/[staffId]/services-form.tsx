"use client";

import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckboxField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveStaffServices } from "@/features/staff/actions";

export function ServicesForm({
  slug,
  staffId,
  services,
  selected,
}: {
  slug: string;
  staffId: string;
  services: { id: string; name: string }[];
  selected: string[];
}) {
  const { state, onSubmit, pending, formError } = useActionForm(
    saveStaffServices.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  if (services.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No services yet.{" "}
        <Link
          href={`/w/${slug}/services`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Add services
        </Link>{" "}
        first, then choose who performs them.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="staffId" value={staffId} />
      <fieldset className="grid gap-2.5 sm:grid-cols-2">
        <legend className="sr-only">Services this person performs</legend>
        {services.map((service) => (
          <CheckboxField
            key={service.id}
            label={service.name}
            name="serviceIds"
            value={service.id}
            defaultChecked={selected.includes(service.id)}
          />
        ))}
      </fieldset>
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save services
      </Button>
    </form>
  );
}

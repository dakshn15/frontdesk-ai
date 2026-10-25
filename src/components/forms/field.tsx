import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Described = {
  label: string;
  name: string;
  hint?: string;
  errors?: string[];
};

/** Ids that tie a control to its hint and error, for screen readers. */
function describedBy(id: string, hint?: string, errors?: string[]) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return {
    hintId,
    errorId,
    props: {
      "aria-invalid": errors?.length ? true : undefined,
      "aria-describedby":
        [hintId, errorId].filter(Boolean).join(" ") || undefined,
    },
  };
}

function FieldShell({
  id,
  label,
  hint,
  errors,
  hintId,
  errorId,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled input with an optional hint and its validation errors. */
export function Field({
  label,
  name,
  hint,
  errors,
  id,
  ...input
}: ComponentProps<"input"> & Described) {
  const inputId = id ?? `field-${name}`;
  const { hintId, errorId, props } = describedBy(inputId, hint, errors);
  return (
    <FieldShell {...{ id: inputId, label, hint, errors, hintId, errorId }}>
      <Input id={inputId} name={name} className="h-10" {...props} {...input} />
    </FieldShell>
  );
}

/** A labelled multi-line text box. */
export function TextareaField({
  label,
  name,
  hint,
  errors,
  id,
  ...textarea
}: ComponentProps<"textarea"> & Described) {
  const inputId = id ?? `field-${name}`;
  const { hintId, errorId, props } = describedBy(inputId, hint, errors);
  return (
    <FieldShell {...{ id: inputId, label, hint, errors, hintId, errorId }}>
      <Textarea id={inputId} name={name} {...props} {...textarea} />
    </FieldShell>
  );
}

/** A labelled native select; pass the options as children. */
export function SelectField({
  label,
  name,
  hint,
  errors,
  id,
  ...select
}: ComponentProps<"select"> & Described) {
  const inputId = id ?? `field-${name}`;
  const { hintId, errorId, props } = describedBy(inputId, hint, errors);
  return (
    <FieldShell {...{ id: inputId, label, hint, errors, hintId, errorId }}>
      <select
        id={inputId}
        name={name}
        className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        {...props}
        {...select}
      />
    </FieldShell>
  );
}

/** A checkbox with its label beside it. Sends `value` ("on" by default) when ticked. */
export function CheckboxField({
  label,
  name,
  value,
  defaultChecked,
}: {
  label: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

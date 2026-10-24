import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  errors?: string[];
};

/** A labelled input with an optional hint and its validation errors, wired for screen readers. */
export function Field({ label, name, hint, errors, id, ...input }: FieldProps) {
  const inputId = id ?? `field-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = errors?.length ? `${inputId}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(" ") || undefined
        }
        className="h-10"
        {...input}
      />
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

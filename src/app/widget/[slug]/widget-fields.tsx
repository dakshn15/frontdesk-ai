import type { ComponentProps } from "react";

/** A labelled input for the widget's small forms, with its error under it. */
export function WidgetField({
  label,
  name,
  errors,
  multiline,
  ...props
}: {
  label: string;
  name: string;
  errors?: string[];
  multiline?: boolean;
} & ComponentProps<"input">) {
  const id = `widget-${name}`;
  const error = errors?.[0];
  const shared = {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className:
      "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  };
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          rows={2}
          maxLength={props.maxLength}
          required={props.required}
        />
      ) : (
        <input {...shared} {...props} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

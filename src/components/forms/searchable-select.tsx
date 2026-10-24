"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Option } from "@/lib/locale-options";
import { cn } from "@/lib/utils";

/** A long list (time zones, currencies) you can search, submitted through a hidden input. */
export function SearchableSelect({
  name,
  label,
  options,
  defaultValue,
  placeholder = "Choose one",
  errors,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
  errors?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const selected = options.find((option) => option.value === value);
  const id = `field-${name}`;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={errors?.length ? true : undefined}
              aria-describedby={errorId}
              className="h-10 w-full justify-between px-2.5 font-normal"
            />
          }
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) p-0">
          <Command>
            <CommandInput placeholder="Search" />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      setValue(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {errors?.length ? (
        <p id={errorId} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

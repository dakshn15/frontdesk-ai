"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type TimeRange,
  WEEKDAYS,
  type Weekday,
  type WeeklyHours,
} from "@/features/hours/weekly-hours";
import { clockToMinutes, minutesToClock } from "@/lib/clock";

const NEW_RANGE: TimeRange = { start: 540, end: 1020 };
const MAX_RANGES = 4;
// The clock icon crowds out "AM" and "PM" on narrow screens; typing or tapping still works.
const TIME_INPUT =
  "h-9 w-[7.5rem] max-sm:[&::-webkit-calendar-picker-indicator]:hidden";

type Props = {
  name: string;
  defaultValue: WeeklyHours;
  /** A week to copy in with one click, such as the business's opening hours. */
  template?: { label: string; hours: WeeklyHours };
};

/**
 * Edits a week of time ranges and submits it as JSON in a hidden input called `name`.
 * Native time inputs stop at 23:59, so a closing time of 00:00 means midnight (1440).
 */
export function WeeklyHoursEditor({ name, defaultValue, template }: Props) {
  const [hours, setHours] = useState(defaultValue);
  const setDay = (day: Weekday, ranges: TimeRange[]) =>
    setHours((week) => ({ ...week, [day]: ranges }));

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(hours)} />
      {template ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 w-fit px-3"
          onClick={() => setHours(structuredClone(template.hours))}
        >
          {template.label}
        </Button>
      ) : null}
      <div className="divide-y rounded-xl border">
        {WEEKDAYS.map(({ day, label }) => {
          const ranges = hours[day];
          const openId = `${name}-${day}-open`;
          return (
            <div
              key={day}
              className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3"
            >
              <label
                htmlFor={openId}
                className="flex h-9 w-32 items-center gap-2.5 text-sm font-medium"
              >
                <input
                  id={openId}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={ranges.length > 0}
                  onChange={(event) =>
                    setDay(day, event.target.checked ? [NEW_RANGE] : [])
                  }
                />
                <span>
                  <span className="sr-only">Open on </span>
                  {label}
                </span>
              </label>
              {ranges.length === 0 ? (
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  Closed
                </p>
              ) : (
                <div className="grid gap-2">
                  {ranges.map((range, index) => (
                    <RangeRow
                      key={index}
                      label={label}
                      suffix={index === 0 ? "" : ` (${index + 1})`}
                      range={range}
                      onChange={(next) =>
                        setDay(
                          day,
                          ranges.map((r, i) => (i === index ? next : r)),
                        )
                      }
                      onRemove={() =>
                        setDay(
                          day,
                          ranges.filter((_, i) => i !== index),
                        )
                      }
                    />
                  ))}
                  {ranges.length < MAX_RANGES ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit"
                      aria-label={`Add hours on ${label}`}
                      onClick={() => setDay(day, [...ranges, NEW_RANGE])}
                    >
                      <Plus />
                      Add hours
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RangeRow({
  label,
  suffix,
  range,
  onChange,
  onRemove,
}: {
  label: string;
  suffix: string;
  range: TimeRange;
  onChange: (range: TimeRange) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        step={300}
        aria-label={`${label} opens${suffix}`}
        className={TIME_INPUT}
        value={minutesToClock(range.start)}
        onChange={(event) => {
          const minutes = clockToMinutes(event.target.value);
          if (minutes !== null && minutes < 1440) {
            onChange({ ...range, start: minutes });
          }
        }}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="time"
        step={300}
        aria-label={`${label} closes${suffix}`}
        className={TIME_INPUT}
        value={minutesToClock(range.end === 1440 ? 0 : range.end)}
        onChange={(event) => {
          const minutes = clockToMinutes(event.target.value);
          if (minutes !== null) {
            onChange({ ...range, end: minutes === 0 ? 1440 : minutes });
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${label} hours${suffix}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

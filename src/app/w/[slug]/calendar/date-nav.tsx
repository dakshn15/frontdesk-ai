"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/clock";
import { cn } from "@/lib/utils";

/** Previous day, today, next day, and a date box that jumps to any day. */
export function DateNav({
  slug,
  date,
  today,
}: {
  slug: string;
  date: string;
  today: string;
}) {
  const router = useRouter();
  const href = (day: string) => `/w/${slug}/calendar?date=${day}`;
  const outline = buttonVariants({ variant: "outline" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href(addDays(date, -1))}
        aria-label="Previous day"
        className={cn(outline, "size-9 px-0")}
      >
        <ChevronLeft />
      </Link>
      <Link href={href(today)} className={cn(outline, "h-9 px-3")}>
        Today
      </Link>
      <Link
        href={href(addDays(date, 1))}
        aria-label="Next day"
        className={cn(outline, "size-9 px-0")}
      >
        <ChevronRight />
      </Link>
      <Input
        type="date"
        aria-label="Go to date"
        className="h-9 w-auto"
        value={date}
        onChange={(event) => {
          if (event.target.value) router.push(href(event.target.value));
        }}
      />
    </div>
  );
}

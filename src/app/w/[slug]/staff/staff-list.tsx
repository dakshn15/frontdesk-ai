import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { StaffSummary } from "@/features/staff/queries";

const servicesLabel = (count: number) =>
  `${count} ${count === 1 ? "service" : "services"}`;

export function StaffList({
  slug,
  staff,
}: {
  slug: string;
  staff: StaffSummary[];
}) {
  return (
    <ul aria-label="Staff" className="mt-8 divide-y rounded-xl border">
      {staff.map((person) => (
        <li key={person.id}>
          <Link
            href={`/w/${slug}/staff/${person.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-medium">{person.name}</p>
              {person.title ? (
                <p className="truncate text-sm text-muted-foreground">
                  {person.title}
                </p>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground">
              {servicesLabel(person.serviceCount)}
            </span>
            {person.hasHours ? null : (
              <Badge variant="outline">No hours set</Badge>
            )}
            {person.active ? null : <Badge variant="secondary">Inactive</Badge>}
            <ChevronRight
              aria-hidden
              className="size-4 text-muted-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

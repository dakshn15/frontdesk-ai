import { ChevronRight, Circle, CircleCheck } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SetupStep } from "@/features/setup/checklist";

export function SetupChecklist({
  steps,
  doneCount,
  total,
}: {
  steps: SetupStep[];
  doneCount: number;
  total: number;
}) {
  const complete = doneCount === total;
  return (
    <Card role="region" aria-labelledby="setup-title">
      <CardHeader>
        <CardTitle id="setup-title">Set up your receptionist</CardTitle>
        <CardDescription>
          {complete
            ? "Your business details are complete."
            : `${doneCount} of ${total} done`}
        </CardDescription>
        <div
          aria-hidden
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      </CardHeader>
      {complete ? null : (
        <CardContent>
          <ul className="-mx-2 grid gap-0.5 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {step.done ? (
                    <CircleCheck aria-hidden className="size-4 text-primary" />
                  ) : (
                    <Circle
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  )}
                  <span
                    className={
                      step.done
                        ? "flex-1 text-muted-foreground"
                        : "flex-1 font-medium"
                    }
                  >
                    {step.label}
                    <span className="sr-only">
                      {step.done ? " (done)" : " (to do)"}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

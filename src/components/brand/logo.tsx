import { ConciergeBell } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <ConciergeBell className="size-[18px]" strokeWidth={2.25} />
      </span>
      {showName ? (
        <span className="text-[15px] font-semibold tracking-tight">
          FrontDesk AI
        </span>
      ) : (
        <span className="sr-only">FrontDesk AI</span>
      )}
    </span>
  );
}

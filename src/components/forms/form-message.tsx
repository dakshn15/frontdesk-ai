import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A form-level message: what went wrong, or what happened next. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary-soft text-foreground",
      )}
    >
      {children}
    </div>
  );
}

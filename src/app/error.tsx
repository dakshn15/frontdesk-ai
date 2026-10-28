"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shown when a page fails to load. The details go to the server logs, not the screen. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("page error", error.digest ?? error.message);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page didn&apos;t load. Try again; if it keeps happening, wait a
        minute and reload.
        {error.digest ? ` Reference: ${error.digest}.` : ""}
      </p>
      <Button type="button" className="mt-6 w-fit px-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}

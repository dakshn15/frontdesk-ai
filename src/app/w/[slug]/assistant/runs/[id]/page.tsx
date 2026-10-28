import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { costOf, formatUsd } from "@/features/analytics/prices";
import { getRun } from "@/features/testlab/queries";
import { requireManager } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { RefreshWhileRunning } from "../../tests/test-controls";

export const metadata: Metadata = { title: "Test run" };

export default async function RunPage({
  params,
}: PageProps<"/w/[slug]/assistant/runs/[id]">) {
  const { slug, id } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  if (!z.uuid().safeParse(id).success) notFound();
  const found = await getRun(claims, workspace.id, id);
  if (!found) notFound();
  const { run, results } = found;
  const running = run.status === "running";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:py-10">
      <RefreshWhileRunning running={running} />
      <Link
        href={`/w/${slug}/assistant/tests`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tests
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {running
          ? `Running ${results.length + 1} of ${run.total}…`
          : run.status === "failed"
            ? "This run didn't finish"
            : `${run.passed} of ${run.total} passed`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {format(new TZDate(run.startedAt, workspace.timezone), "MMM d, h:mm a")}
        . Model: {run.model}. Dry run: nothing was booked, saved or sent.
      </p>

      <ol aria-label="Results" className="mt-8 grid gap-3">
        {results.map((result) => (
          <li
            key={result.id}
            className={cn(
              "rounded-xl border p-4",
              result.passed ? "" : "border-destructive/40",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{result.question}</p>
              <Badge variant={result.passed ? "secondary" : "destructive"}>
                {result.passed ? <Check /> : <X />}
                {result.passed ? "Passed" : "Failed"}
              </Badge>
            </div>
            {result.failures.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-sm text-destructive">
                {result.failures.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm whitespace-pre-line">
              {result.answer || "No answer."}
            </p>
            {result.graderNote ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Meaning check: {result.graderNote}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {result.tools.length
                ? `Used ${result.tools.join(", ")}`
                : "Used no tools"}
              . {(result.latencyMs / 1000).toFixed(1)} s,{" "}
              {result.inputTokens + result.outputTokens} tokens,{" "}
              {formatUsd(
                costOf(
                  run.model.split(" ").at(-1) ?? "",
                  result.inputTokens,
                  result.outputTokens,
                ),
              )}
              .
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

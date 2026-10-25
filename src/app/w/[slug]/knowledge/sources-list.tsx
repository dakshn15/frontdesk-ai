"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useActionForm } from "@/components/forms/use-action-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteKnowledge, resyncKnowledge } from "@/features/knowledge/actions";
import { KIND_LABEL, STATUS_LABEL } from "@/features/knowledge/constants";

type Source = {
  id: string;
  kind: keyof typeof KIND_LABEL;
  title: string;
  url: string | null;
  fileName: string | null;
  status: keyof typeof STATUS_LABEL;
  error: string | null;
  pageCount: number;
  chunkCount: number;
  synced: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function SourcesList({
  slug,
  sources,
}: {
  slug: string;
  sources: Source[];
}) {
  const router = useRouter();
  const busy = sources.some(
    (source) => source.status === "queued" || source.status === "processing",
  );

  // While anything is being read, check back every few seconds.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [busy, router]);

  if (sources.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No knowledge yet. Add a document, a web page or some text.
      </p>
    );
  }

  return (
    <ul
      aria-label="Knowledge sources"
      className="mt-8 divide-y rounded-xl border"
    >
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
        >
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{source.title}</p>
              <Badge
                variant={
                  source.status === "failed" ? "destructive" : "secondary"
                }
              >
                {STATUS_LABEL[source.status]}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {KIND_LABEL[source.kind]}
              {source.url ? ` · ${source.url}` : null}
              {source.fileName && source.fileName !== source.title
                ? ` · ${source.fileName}`
                : null}
            </p>
            {source.status === "failed" && source.error ? (
              <p className="mt-1 text-sm text-destructive">{source.error}</p>
            ) : source.status === "ready" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {plural(source.chunkCount, "passage")}
                {source.kind === "sitemap"
                  ? ` from ${plural(source.pageCount, "page")}`
                  : ""}
                {source.synced ? ` · Synced ${source.synced}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <ResyncButton slug={slug} source={source} />
            <DeleteButton slug={slug} source={source} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResyncButton({ slug, source }: { slug: string; source: Source }) {
  const { state, onSubmit, pending } = useActionForm(
    resyncKnowledge.bind(null, slug),
  );
  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);
  const busy = source.status === "queued" || source.status === "processing";
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="sourceId" value={source.id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-9"
        aria-label={`Sync ${source.title} again`}
        disabled={pending || busy}
      >
        <RefreshCw />
        Sync again
      </Button>
    </form>
  );
}

function DeleteButton({ slug, source }: { slug: string; source: Source }) {
  const { onSubmit, pending, formError } = useActionForm(
    deleteKnowledge.bind(null, slug),
  );
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            aria-label={`Delete ${source.title}`}
          />
        }
      >
        <Trash2 />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="sourceId" value={source.id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {source.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The receptionist stops using it right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              Delete
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

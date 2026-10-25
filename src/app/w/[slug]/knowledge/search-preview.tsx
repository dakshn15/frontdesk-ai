"use client";

import { Search } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewSearch, type SearchResult } from "@/features/knowledge/actions";

export function SearchPreview({ slug }: { slug: string }) {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("query") ?? "");
    if (!query.trim()) return;
    startTransition(async () => {
      const result = await previewSearch(slug, query);
      setResults(result.ok ? result.data : []);
    });
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={onSubmit} className="flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            name="query"
            type="search"
            aria-label="Search knowledge"
            placeholder="Is there parking?"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" className="h-10 px-4" disabled={pending}>
          Search
        </Button>
      </form>
      {results === null ? null : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching passages.</p>
      ) : (
        <ol aria-label="Matching passages" className="grid gap-3">
          {results.map((result) => (
            <li key={result.chunkId} className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">
                {result.sourceTitle}
                {result.heading ? ` › ${result.heading}` : ""}
              </p>
              <p className="mt-1 line-clamp-4 text-sm whitespace-pre-line">
                {result.content}
              </p>
              {result.pageUrl ? (
                <a
                  href={result.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block truncate text-xs text-primary underline-offset-4 hover:underline"
                >
                  {result.pageUrl}
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

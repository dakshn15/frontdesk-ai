import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import { listSources } from "@/features/knowledge/queries";
import { requireManager } from "@/lib/auth/session";
import { AddSourceDialog } from "./add-source-dialog";
import { SearchPreview } from "./search-preview";
import { SourcesList } from "./sources-list";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage({
  params,
}: PageProps<"/w/[slug]/knowledge">) {
  const { slug } = await params;
  const { claims, membership } = await requireManager(slug);
  const { workspace } = membership;
  const sources = await listSources(claims, workspace.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Knowledge
        </h1>
        <AddSourceDialog slug={workspace.slug} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Documents and pages the receptionist can search. Facts like prices and
        hours come from your other pages, not from here.
      </p>

      <SourcesList
        slug={workspace.slug}
        sources={sources.map((source) => ({
          id: source.id,
          kind: source.kind,
          title: source.title,
          url: source.url,
          fileName: source.fileName,
          status: source.status,
          error: source.error,
          pageCount: source.pageCount,
          chunkCount: source.chunkCount,
          synced: source.syncedAt
            ? format(new TZDate(source.syncedAt, workspace.timezone), "MMM d")
            : null,
        }))}
      />

      {sources.some((source) => source.status === "ready") ? (
        <>
          <Separator className="my-10" />
          <section aria-labelledby="try-search">
            <h2 id="try-search" className="text-lg font-semibold">
              Try a search
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              See which passages the receptionist would find for a question.
            </p>
            <SearchPreview slug={workspace.slug} />
          </section>
        </>
      ) : null}
    </div>
  );
}

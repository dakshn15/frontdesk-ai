# Milestone 4: Knowledge pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Planned and built in one go (Daksh's rule).

**Goal:** Owners add knowledge (an uploaded file, a web page, a sitemap or pasted text). The app extracts the text, splits it into chunks that keep their headings, embeds them, and makes them searchable with hybrid vector and full-text search. Also: the reminder email that milestone 3 deferred.

**Architecture:**

- Sources and chunks live in Postgres, with `pgvector` (HNSW) and a generated `tsvector` column.
- Text extraction is a set of pure functions: PDF through `unpdf`, DOCX through `mammoth`, HTML through `node-html-parser`. Uploads are extracted in the server action and only the text is kept.
- The pipeline (`src/jobs/knowledge.ts`) fetches, chunks, embeds and stores. It runs right after the request with Next's `after()`, and takes its fetcher and embedder as parameters so tests can supply fakes.
- Search runs a vector query and a full-text query, then merges them with reciprocal rank fusion in TypeScript.
- Embeddings come from OpenAI's REST API (`text-embedding-3-small`, 1536 dimensions). Without `OPENAI_API_KEY`, chunks are stored without vectors and search uses keywords only.

**Spec:** `docs/superpowers/specs/2026-10-24-frontdesk-ai-design.md` (sections 4.3, 4.5 reminders, 5, 7)

## Rulings made in the plan

- **No Inngest.** Both its current and LTS releases pull in OpenTelemetry's 42-package auto-instrumentation bundle, and it needs another account.
  - Ingestion runs with `after()` instead (Vercel allows up to 300 s). A source left "processing" for over 10 minutes shows as failed with "This took too long. Try again."
  - Reminders come from a Vercel Cron job: once a day on the Hobby plan, hourly on Pro. It emails bookings starting in the next 12 to 36 hours that haven't had one, protected by `CRON_SECRET`.
  - Cost if wrong: no automatic retries. Moving to Inngest later means wrapping two functions.
- **Uploads aren't stored as files.** The server action extracts the text (files up to 4 MB, inside Vercel's 4.5 MB body limit) and stores it on the source, so neither Supabase Storage nor a service key is needed. Cost if wrong: re-extraction needs a new upload.
- **Sitemap crawls stop at 25 pages** until billing plans set limits (milestone 11).
- **Fetching URLs is guarded against requests to internal addresses (SSRF).** Only http and https are allowed. The host must resolve to a public address, and each redirect is checked again, up to 3. There is a 10 s timeout and a 2 MB cap.

## Global Constraints

- Row level security on every table. Members read sources and chunks; owners and admins add, re-sync and delete sources. Only the pipeline (privileged, in `src/jobs/`) writes chunks and status.
- Chunks link to their source through `(source_id, workspace_id)`; deleting a source deletes its chunks.
- No new dependencies beyond `unpdf@1.8.1`, `mammoth@1.13.0` and `node-html-parser@9.0.4` (each at least two weeks old). The lockfile is regenerated with npm in a node:24 container.
- Copy is plain, with no exclamation marks.

## Review Focus

1. **Workspace isolation:** a search in one workspace never returns another workspace's chunks. Test: integration.
2. **SSRF:** a URL pointing at `127.0.0.1`, `169.254.169.254`, `10.x`, `[::1]`, or a redirect to one, is refused. Test: unit (address check) and integration (redirect).
3. **Bad files:** a corrupt PDF, an empty document or an unsupported type fails that source with a readable reason and leaves the others alone. Test: integration.
4. **Search without vectors:** with no API key, search still returns full-text matches. Test: integration.
5. **Reminders:** a booking that was moved or cancelled never gets a reminder, and each booking gets at most one. Test: integration.

---

### Task 1: Dependencies and pure helpers

**Files:** `package.json`, `package-lock.json`, `next.config.ts` (`experimental.serverActions.bodySizeLimit: "5mb"`), `src/features/knowledge/{chunk,html-text,rrf,extract}.ts`, `src/lib/safe-url.ts`, with unit tests for each.

- `chunkText(text, { maxChars = 2400, overlapChars = 300 }): { heading: string; content: string }[]`:
  - Markdown headings (`#` to `######`) start sections, and each chunk keeps its heading path ("About us › Parking").
  - Long sections split on paragraph boundaries with overlap.
  - Empty sections are dropped.
- `htmlToText(html): { title: string; text: string }`:
  - Drops script, style, noscript, svg, nav, footer and form.
  - Prefers `<main>`, then `<article>`, then `<body>`.
  - Headings become `#` lines; `p`, `li`, `td` and similar become lines.
  - Whitespace is collapsed.
- `sitemapUrls(xml): string[]` reads `<loc>` values.
- `reciprocalRankFusion(lists: string[][], k = 60): { id: string; score: number }[]`.
- `isPublicAddress(ip: string): boolean` covers IPv4 and IPv6, including private, loopback, link-local, CGNAT, unique-local and IPv4-mapped addresses.
- `extractText(file: { name; type; bytes: Uint8Array }): Promise<{ title; text }>` handles pdf, docx, txt and md. It throws `ExtractError` with "We couldn't read that file." or "Upload a PDF, Word, text or Markdown file.".

### Task 2: Tables, search and records

**Files:**

- `src/db/schema/knowledge.ts` (`knowledgeSources`, `knowledgeChunks`, enums `knowledge_kind` and `knowledge_status`).
- Migrations `<ts>_knowledge.sql` and `<ts>_knowledge_rules.sql`.
- `src/features/knowledge/{schemas,records,queries,search,embeddings}.ts`.
- Tests: `tests/integration/knowledge.test.ts`.

**Schema:**

- `knowledge_sources`:
  - `id`, `workspace_id`, `kind` (file, url, sitemap, text), `title` (1–200), `url`, `file_name`, `content` (extracted text, up to 500,000 chars);
  - `status` (queued, processing, ready, failed), `error`, `page_count`, `chunk_count`, `started_at`, `synced_at`, `created_by`, timestamps.
- `knowledge_chunks`:
  - `id`, `workspace_id`, `source_id`, `position`, `heading`, `content`, `page_url`, `embedding vector(1536)` (null allowed);
  - `fts tsvector generated always as (to_tsvector('english', heading || ' ' || content)) stored`;
  - an HNSW index (`vector_cosine_ops`), a GIN index on `fts`, and a composite FK to sources with cascade.

**Policies and grants:**

- Sources: members select; managers insert and delete; update is revoked, and the pipeline writes status with the privileged connection.
- Chunks: members select; no user writes.

**Code:**

- `searchKnowledge(tx, workspaceId, query, { queryEmbedding?: number[] | null; limit = 6 })` returns passages with `sourceId`, `sourceTitle`, `heading`, `content`, `pageUrl` and `score`.
- Records (managers): `addTextSourceRecord`, `addFileSourceRecord`, `addUrlSourceRecord(kind: "url" | "sitemap")`, `deleteSourceRecord`, `requeueSourceRecord`.
- Queries: `listSources(claims, workspaceId)`, with sources stuck in processing reported as failed.

**Tests:**

- Staff can't add sources.
- Members read; outsiders see nothing.
- Search finds keyword matches with no vectors, and ranks with injected vectors through RRF.
- Search never crosses workspaces.
- Deleting a source removes its chunks.

### Task 3: Pipeline

**Files:** `src/jobs/knowledge.ts` (`syncSource(sourceId, deps: { fetchPage; embed })`), `src/jobs/fetch-page.ts` (the guarded fetcher), `src/features/knowledge/embeddings.ts` (`embedTexts` through OpenAI, or null without a key), and `tests/integration/knowledge-pipeline.test.ts`.

**How a sync runs:**

1. Mark the source processing.
2. Get the text, depending on the kind:
   - `text` and `file` use the stored content;
   - `url` fetches the page;
   - `sitemap` reads the sitemap and fetches up to 25 same-host pages, skipping failures.
3. Chunk, embed in batches of 64, and replace the chunks in one transaction.
4. Mark it ready with counts, or failed with the reason. Errors are never thrown out of the job.

**Tests:**

- A text source ends ready with chunks.
- A URL source uses an injected fetcher.
- A sitemap respects the page limit and same-host rule.
- A failing fetch marks the source failed with a reason.
- Re-sync replaces the chunks.
- The guarded fetcher refuses a private address and a redirect to one.

### Task 4: Knowledge page

**Files:**

- `src/app/w/[slug]/knowledge/{page,add-source-dialog,sources-list,search-preview}.tsx`, `src/features/knowledge/actions.ts`.
- Nav item "Knowledge" after "Answers".
- `tests/e2e/knowledge.spec.ts`.

**Copy:**

- Title "Knowledge". Intro: "Documents and pages the receptionist can search. Facts like prices and hours come from your other pages, not from here."
- "Add knowledge" opens a dialog with the kind ("Upload a file", "Web page", "Whole site (sitemap)", "Paste text") and the matching fields.
- Status badges: "Queued", "Processing", "Ready", "Failed".
- Row actions "Sync again" and "Delete".
- Search box "Try a search" with "No matching passages." when nothing matches.
- The list refreshes every 3 s while anything is queued or processing.

**E2E:** an owner pastes text titled "About us" containing "We have free parking behind the salon", sees it become Ready, and searching "parking" shows the passage.

### Task 5: Reminders

**Files:** `src/jobs/reminders.ts` (`sendDueReminders(now)`), `src/app/api/cron/reminders/route.ts`, `vercel.json`, a migration adding `bookings.reminder_sent_at`, and an integration test.

**How it works:**

- Picks confirmed bookings starting between 12 and 36 hours from now with no reminder yet.
- For each one, claims it with `update … where reminder_sent_at is null returning`, then sends a "booking_reminder" email with the manage link.
- A reschedule clears `reminder_sent_at`.
- The route requires `Authorization: Bearer ${CRON_SECRET}`, and answers 503 when the secret is unset.

**Tests:**

- Due bookings get exactly one reminder, even when it runs twice.
- Cancelled and out-of-window bookings get none.
- A moved booking is reminded for its new time.

### Task 6: Ship

- Full gate, then e2e in CI mode.
- One screenshot pass.
- Decisions log and README (`OPENAI_API_KEY`, `CRON_SECRET`).
- Ask Daksh, then `db push` first, then push and check CI.

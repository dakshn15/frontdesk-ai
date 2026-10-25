# Milestone 4: decisions log

Calls made while building milestone 4 that differ from or add to [the plan](2026-10-25-m4-knowledge.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **No Inngest, which the spec named for background jobs:**
  - **Why:** every Inngest release, including the 3.x long-term-support line, depends on OpenTelemetry's auto-instrumentation bundle (42 instrumentation packages), and it needs another account.
  - **Ingestion instead:** runs with Next's `after()` once the request has responded. A source left queued or processing for more than 10 minutes shows as failed ("This took too long. Try again.") and can be synced again.
  - **Reminders instead:** a daily Vercel Cron job (`vercel.json`, 14:00 UTC) emails confirmed bookings starting 12 to 36 hours ahead that haven't had one. Hobby plans allow one cron run a day; Pro could run it hourly.
  - **Cost if wrong:** no automatic retries or job dashboard. Moving to Inngest later means wrapping `syncSource` and `sendDueReminders` in functions.
- **Uploads aren't stored as files:** the server action extracts the text (PDF, DOCX, TXT, Markdown, up to 4 MB, inside Vercel's 4.5 MB request limit) and keeps only the text, so neither Supabase Storage nor a service key is needed — cost if wrong: improving extraction later means owners upload again.
- **Embeddings go through OpenAI's REST API** with `fetch` (`text-embedding-3-small`, 1536 dimensions), not the AI SDK, which arrives with the chat agent in milestone 5. Without `OPENAI_API_KEY`, chunks are stored without vectors and search uses keywords only — cost if wrong: none; vectors fill in on the next sync once a key is set.
- **Keyword search matches any word of the question (OR), ranked by how much matches.** `websearch_to_tsquery` joins words with AND, so "is there free parking for my car" found nothing when "car" wasn't in the text. Found while taking screenshots; the test went red, then green — cost if wrong: looser keyword matches. Ranking, and vectors once enabled, keep the best passages on top.
- **Fetching owners' URLs is guarded:**
  - every host, including each redirect, must resolve only to public addresses;
  - http and https only, no credentials in the URL;
  - 10 s timeout, 2 MB cap, at most 3 redirects, page content types only.
  - Cost if wrong: DNS rebinding between the check and the connection is still possible (noted below).
- **Sitemaps:** up to 25 pages from the same site (`www.` ignored), and up to 5 nested sitemaps for a sitemap index. One broken page doesn't fail the source — cost if wrong: large sites are only partly read until billing plans set limits (milestone 11).
- **A web page's own `<title>` replaces the address used as a placeholder title** — cost if wrong: none.
- **pgvector migration:** `create extension vector` sits at the top of the generated knowledge migration. A separate custom migration first would have recorded the new tables in its snapshot and left the next generate empty — cost if wrong: none.
- **The search box input is named "Search knowledge"** because the section is already called "Try a search" — cost if wrong: none.
- **Reminders don't include a new manage link**, so the link in the booking email keeps working; they say "To cancel or change it, use the link in your booking email." Moving a booking clears `reminder_sent_at`, so the new time gets its own reminder — cost if wrong: a customer has to find the earlier email.
- **The Knowledge page is for owners and admins only**, like the other business pages — cost if wrong: none.

## Self-review (inline)

- **Tables:** `knowledge_sources` and `knowledge_chunks` both have row level security.
  - Sources: members read; owners and admins add and delete. The only columns users can update are `status`, `error` and `updated_at`, used to queue a source again.
  - Chunks: read-only for users; only the privileged pipeline in `src/jobs` writes them.
  - Chunks link to sources through `(source_id, workspace_id)` with cascade.
- **Search:** filtered by workspace and run inside the user's row level security. A test confirms another workspace's chunks never come back, even when asked with that workspace's id.
- **Server actions:** all four knowledge actions check the manager context first. File size and type are checked before extraction, and extraction errors become field errors.
- **Cron route:** answers 503 without `CRON_SECRET` and 401 with the wrong one.
- **Review Focus:**
  - workspace isolation (integration test);
  - SSRF (unit tests, plus an end-to-end test of a `127.0.0.1` address);
  - bad files (unit test);
  - search without vectors (integration test);
  - reminders sent once, and never for cancelled or moved bookings (integration test).

## Deferred minors

- **DNS rebinding:** the fetcher checks a host's addresses, then lets `fetch` resolve it again. A hostile DNS server could answer differently the second time. Pinning the checked address needs a custom undici dispatcher.
- **No PDF success test:** only the failure path has one; a real PDF fixture would cover the happy path.
- **The Word test builds its file with `jszip`,** which comes in through mammoth rather than being a declared dependency.
- **Uploads stop at 4 MB** because of the Vercel request limit. Larger files would need direct-to-storage uploads.

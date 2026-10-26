# Milestone 5: decisions log

Calls made while building milestone 5 that differ from or add to [the plan](2026-10-26-m5-receptionist.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Rate limits live in Postgres instead of Upstash Redis.** There's one upsert-based fixed-window table (`rate_limit_windows`), so Daksh doesn't need another account. Limits:
  - 30 new sessions per IP per hour;
  - 20 messages per session per 10 minutes;
  - 60 messages per IP per 10 minutes;
  - 30 preview messages per user per 10 minutes;
  - one manage-link email per address per 10 minutes.
  - Cost if wrong: one write per request. Moving to Redis later means replacing `allowRequest`.
- **Models:** `gpt-5.4-mini` (OpenAI, the default) and `gemini-3.5-flash` (Google), picked from the installed providers' model lists. Both keys are optional; with neither, the chat replies "Sorry, I can't answer right now…" and saves that — cost if wrong: two constants in `src/privileged/assistant/models.ts`.
- **Fallback:** a wrapper model tries the workspace's provider and retries once on the other when it fails before anything streams. The switch is logged (`usage_events.fell_back`). Errors after streaming has started aren't retried, so a reply is never sent twice — cost if wrong: a mid-stream outage gives "something went wrong" instead of a retry.
- **Costs aren't calculated yet:** `usage_events` records provider, model, tokens and latency. Milestone 10 works out cost from a price table checked then, rather than guessing prices now — cost if wrong: none.
- **The tools are closures over the workspace and conversation**, not AI SDK `toolsContext`. Every query filters by workspace in code. They live in `src/privileged/assistant/` because the public chat has no signed-in user — cost if wrong: none.
- **The server keeps the history.** Clients send only the new message and a conversation id, which must belong to their session (widget) or workspace preview; an unknown id starts a new conversation. The browser learns the id from the stream's message metadata — cost if wrong: none.
- **`propose_booking` only returns a card.** Confirming it is a widget endpoint in milestone 6 — cost if wrong: none.
- **`send_manage_link`** gives the same reply whether or not the address has a booking, so it can't be used to find out who's a customer. It emails a fresh link (new email kind "link") for up to three upcoming bookings — cost if wrong: an older link stops working after a new one is sent.
- **`search_knowledge` reports its confidence:** "high" when the top passage matched the question's words, "low" when it only matched by meaning, "none" when nothing came back. The instructions say to answer cautiously and offer a handoff when it's low — cost if wrong: the threshold gets tuned with the evaluation suite in milestone 9.
- **A conversation a person has taken over gets no AI reply**: the visitor's message is saved, ready for milestone 7's takeover — cost if wrong: none.
- **The dashboard preview is a dry run:** leads, manage-link emails and handoffs are reported and not saved or sent. The preview's own conversation and messages are saved, on the `preview` channel — cost if wrong: preview chats will show in analytics unless milestone 10 filters by channel.
- **E2E uses `AI_FAKE=1`,** a scripted model that searches the knowledge and answers with the top passage. The Playwright config sets it for the test server, and it's ignored when `VERCEL` is set — cost if wrong: none.
- **The preview chat reads the conversation id from the last reply's metadata** instead of a ref; the lint rule forbids reading refs while rendering — cost if wrong: none.

## Self-review (inline)

- **Tables:** all seven new tables have row level security. Members can read conversations, messages, tool calls, leads and usage. Insert, update and delete are revoked for users on all of them; sessions and rate-limit windows have no policies at all.
- **Tools:** every tool query filters by `workspace_id`, and a test confirms tools never return another workspace's services or knowledge. `propose_booking` never writes to bookings, which is also tested.
- **Prompt injection:** passages come back labelled as data, and the instructions say so. The model can only act through tools, and none of them can book, change settings or email anyone except a booking's own address.
- **Endpoints:**
  - `/api/chat` and `/api/chat/session` validate their bodies with zod and rate-limit;
  - an unknown or expired token gets 401;
  - `/api/w/[slug]/assistant` requires an owner or admin.
- **Review Focus:**
  - isolation, no booking writes, the email limit and abuse limits are all covered by integration tests;
  - prompt injection is handled by design, as above.

## Deferred minors

- A visitor's token isn't tied to the page's domain yet. Allowed domains and the origin check arrive with the widget in milestone 6.
- Streaming errors after the first token show a generic message, with no retry.
- The preview keeps no history after a reload; the conversation is saved, but the page starts fresh.

# Milestone 5: AI receptionist Implementation Plan

> Planned and built in one go (Daksh's rule). Uses superpowers:executing-plans.

**Goal:** A receptionist agent that answers from the business's own facts and knowledge, checks availability, proposes bookings, captures leads, sends manage links and hands off to a person, streamed through a chat API. Owners can try it in a dashboard preview.

**Architecture:**

- **Agent (`src/features/assistant/`):** AI SDK 7 `streamText` with tools built per request from a closure over the workspace and conversation.
- **Instructions:** carry the answer rules. Document passages come back wrapped as untrusted data.
- **Models:** OpenAI by default, with Gemini if the workspace picks it. A fallback wrapper retries once on the other provider when the first fails before streaming.
- **Persistence:** conversations, messages, tool calls and usage are saved by the server with the privileged connection, scoped by workspace in code. The server keeps the history; clients only send the new message.
- **Visitor access:** a random session token, stored hashed, created by `POST /api/chat/session`.
- **Rate limits:** a Postgres fixed-window counter, so no Upstash account.

**Spec:** sections 4.4, 5, 7, 8.

## Rulings in the plan

- **No live widget yet:** the public chat API ships now but has no front end until milestone 6. The dashboard preview (`/w/[slug]/assistant`) runs the same agent as a dry run, so leads, emails and handoffs are reported and not saved or sent.
- **`propose_booking` returns a booking card only.** Confirming it is a widget endpoint in milestone 6; the model can never book.
- **Rate limits live in Postgres** (`rate_limit_windows`) instead of Upstash Redis: one less account. Cost if wrong: one write per request.
- **Costs come later:** `usage_events` stores tokens, provider and model. Cost is calculated in milestone 10 from a price table checked then, rather than guessed now.
- **Models:** `gpt-5.4-mini` (OpenAI) and `gemini-3.5-flash` (Google), chosen from the installed providers' model lists. Both keys are optional:
  - with neither, the chat API answers with a fixed "can't answer right now" reply and offers lead capture;
  - `AI_FAKE=1` (ignored on Vercel) swaps in a scripted model for e2e tests.
- **Handoff marks the conversation `needs_human`.** Staff alerts and live takeover are milestone 7.

## Review Focus

1. **Workspace isolation:** a tool can never return another workspace's services, staff, policies, answers, knowledge or bookings.
2. **Prompt injection:** passage text can't trigger tools. Only the server can act, and the agent's tools are the only actions.
3. **Bookings stay with the customer:** `propose_booking` never writes a booking.
4. **No email spam:** `send_manage_link` emails only the address already on a booking, at most once per 10 minutes per address.
5. **Abuse:** an expired or unknown session token is refused, and too many messages get a 429.

---

### Task 1: Dependencies and env

- Add `ai@7.0.137`, `@ai-sdk/openai@4.0.91`, `@ai-sdk/google@4.0.93` and `@ai-sdk/react@4.0.140`. Regenerate the lockfile in node:24.
- Env: `GOOGLE_GENERATIVE_AI_API_KEY` (optional) and `AI_FAKE`.

### Task 2: Tables

- `workspaces.ai_provider` (`openai` | `google`, default openai) and `assistant_name` (default "Assistant"), both granted for update.
- `visitor_sessions`: `id`, `workspace_id`, `token_hash` (unique), `expires_at`, `created_at`.
- `conversations`: `id`, `workspace_id`, `session_id`, `channel` (widget | preview), `status` (ai | needs_human | human | resolved), `handoff_reason`, `created_at`, `last_message_at`.
- `messages`: `id`, `workspace_id`, `conversation_id`, `role` (visitor | ai | staff), `content`, `sources` jsonb, `created_at`.
- `tool_calls`: `id`, `workspace_id`, `conversation_id`, `tool`, `input` and `output` jsonb, `duration_ms`, `created_at`.
- `leads`: `id`, `workspace_id`, `conversation_id`, `name`, `email`, `phone`, `message`, `created_at`.
- `usage_events`: `id`, `workspace_id`, `conversation_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `fell_back`, `created_at`.
- `rate_limit_windows`: `key`, `window_start`, `count`, primary key on (key, window_start).
- **Access:** members read conversations, messages, tool calls, leads and usage; nothing is user-writable. The rate limit table has row level security on with no policies.

### Task 3: Agent

- `models.ts`: `chatModel(provider)` with fallback (`withFallback(primary, secondary, onSwitch)`) and `fakeModel()`.
- `instructions.ts`: `buildInstructions({ business, assistantName, timeZone, now })` with the answer rules.
- `tools.ts`: `buildTools(ctx: { workspaceId, conversationId, mode: "live" | "dry", now })`, where each tool reads through the privileged connection and filters by workspace:
  - `get_services`, `get_staff`, `get_hours` (opening hours and closed days ahead), `get_policies`;
  - `find_verified_answer` (keyword match on questions);
  - `search_knowledge` (hybrid search, passages as data, with a `confidence` of high or low);
  - `check_availability` (service, optional staff, a date range up to 7 days, at most 12 slots);
  - `propose_booking` (re-checks the slot and returns a card);
  - `capture_lead`, `send_manage_link`, `handoff_to_human`.
- `agent.ts`: `runAgent({ workspaceId, conversationId, mode, text, model? })`. It saves the visitor message, loads history (last 20), streams with `isStepCount(6)`, and on end saves the AI message with its sources, the tool calls and usage.

### Task 4: Chat API

- `POST /api/chat/session { workspace: slug }` returns `{ token, expiresAt }` (24 h).
- `POST /api/chat { token, conversationId?, text }` validates the token, creates or continues a widget conversation in that workspace, rate-limits (20 messages per session per 10 minutes, 60 per IP per 10 minutes), and streams the UI message stream. The conversation id comes back in a response header.
- `POST /api/w/[slug]/assistant { conversationId?, text }`: members only, preview channel, dry run.

### Task 5: Preview page and settings

- `/w/[slug]/assistant` (managers; nav item "Assistant"):
  - a chat that streams with `useChat`;
  - each answer lists the tools it used and its sources;
  - a "Start over" button;
  - a notice when no AI key is set.
- Settings gets a section "Receptionist" with "Assistant name" and "AI provider" (OpenAI or Google).

### Task 6: Ship

- Full gate. E2E (with `AI_FAKE=1`): the preview answers from pasted knowledge and shows its source.
- Decisions log and README.
- Ask Daksh, then `db push` first, then push and check CI.

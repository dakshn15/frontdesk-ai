# Milestone 7: decisions log

Calls made while building milestone 7 that differ from or add to [the plan](2026-10-27-m7-inbox.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Who can do what:** any member, including staff, can take a chat over, hand it back, resolve it and reply. These are front-desk jobs.
  - Taking over a chat someone else is handling is refused with "Someone else on the team is already handling this chat." Replying to it is allowed, since the team shares the inbox.
  - Cost if wrong: a role check in `takeOverRecord` and in the policy.
- **Staff actions run under row level security**, not the privileged connection:
  - an update policy for members on `conversations`, limited by column grants to `status`, `assigned_to` and `last_message_at`;
  - an insert policy on `messages` that only accepts `role = 'staff'` with `author_id = auth.uid()`.
  - Postgres needs an insert grant even on columns filled by defaults, so the grant also lists `id`, `sources` and `created_at`.
- **No `handoffs` table.** The spec's data model lists one, but `conversations.handoff_at`, `handoff_reason`, `assigned_to` and the `handoff_to_human` tool call already record each handoff.
  - Cost if wrong: one table later if analytics needs a handoff history.
- **One alert per handoff:** the tool only changes a chat that was `ai` or `resolved`, and only that change emails the owners and admins (kind `handoff` in `email_log`). Staff aren't emailed.
- **"In the dashboard" means three things:**
  - a nav badge counting chats that need a person;
  - a toast with an Open button on every workspace page when a chat starts needing a person;
  - live refreshes on the inbox pages.
  - All three come from Supabase Realtime `postgres_changes`, which applies RLS, filtered by workspace.
- **Live updates refresh the server-rendered page** (`router.refresh()`, debounced by 300 ms) rather than patching client state. That keeps one source of truth.
  - Cost if wrong: a busier inbox does more page refreshes. Patching rows in place can come later.
- **The widget checks every 4 seconds**, only while the chat is waiting for or handled by a person, and only while the tab is visible.
  - It appends new staff messages and shows "You're chatting with Ana from the team".
  - It stops once the chat is back with the AI.
  - Visitors only ever see a team member's first name.
- **When the widget asks for an email:** when the chat has waited 5 minutes for a person, or the business is closed now (opening hours and closed days in its time zone), and the visitor hasn't left details yet. With no opening hours set at all, it counts as open rather than guessing.
- **Email replies only go to the lead's address:** "Also email this reply" sends to the most recent lead address in that conversation, looked up on the server. The person replying can't type an address.
- **A visitor writing to a resolved chat reopens it** with the AI answering.
- **The AI's empty reply while the team handles a chat is hidden** in the widget, so no blank bubble appears.
- **The scripted e2e model hands off** when the visitor's message contains "person" or "human".

## Fixed along the way

- **A flaky workspace switch (the e2e shell test):**
  - The cause: the proxy remembered the last workspace on every `/w/...` request, including Next's background prefetches, so a late prefetch for the old workspace could overwrite the choice.
  - The fix: prefetches no longer set the cookie (`isPrefetch`, unit tested), and the switcher's links skip prefetching, so a switch always makes a real request.
  - Checked: 18 out of 18 runs of the shell test passed.

## Self-review (inline)

Each review-focus item from the plan, and what covers it:

- **Taking over from someone else:** refused (integration test). Replies from anyone in the team are allowed.
- **Replying by email to a typed address:** impossible; the address comes from the conversation's lead (integration test).
- **Realtime leaks:** RLS applies to Realtime, and the channel filters by `workspace_id`. Records outside the workspace come back as "not_found" (integration test).
- **Polling forever:** it only runs while the chat is with the team, and stops when the e2e test hands it back.
- **A double alert:** a second handoff on the same chat sends nothing (integration test).

## Deferred minors

- Inbox lists show the latest 50 conversations with no paging.
- The toast relies on `handoff_at` being under a minute old. A member whose clock is badly off may miss it, but the badge still counts the chat.
- Visitors aren't told when a person hands the chat back to the AI; the banner just disappears.

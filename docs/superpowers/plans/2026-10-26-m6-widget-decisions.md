# Milestone 6: decisions log

Calls made while building milestone 6 that differ from or add to [the plan](2026-10-26-m6-widget.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Widget settings are columns on `workspaces`**, like the assistant name, rather than a separate `widget_settings` table. There's one row per workspace either way, and the column grants follow the M5 pattern.
  - Cost if wrong: one migration to move five columns.
- **With no allowed domains, the chat works on any site.** The Widget page says so under the field. Blocking by default would make a new workspace's embed code look broken before setup.
  - Cost if wrong: a business that never adds a domain can be embedded elsewhere until it does. Rate limits still apply.
- **How a domain matches:** it covers itself and every subdomain. `www.` and `*.` are stripped when saving, and `localhost` is allowed for testing.
- **Enforcement comes in three layers:**
  - `frame-ancestors` on `/widget/[slug]`, set in the proxy from the allowed domains;
  - the chat and widget endpoints refuse any `Origin` header other than the app's own;
  - the session start checks the parent page's host, read from `location.ancestorOrigins` or the referrer, never from a query parameter the embedding page controls.
  - The app's own host is always allowed, so the dashboard's "Try it" link works.
  - Cost if wrong: a non-browser client can still fake a host. That's accepted: the frame policy is the real barrier, and rate limits cap abuse.
- **Booking only what was offered:** `/api/widget/book` books a time only if a successful `propose_booking` call with the same service, staff and start time exists in this visitor's own conversation. The engine then checks the slot again, and the exclusion constraint has the last word.
  - Cost if wrong: none; a visitor who wants another time asks the chat.
- **Confirmations:** the booking email is sent, and the server saves a short "You're booked" AI message, so the transcript shows it after a reload.
- **The transcript after a reload shows text and source chips only.** Booking cards aren't rebuilt from tool calls. A card that was offered and not booked disappears on reload, and the visitor asks again.
  - Cost if wrong: small; rebuilding cards from `tool_calls` can come later.
- **The session lives in `sessionStorage` inside the iframe**, which browsers partition by top-level site. A visitor's chat follows them across pages of one site in the same tab, as the spec asks.
- **The iframe holds the launcher too.** The embed script never draws anything itself:
  - closed, the iframe is 88 by 88 px;
  - open, it's 416 px by up to 720 px;
  - below 480 px wide, it fills the screen.
  - The page forces a transparent background and `color-scheme: normal`, so browsers don't paint an opaque backdrop behind it.
- **The avatar is left for later.** The spec lists it among the customisations, but it needs Supabase Storage uploads, which nothing uses yet. The launcher shows a chat icon in the brand colour.
  - Cost if wrong: a later small task with an upload field.
- **Brand text colour:** white or near-black, whichever reads better on the chosen colour (WCAG relative luminance).
- **Handoff state:** the banner shows when a `handoff_to_human` result arrives, or when history says the conversation is `needs_human` or `human`. Picking up staff replies by polling is milestone 7.
- **The widget's own wording:** "Add your name." replaces the dashboard's "Add the customer's name." on the booking card.
- **The scripted e2e model can book:** when the visitor's message contains "book", it calls `get_services`, then `check_availability` and `propose_booking` with the first free time.
- **The dashboard preview shows booking cards read-only**, with a note that customers confirm them in the website chat.

## Self-review (inline)

Each review-focus item from the plan, and what covers it:

- **Another site embedding a workspace's slug:** when domains are set, `frame-ancestors` blocks it. Covered by an e2e test on the header and a unit test on the policy. The session start also checks the host (integration test).
- **Booking a time that was never offered, or using another visitor's conversation:** refused with 400. A time that's no longer free is refused with 409. All three are integration tests.
- **Messages from other origins:** the embed script checks both the message's origin and its source frame. Chat and widget endpoints refuse another site's `Origin` (integration test).
- **Reloads:** the transcript and handoff state come back from `/api/widget/history`, which only returns the session's own conversation (integration and e2e tests).
- **Phone widths:** the iframe fills the screen below 480 px, and the close button stays in the header. Checked in a 390 px screenshot.

## Deferred minors

- No avatar upload yet (above).
- Booking cards aren't restored after a reload (above).
- The launcher has no unread badge or open animation.

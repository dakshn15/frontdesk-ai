# Milestone 8: decisions log

Calls made while building milestone 8 that differ from or add to [the plan](2026-10-27-m8-demo.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Visitors are Supabase anonymous users.** No sign-up form, and they get a real session, so the dashboard, RLS and Realtime work for them exactly as for a paying owner.
  - Daksh turns on "Allow anonymous sign-ins" in the hosted project. Local and CI get it from `config.toml`.
  - Cost if wrong: the alternative was server-made users with generated passwords, which is more moving parts.
- **Turnstile is checked by Supabase** (Auth → Bot and abuse protection), not by our own endpoint. The client passes the token to `signInAnonymously`, and the widget only renders when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set. Without it (local, CI), the demo starts with one click.
  - Cost if wrong: none; Supabase rejects a missing or bad token once captcha is on.
- **Sandboxes are workspaces with `demo_expires_at` set,** not a separate `demo_sandboxes` table. One column says "this is a demo" everywhere: the mailer, invites, the AI cap, the banner, the clean-up.
  - Cost if wrong: one table later if sandboxes need more metadata.
- **Anonymous users are limited by the database:**
  - `create_workspace` and `accept_invitation` refuse them, checking `auth.users.is_anonymous` rather than token claims;
  - a trigger refuses invitations in demo workspaces;
  - the app shows plain messages for each.
  - The profile trigger now copes with users that have no email.
- **Sandboxes are made by the privileged connection** (`src/privileged/demo/`):
  - a visitor with a live sandbox gets it back;
  - each address may start 3 an hour;
  - at most 100 can be alive at once.
  - The seed runs in one transaction, so a failure leaves nothing behind.
- **The guest is "Alex Rivera",** the salon's front-desk manager, so their inbox replies read "Alex from the team" in the widget.
- **Seeded data is relative to now:**
  - bookings run from 3 days ago to a week ahead, following three daily patterns, and skip people who don't work that day;
  - past bookings are marked completed;
  - closed days are fixed holiday dates, and only future ones are added.
  - Knowledge is stored as chunks without embeddings: search uses keywords until a passage is re-synced. That keeps each sandbox free and fast to create.
  - Cost if wrong: the meaning-based half of hybrid search is unused in demos. Re-syncing a source from the Knowledge page adds embeddings when a key is set.
- **Demo email:** sandboxes never call Resend. Every email still lands in `email_log`, shown on a new **Emails** page for managers. That page is useful for real workspaces too, before email is set up.
- **The demo AI cap is a count, not dollars:** 300 AI replies a day shared by all sandboxes, using the existing rate-limit table. After that, demos reply with the lead-form message. Spend in dollars arrives with cost tracking in milestone 10.
  - Cost if wrong: 300 replies of gpt-5.4-mini a day is a few dollars at most.
- **The daily clean-up** (`/api/cron/demo-cleanup`, 09:00 UTC, `CRON_SECRET`) deletes expired sandboxes, then any anonymous users left with no workspace. Its daily query also keeps a free Supabase project awake.
- **The salon website reads the sandbox live,** so a price changed in the dashboard shows on the site.
  - Its look is the salon's own, not the app's: plum and petal pink, Bricolage Grotesque and Figtree, and a price board with dotted leaders.
  - "Open the dashboard" is a full page load, so the chat's iframe doesn't follow into the app.
- **`window.FrontDesk.open()` and `.ask(text)`** were added to the embed script for the "try these questions" strip. Commands queue until the widget reports it's ready, and the widget only accepts them from its parent window.
- **A demo test detail:** locally every request comes from one address, so the demo e2e test clears the demo rate-limit rows first.

## Self-review (inline)

Each review-focus item from the plan, and what covers it:

- **Anonymous users creating or joining workspaces:** refused by the database (integration tests for both functions), with messages in the app.
- **Sandbox floods:** the per-address limit, the global cap and reuse are all integration tested. Turnstile is configured in Supabase.
- **Emailing real people:** the mailer skips Resend for demos (tested with a mocked key and fetch). Every seeded address is `@example.com` (tested).
- **Demo AI costs:** the shared daily cap falls back to the lead form, and real workspaces aren't counted (integration test).
- **Lingering sandboxes:** the clean-up removes expired workspaces and their anonymous users, and keeps live ones (integration test).

## Deferred minors

- The workspace-switch e2e test can fail under heavy local load: two or more workers on this laptop, while other suites run.
  - It has passed in every GitHub CI run.
  - A trace from a forced failure showed a load timeout at sign-in rather than the cookie race, so the cause isn't pinned down.
- Seeded knowledge has no embeddings (above).
- The salon site has no photos, by design: no stock images.

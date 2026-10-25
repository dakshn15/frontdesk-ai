# Milestone 3: decisions log

Calls made while building milestone 3 that differ from or add to [the plan](2026-10-25-m3-booking-engine.md), each with what it costs if it turns out wrong.

## Rulings

- **Process:** planned and built in one session without a plan-approval stop, as Daksh asked. E2E ran once at the end, in CI mode. The session Daksh started for this milestone was stopped before it wrote anything, because he asked for the work here — cost if wrong: none.
- **Scope:** the 24-hour reminder email moves to milestone 4, which adds Inngest (a new dependency and account) for document processing anyway, so both arrive together — cost if wrong: no reminder emails until milestone 4.
- **No new dependencies:** email goes through Resend's REST API with `fetch` and plain HTML templates instead of the Resend SDK and React Email, so no lockfile regeneration was needed — cost if wrong: templates may move to React Email later.
- **Manage links:** a random token whose SHA-256 hash is stored on the booking (the same approach as team invites), instead of an HMAC with a new secret. No new environment variable is needed. The link expires when the appointment starts. A dashboard reschedule sends a fresh link and the old one stops working; a customer's own reschedule keeps theirs — cost if wrong: an old email's link may stop working after staff move the booking.
- **Privileged code:** manage links, calendar feeds and the mailer live in `src/privileged/`, the one place besides jobs and webhooks allowed to import the admin connection (ESLint). Every query there starts from a token hash or a workspace id — cost if wrong: none.
- **Dashboard bookings ignore the customer booking window:** no minimum notice and no days-ahead limit, so walk-ins can be booked. They still need free working time — cost if wrong: staff can't book outside a person's hours without changing the hours first.
- **A requested time that's no longer free returns "slot_taken"** whether the read or the database caught it, because from the user's side both mean someone just took it — cost if wrong: none.
- **"Any available"** tries qualified staff with the fewest confirmed bookings that day, each in its own savepoint, moving on when the exclusion constraint rejects one — cost if wrong: none.
- **Customer emails are stored lower-case** with a plain unique `(workspace_id, email)`; the engine lower-cases on every path — cost if wrong: none.
- **The calendar token** is stored as-is (not hashed) so managers can copy the feed link again. Staff-role members can read it, but they can see the whole calendar anyway. Resetting replaces it — cost if wrong: a staff-role member could subscribe to a colleague's feed.
- **Deleting a staff member with upcoming confirmed bookings is refused** ("Move or cancel their upcoming bookings first."). Past bookings keep the copied staff name, with `staff_id` cleared — cost if wrong: one extra step before deleting someone.
- **Correlated subqueries:** none new. The milestone 2 Drizzle gotcha (table names dropped in single-table selects) was avoided by using joins.
- **`useActionForm` now includes the button that submitted** in the form data, as a normal browser submit does, so status buttons can share one form — cost if wrong: none.
- **Double toasts fixed across all dialogs:** each dialog passed a new inline close function on every render, so its form's success effect ran twice and showed two toasts. This affected the services, policies, answers, team invite and new booking dialogs. Each dialog now passes a stable `close` from `useCallback`. Found by the bookings e2e (strict mode saw two "Booked." toasts), red then green — cost if wrong: none.
- **E2E dates are relative** (a week ahead, or the next Monday a week out), so the tests never go stale — cost if wrong: none.

## Self-review (inline)

Checked the milestone diff (`b15266a..HEAD`):

- **Tables:** all four new tables have row level security on. Bookings, customers and booking events allow members to read and write; the email log is read-only for members. UPDATE is revoked everywhere, with grants only for the editable columns. The new workspace and staff columns joined their tables' grants.
- **Links:** composite `(id, workspace_id)` foreign keys keep bookings inside their workspace, and deleting a customer, staff member or service clears only that column.
- **Overlaps:** the exclusion constraint covers confirmed bookings, start to end plus buffer. It's tested with two bookings fired at the same moment.
- **Server actions:** the calendar actions use the member context, booking rules use the manager context, and the manage-link actions validate the token and delegate to `src/privileged/manage.ts`.
- **Review Focus:**
  - concurrency (integration test);
  - DST day (unit test);
  - buffers (unit and integration tests);
  - manage links refusing unknown, cancelled and past bookings (integration test);
  - the cancellation window for customers (integration test).

## Deferred minors

- Manage links and calendar feeds have no rate limit yet. Upstash arrives in milestone 5, for the public chat API.
- The calendar shows one day at a time; there is no week view.
- A customer can't pick a different staff member when rescheduling online, only a new time with the same person.
- No outbox page yet; emails sent or not sent can be read in the database (`email_log`). Demo sandboxes (milestone 8) add the in-app outbox.

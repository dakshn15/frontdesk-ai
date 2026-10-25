# Milestone 3: Booking engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners and staff can book, move, cancel and close out appointments in a dashboard calendar that can never double-book. Customers get a confirmation email with a calendar file and a link to cancel or reschedule, and each staff member gets a calendar feed.

**Architecture:** A pure availability engine (`src/features/bookings/availability.ts`) turns staff hours, time off, closed days and existing bookings into slots. Bookings live in Postgres with an exclusion constraint on `(staff_id, tstzrange(starts_at, occupied_until))` for confirmed rows, so overlaps fail in the database even under concurrency. Dashboard writes go through `withRls`. Token-holder pages (manage links, calendar feeds) and the mailer use the privileged connection from a new `src/privileged/` folder and scope every query by token or workspace in code.

**Moved to milestone 4:** the 24-hour reminder email. It needs Inngest (a new dependency and account), which milestone 4 adds for document processing anyway, so both arrive together.

**Tech Stack:** Next.js 16.4, Supabase Postgres (RLS, btree_gist), Drizzle 0.45, Zod 4, @date-fns/tz, Vitest, Playwright. Email through Resend's REST API with `fetch` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-10-24-frontdesk-ai-design.md` (sections 4.5, 6, 7, 8)

## Global Constraints

- Every new table has row level security, member read, and revoked UPDATE with column grants for the editable columns.
- Links between booking rows and staff, services or customers use `(id, workspace_id)` pairs.
- All times are stored in UTC and shown in the workspace time zone.
- Only `confirmed` bookings block time. Statuses: `confirmed`, `cancelled`, `completed`, `no_show`.
- Bookings copy the service name, duration, buffer, price and staff name at booking time.
- Copy is plain, with no exclamation marks. Server actions return `ActionResult` and use `useActionForm`.
- Daksh's pace rules: TDD with unit and integration tests per task. Run e2e once, in Task 5, in CI mode. Do one screenshot pass, for new layouts only.
- No new npm dependencies (no lockfile regeneration).

## Review Focus

1. Two bookings for the same staff and overlapping time at the same moment: exactly one succeeds, the other gets "That time was just taken." Test: Task 2 concurrency test.
2. A slot on the day clocks change (America/Chicago, 1 November 2026) lands at the right local times. Test: Task 1 DST case.
3. Buffers: a 60-minute service with a 15-minute buffer at 10:00 blocks a 11:00 start until 11:15. Test: Task 1 and Task 2.
4. A manage link for another workspace's booking, an expired link, or a cancelled booking can't change anything. Test: Task 4.
5. Cancelling inside the cancellation window is refused for customers but allowed for staff. Test: Task 4.

---

### Task 1: Availability engine and booking rules

**Files:** `src/features/bookings/availability.ts`, `tests/unit/availability.test.ts`

**Produces:**

- `type BookingRules = { slotStepMinutes: number; minNoticeMinutes: number; maxDaysAhead: number; cancellationWindowHours: number }`, with `DEFAULT_BOOKING_RULES = { 15, 120, 60, 24 }`.
- `type StaffAvailability = { staffId: string; hours: WeeklyHours; blocked: { start: Date; end: Date }[] }`. `blocked` holds time off plus the occupied ranges of confirmed bookings.
- `availableSlots(input: { date: string; timeZone: string; durationMinutes: number; bufferMinutes: number; staff: StaffAvailability[]; closedDates: string[]; rules: BookingRules; now: Date; ignoreWindow?: boolean }): { staffId: string; startsAt: Date }[]`, sorted by time, then staff order.
- `occupiedUntil(startsAt, durationMinutes, bufferMinutes): Date`.

Rules:

- Candidate starts step from each working range's start by `slotStepMinutes`, while start plus duration fits in the range. The buffer may run past the range end.
- A candidate is dropped if `[start, start + duration + buffer)` overlaps anything blocked, if the date is closed, if it is before `now + minNotice`, or if its date is after today plus `maxDaysAhead` (in the workspace time zone).
- `ignoreWindow` skips the notice and days-ahead rules. The dashboard uses it so walk-ins can be booked.

Tests:

- 09:00–12:00 with a 60-minute service and a 15-minute step gives 09:00…11:00.
- A break between 12:00 and 13:00 removes slots that would run into it.
- Time off and an existing booking with a buffer block the right starts.
- A closed date gives nothing.
- Minimum notice and days ahead apply, and `ignoreWindow` lifts them.
- Two staff are listed in time order.
- 1 November 2026 in America/Chicago gives 09:00 local = 15:00Z.
- A duration that doesn't fit gives nothing.

### Task 2: Bookings in the database

**Files:**

- Schema: `src/db/schema/bookings.ts` (`customers`, `bookings`, `bookingEvents`, `emailLog`, enum `bookingStatus`).
- `src/db/schema/workspaces.ts`: rule columns. `src/db/schema/staff.ts`: `calendarToken`.
- Migrations `<ts>_bookings.sql` (generated) and `<ts>_bookings_rules.sql`.
- `src/features/bookings/{schemas,records,queries}.ts`.
- Tests: `tests/integration/bookings.test.ts`. Seed helpers `setTestStaffHours` and `linkTestStaffService` in `tests/helpers/seed.ts`.

**Produces:**

- `workspaces`: `slot_step_minutes` (one of 5, 10, 15, 20, 30, 60), `min_notice_minutes` (0–10080), `max_days_ahead` (1–365), `cancellation_window_hours` (0–168), all with defaults. Granted for update.
- `staff.calendar_token`: unique text, a random default (`encode(gen_random_bytes(24),'hex')`), granted for update.
- `customers`: `id`, `workspace_id`, `name` (1–120), `email`, `phone` (≤40), timestamps; unique `(workspace_id, lower(email))`; unique `(id, workspace_id)`.
- `bookings`:
  - `id`, `workspace_id`;
  - `customer_id`, `staff_id` and `service_id`, each with a composite FK that sets only that column to null on delete;
  - copies `service_name`, `staff_name`, `duration_minutes`, `buffer_minutes` and `price_cents` (null allowed);
  - `starts_at`, `ends_at` and `occupied_until`, with the check `starts_at < ends_at <= occupied_until`;
  - `status` (default confirmed), `notes` (≤500), `source` (`dashboard` | `customer`), `manage_token_hash` (unique), `cancelled_at`, timestamps.
- Exclusion `bookings_no_overlap` on `(staff_id with =, tstzrange(starts_at, occupied_until) with &&) where (status = 'confirmed')`.
- Policies:
  - `bookings`: members select, insert and update. No delete.
  - `customers`: members select, insert and update; managers delete.
  - `booking_events`: members select and insert; append-only.
  - `email_log`: members select; writes only through the privileged mailer.
- Update grants: bookings (`staff_id, staff_name, starts_at, ends_at, occupied_until, status, notes, cancelled_at, updated_at`), customers (`name, phone, updated_at`).
- `getAvailability(claims | "privileged", workspaceId, { serviceId, staffId: string | "any", date, ignoreWindow, excludeBookingId? }): Promise<{ staffId; staffName; startsAt }[]>` loads the facts and calls the engine. Only active staff who perform the service count.
- `createBookingRecord(claims, workspaceId, input: { serviceId; staffId: string | "any"; startsAt: Date; customer: { name; email; phone }; notes; source }): Promise<{ ok: true; id; manageToken } | { ok: false; error: "slot_taken" | "not_allowed" | "not_available" }>`.
  - Checks the slot is in `getAvailability` (the dashboard sets `ignoreWindow`).
  - Upserts the customer and inserts the booking with copies and a manage token hash.
  - For "any", tries qualified staff with the fewest confirmed bookings that day first, moving to the next on 23P01.
  - Writes a `created` event.
- `rescheduleBookingRecord(claims, workspaceId, bookingId, { staffId, startsAt })`, `cancelBookingRecord`, `setBookingStatusRecord(…, "completed" | "no_show")`. Each writes an event and maps 23P01 to `slot_taken`.
- `listBookingsForDay(claims, workspaceId, date, timeZone)` returns bookings that are not cancelled, with customer details.

Tests:

- Members (staff role) can book; outsiders can't see bookings.
- Concurrency: two `createBookingRecord` calls for the same staff and slot via `Promise.all` give exactly one `ok`.
- A raw insert overlapping a buffer fails with 23P01; a cancelled booking doesn't block.
- "Any available" picks the less-busy qualified staff member and skips one who doesn't do the service.
- Reschedule into a taken slot gives `slot_taken` and keeps the old time.
- Copies survive a service price change.
- Managers can't change `workspace_id` or `price_cents` on a booking (42501).
- Deleting a staff member with upcoming confirmed bookings is refused (`has_upcoming_bookings`); past bookings keep `staff_name` with `staff_id` null.

### Task 3: Dashboard calendar and booking rules settings

**Files:**

- Calendar: `src/app/w/[slug]/calendar/{page,day-grid,booking-dialog,new-booking-dialog}.tsx`, `src/features/bookings/actions.ts`.
- Settings: `src/app/w/[slug]/settings/booking-rules-form.tsx`.
- Changes: nav items, `deleteStaff` guard, setup checklist untouched.

Behaviour:

- **Calendar:**
  - "Calendar" sits in the nav for every member, after Overview.
  - The day view has a column per active staff member and a time axis from the earliest start to the latest end of that day's hours (default 09:00–17:00). There are previous, next and today buttons and a date input, using `?date=`.
  - Bookings show as blocks with the customer, service and time.
  - "New booking" opens a dialog with "Service", "Staff member" (including "Any available"), "Date", "Time" (slot buttons from `getAvailability` with `ignoreWindow`), "Customer name", "Email", "Phone (optional)" and "Notes (optional)", saved with "Book appointment".
  - Clicking a booking opens its details with "Reschedule" (same slot picker), "Mark completed", "Mark no-show" and "Cancel booking" (with a confirm).
  - Errors: "That time was just taken. Pick another." and "That time isn't available."
- **Booking rules:** a Settings section "Booking rules" with "Time between start times", "Minimum notice (hours)", "Book up to (days ahead)", "Cancellation window (hours)" and "Save rules".
- **Staff deletion:** `deleteStaff` returns "Move or cancel their upcoming bookings first." when needed.

Tests: unit tests for the day-grid layout maths (`gridRange`, block top and height) and the nav order.

### Task 4: Emails, manage links and calendar feeds

**Files:**

- `src/lib/ics.ts`, `src/privileged/mailer.ts`, `src/privileged/booking-emails.ts`, `src/privileged/manage.ts` (token lookup, cancel, reschedule), `src/privileged/calendar-feed.ts`.
- `src/app/b/[token]/{page,manage-booking}.tsx` and `src/app/api/calendar/[token]/route.ts`.
- Staff page section "Calendar feed".
- `src/env/schema.ts`: `RESEND_API_KEY` and `EMAIL_FROM` (both optional). The ESLint `ignores` gets `src/privileged/**`.

Behaviour:

- **Mailer:**
  - `sendEmail({ workspaceId, bookingId?, kind, to, subject, html, text, attachments? })` writes an `email_log` row.
  - With `RESEND_API_KEY` set, it posts to `https://api.resend.com/emails` and records `sent` with the provider id, or `failed` with the error.
  - Without a key it records `not_sent`, so local and test runs never send.
  - A failed send never fails the booking.
- **Emails:** confirmation (with `invite.ics` and the manage link), rescheduled (new .ics), and cancelled. Each shows the business name, service, staff, and date and time in the business time zone.
- **ICS:** `bookingIcs({ uid, start, end, summary, location?, description, method })` writes RFC 5545 text with CRLF line endings, UTC times, escaped commas, semicolons and newlines, and lines folded at 75 octets.
- **Manage page `/b/[token]`:** looks the booking up by token hash and shows the details.
  - The link works until the appointment starts. After that it shows "This appointment has passed.", and a cancelled booking shows "This appointment was cancelled.".
  - Inside the cancellation window it shows "It's too close to your appointment to change it online. Please contact {business}.".
  - Otherwise there are "Cancel appointment" (with a confirm) and "Reschedule" buttons. Rescheduling offers a date, then slots for the same staff member and service, respecting the booking rules.
  - Customer changes write events with no actor and send the matching email.
- **Calendar feed:** `GET /api/calendar/{token}` returns `text/calendar` with the staff member's confirmed bookings from 30 days back to 180 days ahead. An unknown token gives a 404.
  - The staff page shows the feed URL with "Copy link" and "Reset link" (with a confirm); resetting makes the old URL stop working.

Tests:

- Unit: ICS escaping, folding, CRLF and UTC format.
- Integration:
  - mailer `not_sent` without a key;
  - manage lookup refuses unknown, expired and cancelled bookings;
  - cancelling inside the window is refused for customers;
  - a customer reschedule into a taken slot gives `slot_taken`;
  - the feed for staff A never includes staff B's or another workspace's bookings;
  - resetting the token changes the URL.

### Task 5: Ship

- Full gate: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build`, then `CI=1 npx playwright test --workers=2`.
- New e2e `tests/e2e/bookings.spec.ts`:
  - an owner with seeded staff, service and hours books "Ana Ruiz" from the calendar and sees the block;
  - opening the booking and rescheduling moves it;
  - the manage link from the `email_log` row cancels it, and the calendar no longer shows it.
- One screenshot pass of the calendar, the dialogs, and the manage page on desktop and phone.
- Write `docs/superpowers/plans/2026-10-25-m3-booking-engine-decisions.md` and update the README status. Ask Daksh once before shipping. Then run `npx supabase db push --linked --yes` first, push main, and confirm CI.
- Daksh adds `RESEND_API_KEY` and `EMAIL_FROM` on Vercel when he has a Resend account. Until then, emails are logged as not sent.

# Milestone 2: decisions log

Calls made while building milestone 2 that differ from or add to [the plan](2026-10-25-m2-business-facts.md), each with what it costs if it turns out wrong. Kept so reviewers can see why the code looks the way it does.

## Rulings

- **Setup:** built on `main` directly, committing per task and pushing at Task 8, the same as milestone 1 — cost if wrong: none.
- **Task 1:** the lockfile regeneration and local `npm ci` took over 10 minutes; I waited for them to finish before running tests — cost if wrong: none.
- **Task 2:** local `supabase db reset` hung on the unhealthy log-analytics containers, so `[analytics] enabled = false` in supabase/config.toml; CI already excluded them — cost if wrong: no local log viewer in Studio.
- **Task 2:** added `centsToInput` (money.ts) for the edit form, `TextareaField`/`CheckboxField`, shared `CHECK_FIELDS`/`NOT_ALLOWED` messages, and `getManagerContext` in its own file so records don't import session code — cost if wrong: none.
- **Task 2:** the price hint reads "In {currency}. Leave blank if it varies.", and uncategorised services group under "Other", shown last — cost if wrong: copy edits.
- **Task 2 → 5:** the "{n} staff" count on services waited for Task 5, because `staff_services` only exists from Task 3 — cost if wrong: none.
- **Task 3:** shared row-level-security helpers in `src/db/schema/rls.ts` (`businessDataPolicies`), and `Refused`/`assertManager` live in `features/workspaces/access.ts` for every business table — cost if wrong: a small move back.
- **Task 3:** profile updates and deletes rely on the row policies (0 rows means `not_allowed`) instead of a separate role check, matching the services records; creates and the staff-scoped replace and add writes call `assertManager` — cost if wrong: one extra check per write.
- **Task 3:** `PG_FOREIGN_KEY_VIOLATION` ("23503") joined the other codes in `src/db/errors.ts` — cost if wrong: none.
- **Task 4:** `weekToRows`/`rowsToWeek` in weekly-hours.ts are the one mapping between the editor's week and the table rows, for staff hours and opening hours alike — cost if wrong: none.
- **Task 4:** adding a closed day before today (in the business's time zone) is refused with "Pick today or a later date.", because the list hides past days and the date would save and vanish — cost if wrong: one extra message.
- **Task 4 and 5:** e2e tests use next year's dates instead of the plan's literal 2026 dates, which would go stale after this December — cost if wrong: none.
- **Task 4:** accessible names "Open on {Day}", "Add hours on {Day}" and "Remove {Day} hours (n)"; the native clock icon on time inputs is hidden below the `sm` breakpoint so "AM"/"PM" fit at 375px — cost if wrong: copy tweaks.
- **Task 5:** the end-to-end test found that Drizzle writes column names without their table in a single-table select, so `hasHours` compared `staff_hours.staff_id` with `staff_hours.id` and was always false (the service and staff counts only worked because `staff_services` has no `id`). All three correlated subqueries are now plain SQL with the outer table named; "the list shows who has hours and how many services" went red, then green — cost if wrong: a column rename must update these strings by hand.
- **Task 5:** adding time off that has already ended is refused with "That time off has already ended.", for the same reason as past closed days — cost if wrong: one message.
- **Task 5:** "Copy opening hours" appears only when the business has opening hours; a staff page with an id that isn't a uuid is a 404; the Time off section names the business's time zone — cost if wrong: copy tweaks.
- **Task 5:** added `SelectField` (native select) and a `value` on `CheckboxField`; "All day" is an uncontrolled checkbox and CSS hides the time fields, because the lint rule forbids resetting state in an effect — cost if wrong: none.
- **Task 5–7:** actions on staff, policies and answers revalidate the whole `/w/[slug]` layout, since counts show on other pages and the setup checklist — cost if wrong: slightly more re-rendering.
- **Task 6:** `POLICY_KINDS` and the kind list for validation live in `features/policies/schemas.ts` so client components can use them; inserts are typed against the database enum, so a mismatch fails typecheck — cost if wrong: one list to keep in step.
- **Task 6:** standard policies save with `INSERT … ON CONFLICT` on the partial unique index; custom policies update by id only where `kind = 'custom'`; updates set `updated_at = now()` from the database clock so "newest edit first" agrees with inserts — cost if wrong: none.
- **Task 6:** the five standard cards name their buttons "Save {title}" and "Clear {title}" for screen readers; Clear submits a separate hidden form — cost if wrong: none.
- **Task 6:** added copy: "No custom policies yet.", "Anything else customers ask about, like children or pets.", "Updated {date} by {name}" on answers, "No answers match …", and delete confirmations — cost if wrong: copy tweaks.
- **Task 6:** the "1 Issue" dev badge in screenshot runs is a hydration warning caused by Playwright hiding the text cursor before the page hydrates; the same pages loaded without screenshots log nothing — cost if wrong: a real hydration bug missed.
- **Task 7:** added `tests/integration/setup.test.ts` for `getSetupFacts`; "bookable staff" means active, with at least one service and some hours — cost if wrong: none.
- **Task 7:** when all six steps are done, the checklist shows "Your business details are complete." with a full bar and no step list; each step link says "(done)" or "(to do)" to screen readers — cost if wrong: a layout tweak.
- **Task 8:** the full e2e suite in CI mode failed locally with this machine's default worker count (waits running out under load) and passed 33/33 with `--workers=2`, the count GitHub's runner uses. The staff set-up flow takes about 15 seconds on its own, half the 30-second CI limit, so it is marked `test.slow()` — cost if wrong: a slow test hides a real slowdown.

## Self-review (inline, no background reviewer)

Checked the whole milestone diff (`1bd6ad3..HEAD`):

- All nine new tables have row level security on, read for members and write for owners and admins, and UPDATE revoked; services, staff, policies and verified answers grant only their editable columns.
- Staff links, hours and time off point at `(id, workspace_id)` pairs, so they can't cross workspaces; tested.
- All 16 server actions go through `getManagerContext`, and all six new pages call `requireManager`.
- Each line of the plan's Review Focus has a test: overlapping hours, typed prices, time zones across daylight saving, cross-workspace links, and cleanup on delete or when a member leaves.

## Deferred minors

- A manager could set `created_by`/`updated_by` on a verified answer to a teammate's id by calling the database API directly, which changes only the "Updated by" line. A trigger that stamps `auth.uid()` would close it.
- Through the same API, a manager could give a standard policy a different title. The app always uses the fixed title.
- Clearing a time box in the weekly hours editor snaps back to the previous time (people type over it instead).

# FrontDesk AI, Milestone 2 (Business facts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners and admins can record everything the receptionist must never guess: services, staff (with their services, weekly hours and time off), opening hours and closed days, policies and verified answers, with a setup checklist on the overview.

**Architecture:** Each fact type gets a Drizzle table with RLS (members read, owners and admins write), column-level UPDATE grants, and composite foreign keys that make cross-workspace links impossible in the database. Weekly hours are stored as minutes since local midnight, one row per time range, with Postgres exclusion constraints (btree_gist) rejecting overlaps. Every feature follows the M1 shape: `schemas.ts` (Zod), `records.ts` (writes through `withRls`), `queries.ts` (reads), `actions.ts` (server actions), plus a manager-only page.

**Tech Stack:** Next.js 16.4.3, Drizzle 0.45.4, Supabase Postgres 17 (btree_gist), Zod 4.6.7, date-fns 4.4.0 + @date-fns/tz 1.5.0, shadcn/ui on Base UI, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-24-frontdesk-ai-design.md` (sections 4.1 "skipped and resumed", 4.2, 6, 7, 10 milestone 2). Milestone 1 plan and decisions log: `docs/superpowers/plans/2026-10-24-m1-foundation*.md`.

## Scope

In: services (name, description, category, duration, buffer after, price or "from" price, bookable online), staff (name, title, bio, optional link to a team member, active, which services they perform, weekly hours with breaks, time off), business opening hours and closed days, policies (cancellation, late arrivals, payment, parking, accessibility, custom), verified answers, a setup checklist on the overview (the spec's resumable wizard), navigation, deployment of the new migrations.

Out, with reasons:

- Staff photos: they need a Storage bucket and policies, and nothing shows them until the widget (M6). Added in M6.
- Structured booking rules (cancellation notice in hours, minimum notice, slot step, maximum days ahead): they only matter to the booking engine, so they arrive with it in M3. M2's cancellation policy is the text the receptionist quotes.
- Staff editing their own hours or time off: M3 gives staff their own calendar view. In M2 these pages are for owners and admins only.

## Global Constraints

- Everything in the M1 plan's Global Constraints still applies (paths relative to the project folder, exact versions with `npm i -E`, TypeScript 5.9.3, `withRls` for all app data, no `@db/admin` in app code, Zod on every action, `useActionForm` for forms, plain copy without exclamation marks, layouts working from 320px, commits ending with the Co-Authored-By line).
- The app runs on port **3300**. Restart the dev server after adding exports to a `"use server"` file (a stale server-action map gives "Cannot read properties of undefined (reading 'apply')").
- Every new table: RLS policies (members `select`; owners and admins `insert`, `update`, `delete`) using `private.is_member(workspace_id)` and `private.has_role(workspace_id, array['owner','admin'])`, then in the same task's custom migration `revoke update on <table> from authenticated, anon` and `grant update (<editable columns>, updated_at)` for exactly the columns the app edits. Tables that are replaced rather than edited get no UPDATE grant.
- Every child row carries `workspace_id` and points at its parent with a composite foreign key `(parent_id, workspace_id) → parent(id, workspace_id)`, so a row can never link to another workspace's data. Parents get `unique (id, workspace_id)` for this.
- Weekdays are ISO numbers, Monday = 1 … Sunday = 7. Times of day are integers, minutes since local midnight, 0–1440, in the workspace's time zone. Ranges are half-open `[start, end)`.
- Money is stored in minor units (`price_cents`) in the workspace currency. Digits per currency come from `Intl.NumberFormat(…, { style: "currency", currency }).resolvedOptions().maximumFractionDigits`.
- After adding or changing dependencies, regenerate `package-lock.json` with GitHub's npm before committing (M1 lesson: npm 11.19 on Linux rejected a Windows npm 11.6 lockfile):
  ```bash
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app node:24 npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  ```
  then run `npm ci` locally.
- Business pages are for owners and admins: pages call `requireManager(slug)` (Task 1), which returns 404 for staff.
- Copy: where this plan gives exact text, use it word for word.

## Review Focus

1. Hours that overlap or run backwards (09:00–12:00 plus 11:00–14:00 on the same day, or 13:00–12:00) must be refused with a clear message and nothing saved, while back-to-back ranges (09:00–12:00, 12:00–13:00) are allowed. Tests: Task 1 `parseWeeklyHours` cases and Task 3 "the database refuses overlapping hours".
2. Prices typed the way people type them (`$45`, `45.5`, `1,200`, blank) must save correctly, and impossible ones (`-5`, `45.505`, `45.5` in yen) must be refused. Test: Task 1 `parsePrice` cases.
3. Time off entered for a business in another time zone, including across a daylight-saving change, must land on the business's local hours, not the browser's. Test: Task 1 `zonedDateTimeToUtc` cases with America/Chicago around 1 November 2026.
4. A crafted request from a manager of one workspace that links another workspace's staff or service IDs must fail in the database. Tests: Task 2 and Task 3 "cross-workspace links are refused".
5. Deleting a service or staff member must clean up their links, hours and time off, and a team member who leaves must stay as a staff profile without the login link. Tests: Task 3 "deleting a staff member removes their hours, time off and services" and "a member leaving keeps the staff profile".

---

### Task 1: Shared helpers, access check and dependencies

**Files:**

- Create: `src/lib/money.ts`, `src/lib/duration.ts`, `src/lib/clock.ts`, `src/features/hours/weekly-hours.ts`, `src/features/workspaces/access.ts`, `tests/unit/money.test.ts`, `tests/unit/duration.test.ts`, `tests/unit/clock.test.ts`, `tests/unit/weekly-hours.test.ts`
- Modify: `src/features/team/records.ts` (use `getMyRole` from access.ts, delete the local `myRole`), `src/lib/auth/session.ts` (add `requireManager`), `package.json`, `package-lock.json`

**Interfaces:**

- Produces:
  - `currencyDigits(currency: string): number`; `parsePrice(input: string, currency: string): { ok: true; cents: number | null } | { ok: false }`; `formatPrice(cents: number | null, currency: string, isFrom: boolean): string` in `src/lib/money.ts`
  - `formatDuration(minutes: number): string` in `src/lib/duration.ts`
  - `minutesToClock(minutes: number): string` ("09:30"), `clockToMinutes(value: string): number | null`, `formatClock(minutes: number): string` ("9:30 AM"), `zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date` in `src/lib/clock.ts`
  - `type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7`; `WEEKDAYS: { day: Weekday; label: string }[]` (Monday … Sunday); `type TimeRange = { start: number; end: number }`; `type WeeklyHours = Record<Weekday, TimeRange[]>`; `emptyWeek(): WeeklyHours`; `parseWeeklyHours(json: string): { ok: true; hours: WeeklyHours } | { ok: false; error: string }` in `src/features/hours/weekly-hours.ts`
  - `getMyRole(tx: RlsTx, claims: AuthClaims, workspaceId: string): Promise<WorkspaceRole | null>` in `src/features/workspaces/access.ts`
  - `requireManager(slug: string): Promise<{ claims: AuthClaims; membership: Membership }>` in `src/lib/auth/session.ts` (`requireMembership`, then `notFound()` unless `canEditWorkspace`)

- [ ] **Step 1: Install and pin, then regenerate the lockfile for Linux**

```bash
npm i -E date-fns@4.4.0 @date-fns/tz@1.5.0
```

Then run the lockfile command from Global Constraints and `npm ci`. Expected: both succeed; `git diff --stat package-lock.json` shows only additions for the two packages and any `"peer"` marker changes.

- [ ] **Step 2: Write the failing unit tests**

`tests/unit/money.test.ts`:

```ts
it.each([
  ["45", "USD", { ok: true, cents: 4500 }],
  ["$45.50", "USD", { ok: true, cents: 4550 }],
  ["1,200", "USD", { ok: true, cents: 120000 }],
  [" ", "USD", { ok: true, cents: null }],
  ["4500", "JPY", { ok: true, cents: 4500 }],
  ["45.5", "JPY", { ok: false }],
  ["-5", "USD", { ok: false }],
  ["45.505", "USD", { ok: false }],
  ["abc", "USD", { ok: false }],
  ["1000001", "USD", { ok: false }],
])("parsePrice(%j, %s)", (input, currency, expected) =>
  expect(parsePrice(input, currency)).toEqual(expected),
);
it.each([
  [18000, "USD", false, "$180"],
  [4550, "USD", false, "$45.50"],
  [18000, "USD", true, "From $180"],
  [null, "USD", false, "No price listed"],
  [4500, "JPY", false, "¥4,500"],
])("formatPrice(%j, %s, from=%s) is %s", (cents, currency, isFrom, expected) =>
  expect(formatPrice(cents, currency, isFrom)).toBe(expected),
);
```

`tests/unit/duration.test.ts`: `formatDuration(45) === "45 min"`, `(60) === "1 hr"`, `(90) === "1 hr 30 min"`, `(180) === "3 hr"`.

`tests/unit/clock.test.ts`:

```ts
expect(minutesToClock(570)).toBe("09:30");
expect(minutesToClock(1440)).toBe("24:00");
expect(clockToMinutes("09:30")).toBe(570);
expect(clockToMinutes("9:30")).toBe(570);
expect(clockToMinutes("24:00")).toBe(1440);
expect(clockToMinutes("24:30")).toBeNull();
expect(clockToMinutes("ab")).toBeNull();
expect(formatClock(570)).toBe("9:30 AM");
expect(formatClock(780)).toBe("1:00 PM");
expect(formatClock(0)).toBe("12:00 AM");
// US daylight saving ends on 1 November 2026: 31 Oct is UTC-5, 2 Nov is UTC-6.
expect(
  zonedDateTimeToUtc("2026-10-31", "09:00", "America/Chicago").toISOString(),
).toBe("2026-10-31T14:00:00.000Z");
expect(
  zonedDateTimeToUtc("2026-11-02", "09:00", "America/Chicago").toISOString(),
).toBe("2026-11-02T15:00:00.000Z");
expect(
  zonedDateTimeToUtc("2026-10-31", "09:00", "Asia/Kolkata").toISOString(),
).toBe("2026-10-31T03:30:00.000Z");
```

`tests/unit/weekly-hours.test.ts` (build JSON with `JSON.stringify({ ...emptyWeek(), 1: [...] })`):

- valid week with Monday `[{start:540,end:720},{start:780,end:1020}]` parses, ranges sorted by start
- back-to-back `[{540,720},{720,780}]` is allowed
- overlap `[{540,720},{660,840}]` gives `{ ok: false, error: "Times on the same day can't overlap." }`
- backwards `[{780,720}]` gives `"End time must be after start time."`
- out of range `[{-10,60}]` or `[{60,1450}]` gives `"Use times between 00:00 and 24:00."`
- five ranges on one day gives `"Add up to 4 time ranges a day."`
- `"not json"` and a missing weekday key give `"Those hours couldn't be read. Try again."`

Run: `npm test` Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the helpers**

`parsePrice`: trim; empty means `null`; strip one leading currency symbol (any non-digit, non-dot, non-minus prefix) and thousands commas; accept `^\d+(\.\d+)?$`; refuse more decimals than `currencyDigits`; refuse more than 1,000,000 major units; return integer minor units without floating-point error (split on the dot, don't multiply floats). `formatPrice`: `Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: whole ? 0 : digits })`. `zonedDateTimeToUtc`: `new TZDate(year, month - 1, day, hours, minutes, timeZone)` from `@date-fns/tz`, returned as a plain `Date`. `parseWeeklyHours`: parse, require keys "1"…"7" with arrays of `{start,end}` integers, sort, then check bounds, order, overlaps and count, in that order.

- [ ] **Step 4: Add `getMyRole` and `requireManager`; switch team records to `getMyRole`**

- [ ] **Step 5: Verify and commit**

Run: `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`. Expected: all pass (team integration tests prove the refactor).

```bash
git add -A && git commit -m "feat: money, duration, clock and weekly-hours helpers"
```

---

### Task 2: Services

**Files:**

- Create: `src/db/schema/services.ts`, migrations `<ts>_services.sql` (generated) and `<ts>_services_rules.sql` (custom), `src/features/services/schemas.ts`, `records.ts`, `queries.ts`, `actions.ts`, `src/app/w/[slug]/services/page.tsx`, `services-list.tsx`, `service-dialog.tsx`, `tests/unit/service-schema.test.ts`, `tests/integration/services.test.ts`, `tests/e2e/services.spec.ts`
- Modify: `src/db/schema/index.ts`, `tests/helpers/seed.ts` (add `createTestService`)

**Interfaces:**

- Consumes: Task 1 helpers, `requireManager`, `getMyRole`, `canEditWorkspace`
- Produces:
  - Table `services`: `id`; `workspaceId` (cascade); `name` text; `description` text default `''`; `category` text default `''`; `durationMinutes` integer; `bufferMinutes` integer default 0; `priceCents` integer null; `priceIsFrom` boolean default false; `bookableOnline` boolean default true; `createdAt`; `updatedAt`. Checks: name 2–80 chars, description ≤ 1000, category ≤ 40, duration 5–720 and `% 5 = 0`, buffer 0–240 and `% 5 = 0`, `price_cents >= 0`. Unique `(id, workspace_id)`; unique index `(workspace_id, lower(name))`.
  - `serviceInputSchema(currency: string)` → `{ name, description, category, durationMinutes: number, bufferMinutes: number, priceCents: number | null, priceIsFrom: boolean, bookableOnline: boolean }` (checkboxes arrive as `"on"` or missing)
  - `type ServiceInput`; `type Service = ServiceInput & { id: string; staffCount: number }`
  - `listServices(claims, workspaceId): Promise<Service[]>` (category, then name, case-insensitive)
  - `createServiceRecord(claims, workspaceId, input): Promise<{ ok: true; id: string } | { ok: false; error: "not_allowed" | "duplicate_name" }>`; `updateServiceRecord(claims, workspaceId, serviceId, input): Promise<"ok" | "not_allowed" | "duplicate_name">`; `deleteServiceRecord(claims, workspaceId, serviceId): Promise<"ok" | "not_allowed">`
  - Actions (slug bound): `saveService(slug, prev, formData)` (creates without `serviceId`, updates with it), `deleteService(slug, prev, formData)`
  - Seed helper `createTestService(workspaceId: string, owner: TestUser, opts?: { name?: string; durationMinutes?: number }): Promise<{ id: string }>`

Custom migration (after the generated one):

```sql
revoke update on public.services from authenticated, anon;
grant update (name, description, category, duration_minutes, buffer_minutes,
  price_cents, price_is_from, bookable_online, updated_at) on public.services to authenticated;
```

Exact copy: page title "Services"; empty state "No services yet. Add the first one your customers can book."; button "Add service"; dialog titles "Add a service" / "Edit service"; fields "Name", "Category (optional)", "Description (optional)", "Duration (minutes)", "Buffer after (minutes)" with hint "Cleanup time before the next booking.", "Price (optional)" with hint "Leave blank if it varies.", checkboxes "Show as a starting price" and "Customers can book this online"; buttons "Save service", "Delete"; delete confirm "Delete {name}? Staff who perform it will be unlinked."; errors "Use 2 to 80 characters.", "Use 5 to 720 minutes, in steps of 5.", "Use 0 to 240 minutes, in steps of 5.", "Enter a price like 45 or 45.50.", "You already have a service with that name.". Rows show name, `formatDuration`, `formatPrice`, category heading, "{n} staff", and a "Not bookable online" badge when off.

- [ ] **Step 1: Failing tests.** Unit: the schema turns `{ name: " Balayage ", durationMinutes: "180", bufferMinutes: "15", price: "180", priceIsFrom: "on", bookableOnline: "on" }` into `{ name: "Balayage", durationMinutes: 180, bufferMinutes: 15, priceCents: 18000, priceIsFrom: true, bookableOnline: true, description: "", category: "" }`; a missing `bookableOnline` gives `false`; `durationMinutes: "7"` gives "Use 5 to 720 minutes, in steps of 5.". Integration (`services.test.ts`): members read services and staff can't create, update or delete (`42501` or 0 rows); a manager creates and edits; the same name in different case gives `duplicate_name`; an admin can't change `workspace_id` (`42501`); a manager of workspace A can't insert a service with workspace B's id (`42501`). Run and see them fail.
- [ ] **Step 2: Schema, generate the migration, write the custom migration, `npm run db:reset`.**
- [ ] **Step 3: Schemas, records, queries; run unit and integration tests, see them pass.**
- [ ] **Step 4: Page, list and dialog.** Category input uses a `<datalist>` of existing categories. Write `tests/e2e/services.spec.ts`: an owner adds "Balayage" (category "Colour", 180 min, price 180, starting price on) and sees "3 hr" and "From $180" under "Colour"; editing the price to 195.50 shows "From $195.50"; adding "balayage" again shows the duplicate error; deleting removes it; a staff member gets 404 on `/w/<slug>/services`. Run and see it pass.
- [ ] **Step 5: Commit** ("feat(services): services with prices, durations and buffers").

---

### Task 3: Staff, their services, hours and time off (database)

**Files:**

- Create: `src/db/schema/staff.ts` (tables `staff`, `staffServices`, `staffHours`, `staffTimeOff`), migrations `<ts>_staff.sql` (generated) and `<ts>_staff_rules.sql` (custom), `src/features/staff/schemas.ts`, `records.ts`, `queries.ts`, `tests/unit/staff-schemas.test.ts`, `tests/integration/staff.test.ts`
- Modify: `src/db/schema/index.ts`, `tests/helpers/seed.ts` (add `createTestStaff`)

**Interfaces:**

- Consumes: Task 1 (`WeeklyHours`, `zonedDateTimeToUtc`, `getMyRole`), Task 2 (`services` table)
- Produces:
  - `staff`: `id`; `workspaceId`; `name` (2–80); `title` default `''` (≤ 60); `bio` default `''` (≤ 600); `userId` uuid null; `active` boolean default true; `createdAt`; `updatedAt`. Unique `(id, workspace_id)`; unique index `(workspace_id, user_id) where user_id is not null`.
  - `staff_services`: `workspaceId`, `staffId`, `serviceId`; primary key `(staff_id, service_id)`; FKs `(staff_id, workspace_id) → staff(id, workspace_id)` and `(service_id, workspace_id) → services(id, workspace_id)`, both cascade.
  - `staff_hours`: `id`, `workspaceId`, `staffId`, `weekday` smallint (1–7), `startMinute` smallint (0–1439), `endMinute` smallint (1–1440), check `start_minute < end_minute`; FK `(staff_id, workspace_id) → staff` cascade.
  - `staff_time_off`: `id`, `workspaceId`, `staffId`, `startsAt`, `endsAt` timestamptz, `note` default `''` (≤ 120), check `ends_at > starts_at`; FK `(staff_id, workspace_id) → staff` cascade.
  - `staffProfileSchema` → `{ name, title, bio, userId: string | null, active: boolean }`; `staffServicesSchema` → `{ serviceIds: string[] }` (repeated `serviceIds` form field, each a uuid); `timeOffSchema` → `{ startDate, endDate, allDay: boolean, startTime: string | null, endTime: string | null, note }` with "End must be after start."
  - `type StaffSummary = { id; name; title; active; userId: string | null; serviceCount: number; hasHours: boolean }`; `type StaffDetail = { profile: StaffSummary & { bio: string }; serviceIds: string[]; hours: WeeklyHours; timeOff: { id: string; startsAt: Date; endsAt: Date; note: string }[]; linkableMembers: { userId: string; name: string }[] }`
  - `listStaff(claims, workspaceId): Promise<StaffSummary[]>`; `getStaffDetail(claims, workspaceId, staffId): Promise<StaffDetail | null>` (time off from now onwards, oldest first; linkable members are workspace members not linked to another staff profile, plus the current link)
  - `createStaffRecord(claims, workspaceId, profile): Promise<{ ok: true; id: string } | { ok: false; error: "not_allowed" | "member_already_linked" }>`; `updateStaffProfileRecord(…, staffId, profile): Promise<"ok" | "not_allowed" | "member_already_linked">`; `deleteStaffRecord(…, staffId): Promise<"ok" | "not_allowed">`; `setStaffServicesRecord(…, staffId, serviceIds): Promise<"ok" | "not_allowed">` (replace in one transaction); `replaceStaffHoursRecord(…, staffId, hours: WeeklyHours): Promise<"ok" | "not_allowed">`; `addTimeOffRecord(…, staffId, range: { startsAt: Date; endsAt: Date; note: string }): Promise<"ok" | "not_allowed">`; `deleteTimeOffRecord(…, timeOffId): Promise<"ok" | "not_allowed">`. Each checks `getMyRole` is owner or admin before writing, and every staff-scoped write also filters by `workspace_id`.
  - Seed helper `createTestStaff(workspaceId: string, owner: TestUser, opts?: { name?: string; userId?: string }): Promise<{ id: string }>`

Custom migration:

```sql
create extension if not exists btree_gist with schema extensions;

-- No overlapping ranges for one person on one weekday.
alter table public.staff_hours add constraint staff_hours_no_overlap
  exclude using gist (staff_id with =, weekday with =, int4range(start_minute, end_minute) with &&);

-- A linked login must belong to a member of the same workspace. When the member leaves,
-- only user_id is cleared, so the staff profile and their bookings stay.
alter table public.staff add constraint staff_member_fk
  foreign key (workspace_id, user_id) references public.memberships (workspace_id, user_id)
  on delete set null (user_id);

revoke update on public.staff, public.staff_services, public.staff_hours, public.staff_time_off
  from authenticated, anon;
grant update (name, title, bio, user_id, active, updated_at) on public.staff to authenticated;
```

(Policies come from the Drizzle schema. `staff_services`, `staff_hours` and `staff_time_off` are replaced or deleted, never updated.)

Time off rule in records: `allDay` means from `startDate` 00:00 to the day after `endDate` 00:00 in the workspace's time zone; otherwise `startDate startTime` to `endDate endTime`. The action reads the time zone from the membership.

- [ ] **Step 1: Failing tests.** Unit: `timeOffSchema` refuses an end before the start; `staffServicesSchema` refuses a non-uuid. Integration (`staff.test.ts`):
  - members read staff; staff-role members can't create (`42501`)
  - "the database refuses overlapping hours": inserting 09:00–12:00 and 11:00–14:00 for one person on Monday fails with `23P01`
  - "cross-workspace links are refused": linking a workspace-B service to a workspace-A staff member fails with `23503`; linking a user who isn't a member fails with `23503`
  - `replaceStaffHoursRecord` swaps a whole week atomically (an invalid week leaves the old rows)
  - `setStaffServicesRecord` replaces the set
  - "deleting a staff member removes their hours, time off and services": counts are 0 afterwards and the services still exist
  - "a member leaving keeps the staff profile": after `removeMemberRecord`, the staff row exists with `user_id` null
  - an admin can't change a staff member's `workspace_id` (`42501`)
  - linking the same member to two profiles gives `member_already_linked`

  Run and see them fail.

- [ ] **Step 2: Schema, generate the migration, write the custom migration, `npm run db:reset`.**
- [ ] **Step 3: Schemas, records, queries; run unit and integration tests, see them pass. Commit** ("feat(staff): staff, their services, hours and time off with database rules").

---

### Task 4: Weekly hours editor, opening hours and closed days

**Files:**

- Create: `src/components/business/weekly-hours-editor.tsx`, `src/db/schema/hours.ts` (tables `businessHours`, `closedDays`), migrations `<ts>_hours.sql` (generated) and `<ts>_hours_rules.sql` (custom), `src/features/hours/schemas.ts`, `records.ts`, `queries.ts`, `actions.ts`, `src/app/w/[slug]/hours/page.tsx`, `opening-hours-form.tsx`, `closed-days.tsx`, `tests/integration/hours.test.ts`, `tests/e2e/hours.spec.ts`
- Modify: `src/db/schema/index.ts`

**Interfaces:**

- Consumes: Task 1 (`WeeklyHours`, `WEEKDAYS`, `parseWeeklyHours`, `minutesToClock`, `clockToMinutes`)
- Produces:
  - `business_hours`: `id`, `workspaceId`, `weekday`, `startMinute`, `endMinute`, same checks as `staff_hours`; exclusion `(workspace_id with =, weekday with =, int4range(...) with &&)`.
  - `closed_days`: `id`, `workspaceId`, `date` date, `name` default `''` (≤ 60); unique `(workspace_id, date)`.
  - `<WeeklyHoursEditor name: string defaultValue: WeeklyHours template?: { label: string; hours: WeeklyHours } />`: client component; one row per weekday with an "Open" checkbox, one or more pairs of native `<input type="time" step={300}>`, "Add hours" and remove buttons; writes `JSON.stringify(hours)` to a hidden input `name`; when `template` is given, a button "{template.label}" copies it in. Inputs are labelled "{Day} opens" and "{Day} closes", with " (2)" etc. for extra ranges. Native time inputs stop at 23:59, so a closing time of 00:00 means midnight and is stored as 1440; a new range defaults to 09:00–17:00.
  - `getOpeningHours(claims, workspaceId): Promise<WeeklyHours>`; `listClosedDays(claims, workspaceId, timeZone: string): Promise<{ id: string; date: string; name: string }[]>` (dates on or after today in the workspace's time zone, soonest first)
  - `replaceOpeningHoursRecord(claims, workspaceId, hours): Promise<"ok" | "not_allowed">`; `addClosedDayRecord(…, { date: string; name: string }): Promise<"ok" | "not_allowed" | "duplicate_date">`; `deleteClosedDayRecord(…, id)`
  - Actions: `saveOpeningHours(slug, prev, formData)`, `addClosedDay`, `deleteClosedDay`

Custom migration: the `business_hours_no_overlap` exclusion, then `revoke update on public.business_hours, public.closed_days from authenticated, anon;` (both are replaced or deleted, never updated).

Exact copy: page title "Opening hours"; section "Weekly hours" with "When customers can visit. Staff hours are set on each person's page."; days with no ranges show "Closed"; button "Save hours" (toast "Saved."); section "Closed days" with fields "Date", "Name (optional)" (placeholder "Christmas Day"), button "Add closed day", empty state "No closed days coming up."; errors from `parseWeeklyHours` and "That day is already marked closed.".

- [ ] **Step 1: Failing integration tests:** staff can't replace opening hours (`not_allowed`); overlapping ranges are refused by the database (`23P01`); a range ending at 1440 (midnight) is accepted; a duplicate closed day gives `duplicate_date`; closed days before today in the workspace's time zone aren't listed. Run, see them fail.
- [ ] **Step 2: Tables and migrations, `npm run db:reset`; records and queries; tests pass.**
- [ ] **Step 3: Editor, page and e2e.** `tests/e2e/hours.spec.ts`: an owner opens Tuesday–Saturday 09:00–18:00, saves, reloads and sees the same times; adding 12:00–19:00 on Tuesday alongside shows "Times on the same day can't overlap." and the saved hours don't change; adding "2026-12-25" "Christmas Day" lists it, and adding the same date again shows "That day is already marked closed.". Run and see it pass.
- [ ] **Step 4: Commit** ("feat(hours): opening hours editor and closed days").

---

### Task 5: Staff pages

**Files:**

- Create: `src/features/staff/actions.ts`, `src/app/w/[slug]/staff/page.tsx`, `staff-list.tsx`, `add-staff-dialog.tsx`, `src/app/w/[slug]/staff/[staffId]/page.tsx`, `profile-form.tsx`, `services-form.tsx`, `hours-form.tsx`, `time-off.tsx`, `tests/e2e/staff.spec.ts`

**Interfaces:**

- Consumes: Task 3 records and queries, Task 4 `WeeklyHoursEditor` and `getOpeningHours`, Task 2 `listServices`, Task 1 `formatClock`
- Produces: actions (slug bound) `createStaff`, `saveStaffProfile`, `saveStaffServices`, `saveStaffHours`, `addTimeOff`, `deleteTimeOff`, `deleteStaff`; the detail page `notFound()`s for an unknown `staffId`

Exact copy: list title "Staff"; empty state "No staff yet. Add the people customers can book with."; button "Add staff member" (dialog: "Name", "Job title (optional)" placeholder "Senior stylist"; creating goes to the new person's page); rows show name, title, "Inactive" badge, "{n} services", and "No hours set" when `hasHours` is false. Detail page sections "Profile" ("Name", "Job title (optional)", "Bio (optional)", "Team login (optional)" select with "Not linked", checkbox "Can be booked"), "Services" (checkbox per service, "Save services"), "Weekly hours" (editor with template "Copy opening hours", "Save hours"), "Time off" ("From", "To", "All day" checked by default, optional times, "Note (optional)", "Add time off"; list shows dates in the workspace time zone and a "Remove" button; empty "No time off coming up."), "Delete staff member" (confirm "Delete {name}? Their hours and time off are deleted too."). Error copy for `member_already_linked`: "That team member is already linked to another staff profile.".

- [ ] **Step 1: Pages and actions.**
- [ ] **Step 2: Write `tests/e2e/staff.spec.ts`:** an owner with the service "Balayage" (seed helper) adds "Maya Chen", "Senior stylist"; ticks Balayage and saves; uses "Copy opening hours" (after seeding opening hours) and saves; adds a break by splitting Monday into 09:00–12:00 and 13:00–18:00 and saves; reloading shows those ranges; adds time off "2026-12-24" to "2026-12-26", all day, note "Holiday", which lists as "Dec 24 – Dec 26, 2026"; the staff list shows "1 service" (and "{n} services" for more); deleting Maya returns to the list without her. A staff-role member gets 404 on `/w/<slug>/staff`. Run and see it pass.
- [ ] **Step 3: Commit** ("feat(staff): staff pages with services, hours and time off").

---

### Task 6: Policies and verified answers

**Files:**

- Create: `src/db/schema/policies.ts` (enum `policyKind`, table `policies`), `src/db/schema/answers.ts` (table `verifiedAnswers`), migrations `<ts>_policies_answers.sql` (generated) and `<ts>_policies_answers_rules.sql` (custom), `src/features/policies/{schemas,records,queries,actions}.ts`, `src/features/answers/{schemas,records,queries,actions}.ts`, `src/app/w/[slug]/policies/page.tsx`, `policy-card.tsx`, `custom-policies.tsx`, `src/app/w/[slug]/answers/page.tsx`, `answers-list.tsx`, `answer-dialog.tsx`, `tests/unit/policy-schema.test.ts`, `tests/integration/policies-answers.test.ts`, `tests/e2e/policies.spec.ts`, `tests/e2e/answers.spec.ts`
- Modify: `src/db/schema/index.ts`

**Interfaces:**

- Produces:
  - Enum `policy_kind`: `cancellation`, `late_arrival`, `payment`, `parking`, `accessibility`, `custom`. `POLICY_KINDS: { kind; title; placeholder }[]` for the five standard ones with titles "Cancellations", "Late arrivals", "Payment", "Parking", "Accessibility" and placeholders such as "Cancel or reschedule at least 24 hours ahead to avoid a fee.".
  - `policies`: `id`, `workspaceId`, `kind`, `title` (1–60), `body` (1–1000), `createdAt`, `updatedAt`; unique index `(workspace_id, kind) where kind <> 'custom'`.
  - `verified_answers`: `id`, `workspaceId`, `question` (5–300), `answer` (1–2000), `createdBy` and `updatedBy` → profiles set null, `createdAt`, `updatedAt`; unique index `(workspace_id, lower(question))`.
  - `policyInputSchema` → `{ id: string | null; kind; title; body }` (custom needs a title, standard kinds use their fixed title); `answerInputSchema` → `{ question, answer }`
  - `listPolicies(claims, workspaceId)`; `savePolicyRecord(claims, workspaceId, input): Promise<"ok" | "not_allowed">` (standard kinds: insert or update the one row; custom: insert, or update by `id`); `deletePolicyRecord`
  - `listAnswers(claims, workspaceId)` (newest edit first); `saveAnswerRecord(claims, workspaceId, input & { id: string | null }): Promise<"ok" | "not_allowed" | "duplicate_question">` (sets `createdBy`/`updatedBy`); `deleteAnswerRecord`

Custom migration:

```sql
revoke update on public.policies, public.verified_answers from authenticated, anon;
grant update (title, body, updated_at) on public.policies to authenticated;
grant update (question, answer, updated_by, updated_at) on public.verified_answers to authenticated;
```

Exact copy: policies page title "Policies", intro "Short answers the receptionist quotes word for word. Leave any that don't apply empty."; each standard card has its title, a textarea with its placeholder, "Save" (toast "Saved.") and "Clear" (deletes the row); "Custom policies" with "Add a policy" ("Title", "Policy"). Answers page title "Verified answers", intro "Questions you've answered yourself. The receptionist uses these before anything else."; search box "Search answers"; button "Add answer" (dialog "Question", "Answer", "Save answer"); empty "No verified answers yet."; error "You already have an answer for this question.".

- [ ] **Step 1: Failing tests.** Unit: a custom policy without a title is refused with "Add a title."; a standard kind ignores a submitted title. Integration: staff can't write either table; a second `cancellation` row gives a unique violation while two `custom` rows are fine; duplicate question (different case) gives `duplicate_question`; managers can't change `kind` or `workspace_id` (`42501`). Run, see them fail.
- [ ] **Step 2: Tables, migrations, `npm run db:reset`, records and queries; tests pass.**
- [ ] **Step 3: Pages and e2e.** `policies.spec.ts`: an owner saves a cancellation policy, reloads and sees it; adds a custom "Children" policy; clears the cancellation policy. `answers.spec.ts`: adds "Do you do bridal hair?" with an answer; searching "bridal" shows it and "parking" hides it; editing the answer saves; deleting removes it. Run and see them pass.
- [ ] **Step 4: Commit** ("feat: policies and verified answers").

---

### Task 7: Navigation and setup checklist

**Files:**

- Create: `src/features/setup/checklist.ts`, `src/features/setup/queries.ts`, `src/app/w/[slug]/setup-checklist.tsx`, `tests/unit/checklist.test.ts`, `tests/e2e/setup.spec.ts`
- Modify: `src/components/app-shell/nav-items.ts` and `tests/unit/nav-items.test.ts`, `src/app/w/[slug]/page.tsx`

**Interfaces:**

- Produces:
  - `type SetupFacts = { openingHours: boolean; services: number; bookableStaff: number; policies: number; answers: number }` (`bookableStaff` = active staff with at least one service and some hours)
  - `setupChecklist(slug: string, facts: SetupFacts): { steps: { key: string; label: string; done: boolean; href: string }[]; doneCount: number; total: number }` with steps in this order and labels: "Business details" (always done, `/settings`), "Opening hours", "Services", "Staff who can be booked", "Policies", "Verified answers"
  - `getSetupFacts(claims, workspaceId): Promise<SetupFacts>`
  - `navItems(slug, role)` for owners and admins: Overview, Services, Staff, Opening hours, Policies, Answers, Team, Settings; for staff: Overview, Team

Exact copy: card title "Set up your receptionist", progress "{done} of {total} done", each step links to its page with a check when done; when all are done the card reads "Your business details are complete." Staff don't see the card.

- [ ] **Step 1: Failing unit tests:** `setupChecklist("bloom", { openingHours: true, services: 2, bookableStaff: 0, policies: 1, answers: 0 })` gives `doneCount: 4` and the "Staff who can be booked" step not done, linking to `/w/bloom/staff`; all filled gives `doneCount: 6`; `navItems` for staff is `["Overview", "Team"]` and for an admin has 8 items in the order above.
- [ ] **Step 2: Implement; tests pass. Overview shows the card for managers.**
- [ ] **Step 3: `tests/e2e/setup.spec.ts`:** a new workspace shows "1 of 6 done"; after adding a service (through the UI) it shows "2 of 6 done"; a staff-role member sees no card. Run and see it pass.
- [ ] **Step 4: Commit** ("feat: setup checklist and business navigation").

---

### Task 8: Ship milestone 2

**Files:**

- Modify: `README.md` (status line "milestone 2 of 12" and a sentence on business facts)

- [ ] **Step 1: Full local gate** — `npm run format:check && npm run lint && npm run typecheck && npm test && npm run db:reset && npm run test:integration && npm run build && CI=1 npm run test:e2e`. Expected: all pass. If local e2e stalls under load, rerun with `--workers=2` and record it.
- [ ] **Step 2: Inline self-review of the milestone's diff** (Daksh doesn't want background agents): check every new table for RLS, column grants and composite FKs, every action for a manager check, and the Review Focus list. Fix anything serious test-first; record decisions in `docs/superpowers/plans/2026-10-25-m2-business-facts-decisions.md`.
- [ ] **Step 3: Commit and push**; confirm GitHub CI passes.
- [ ] **Step 4: Apply the migrations to the live database (ask Daksh first: it changes production).** `npx supabase db push` (the CLI is already linked and logged in), then `npx supabase migration list` shows local and remote identical.
- [ ] **Step 5: Smoke check the live site** after Vercel redeploys: a signed-in owner can open each new page and add one service.

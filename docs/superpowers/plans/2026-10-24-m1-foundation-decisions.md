# Milestone 1: decisions log

Calls made while building milestone 1 that differ from or add to [the plan](2026-10-24-m1-foundation.md), each with what it costs if it turns out wrong. Kept so reviewers can see why the code looks the way it does.

## Rulings

- **Setup:** work directly on `main` in this brand-new repo, no worktree — the approved plan's Task 1 creates the repo on main and Daksh approved the plan; there is no prior work to protect — cost if wrong: none (nothing shared yet).
- **Task 1:** create-next-app already ran `git init` (branch `master`) and made "Initial commit from Create Next App", which also captured docs/. Renamed the branch to `main` and kept that commit as Task 1's BASE (3be5ba8) instead of a separate scaffold commit — cost if wrong: none.
- **Task 1:** the scaffold set `cacheComponents: true` and `partialPrefetching: true`; removed both as the plan says (Next docs say both become default in the next major) — cost if wrong: a migration to Cache Components at the next Next.js major.
- **Task 1:** kept ESLint 9.39.5 (what create-next-app installs) instead of ESLint 10, because eslint-config-next's React plugins target 9 — cost if wrong: a later ESLint upgrade.
- **Task 1:** added `.gitattributes` (`* text=auto eol=lf`) because this machine's git converts to CRLF, which would fail `prettier --check` against CI — cost if wrong: none.
- **Task 1:** added `!.env.example` to .gitignore, since the scaffold ignores `.env*` — cost if wrong: none.
- **Task 1:** Prettier also formats docs/*.md (plan and spec reflowed, content unchanged) — cost if wrong: none.
- **Task 2:** `env:local` runs `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/supabase-env.ts` to silence Node's module-type warning (output was already clean) — cost if wrong: none.
- **Task 2:** `src/db/connection.ts` reuses one postgres.js pool through globalThis outside production, so dev hot reloads don't open new pools (not in the plan) — cost if wrong: none.
- **Task 2:** local mail server is `[local_smtp]` in this CLI version and `supabase status` prints both MAILPIT_URL and INBUCKET_URL; the plan's fallbacks cover it — cost if wrong: none.
- **Task 3:** added `src/db/schema/columns.ts` (createdAt/updatedAt column helpers) to avoid repeating timestamp definitions; not in the plan's file list — cost if wrong: none.
- **Task 3:** `cleanupTestData` also deletes workspaces created by tracked users (not only tracked workspaces), so users can always be deleted despite the last-owner trigger — cost if wrong: none (test data only).
- **Task 4:** wrote createTestInvite in the test-writing step (Step 3) rather than Step 4, since the failing test needs it to run; the TS/Postgres hash test passed on first run because invite-token.ts (Step 2) already existed, which is what that consistency check expects — cost if wrong: none.
- **Task 5:** shadcn 4.22's default Next preset is `base-nova` (Base UI primitives, neutral base colour), so components use Base UI's `render` prop instead of Radix `asChild`; it also imports `cn` from the `cn` npm package (shadcn-ui/cn, MIT, maintainer shadcn, no install scripts), checked before keeping it — cost if wrong: swapping primitives later.
- **Task 5:** rewrote shadcn's generated `src/hooks/use-mobile.ts` with useSyncExternalStore because it failed the react-hooks/set-state-in-effect lint rule; same behaviour — cost if wrong: none.
- **Task 5:** `typecheck` is now `next typegen && tsc --noEmit`, because Next's global `LayoutProps`/route types only exist after typegen (a clean CI checkout would fail otherwise) — cost if wrong: none.
- **Task 5:** the app runs on port 3300, not 3000 — Daksh's portfolio uses 3000 (and its preview config 3100/3200), and Playwright's reuseExistingServer would silently test the wrong app. Changed dev/start scripts, Playwright baseURL, supabase/config.toml site_url and redirect URLs, and the env script; added a `frontdesk-ai` entry to D:\portfolio-work\.claude\launch.json — cost if wrong: none; later plan steps that say localhost:3000 mean 3300.
- **Task 5:** the landing hero includes a static example conversation (`src/app/(marketing)/example-conversation.tsx`, not in the plan's file list) as the page's one bold element, per the frontend-design pass — it shows a sourced answer with slots and a refusal to guess — cost if wrong: one component to remove.
- **Task 5:** removed the scaffold's unused public/*.svg files — cost if wrong: none.
- **Task 6:** added `FormState<T> = ActionResult<T> | null` to src/lib/action-result.ts because `useActionState` needs a null initial state; actions take `prev: FormState` — cost if wrong: none.
- **Task 6:** the Supabase clients (server, browser, proxy) read the URL and publishable key from `clientEnv`, not `getServerEnv`, so the proxy doesn't import a `server-only` module — both values are public — cost if wrong: none.
- **Task 6:** the auth-guard e2e tests ran after the implementation (the plan orders them that way), so I mutation-checked: with src/proxy.ts removed the return-path test failed (stayed on /w/some-salon/team), and passed again once restored — cost if wrong: none.
- **Task 7:** forms submit through `useActionForm` (onSubmit + startTransition) instead of `<form action>`, because React 19 resets a form after every action submit and would wipe what someone typed when the server returns errors; added e2e "sign-up keeps what you typed when a field is invalid" (written after the fix, not mutation-checked) — cost if wrong: forms don't work without JavaScript (no progressive enhancement).
- **Task 7:** `ActionResult` failures carry an optional `code` (used for `email_not_confirmed`) and `fail(error, fieldErrors?, code?)` — the plan's shape had no way to tell the form to show the resend button — cost if wrong: none.
- **Task 7:** replaced the `(auth)` group layout from Task 5 with a shared `AuthShell` component (logo, title, description) used by each auth page, the update-password page and the auth error page — cost if wrong: none.
- **Task 7:** Playwright's expect timeout is 10s locally (5s in CI) because the dev server compiles routes on first request; the first auth run timed out on that compile and passed on rerun — cost if wrong: slower failure reports locally.
- **Task 7:** extra copy not pinned by the plan: sign-up description "Set up your business, then add your team.", forgot-password description, field hint, "Choose a stronger password.", "Use a password you haven't used here before.", "Back to sign in", "New here? Create an account" — cost if wrong: copy edits.
- **Task 8:** currency labels read "US Dollar (USD)" instead of the plan's "USD · US Dollar" — the middle-dot pattern reads as template chrome — cost if wrong: a label change.
- **Task 8:** `isValidTimeZone`/`isValidCurrency` and the option lists live in `src/lib/locale-options.ts` (the plan named the functions but not their file) — cost if wrong: none.
- **Task 8:** added `src/lib/validation.ts` (`zodFieldErrors`) and switched the auth actions to it, removing a duplicate helper — cost if wrong: none.
- **Task 8:** the browser's time zone is read with useSyncExternalStore (server snapshot null), and the time zone select remounts via `key` once it's known, instead of setState in an effect (blocked by the react-hooks lint rule) — cost if wrong: none.
- **Task 8:** `createWorkspace` catches unexpected errors from the record function, logs them, and returns "Something went wrong. Try again in a moment." instead of throwing to an error page — cost if wrong: none.
- **Task 9:** the theme switch lives only in the user menu (plan also put a ThemeToggle in the top bar); the top bar shows only on phones, with the sidebar trigger and logo — two controls for one setting is clutter — cost if wrong: one component to add back.
- **Task 9:** workspace pages render plain containers, not <main>, because shadcn's SidebarInset already renders <main> — cost if wrong: none.
- **Task 9:** shell e2e link lookups use `exact: true` — Playwright matches names by substring, so "Team" also matched the overview's "Manage team" link — cost if wrong: none.
- **Task 9:** created a local demo owner (demo-owner@example.com, random password; the throwaway script and credentials were deleted after the review) and workspace "Bloom Hair & Beauty" via a throwaway script in the workspace, to review the shell visually — cost if wrong: none (local DB only).
- **Task 10:** `updateWorkspaceDetails` calls `revalidatePath('/w/<slug>', 'layout')` so the sidebar shows a new name without a reload — cost if wrong: none.
- **Task 10:** added section copy not pinned by the plan ("Your receptionist uses these to answer questions and show times.", "Deleting the workspace removes the team and all of its data.", dialog title "Delete {name}?") — cost if wrong: copy edits.
- **Task 11:** `createInviteRecord` checks the caller's role first (owner/admin) so staff get "not_allowed" even when inviting an existing member's email, instead of leaking "already_member" — cost if wrong: none.
- **Task 11:** removal uses a direct "Remove"/"Leave workspace" button that opens the confirm dialog, instead of a row menu, and role changes use a native <select> — fewer clicks, accessible, mobile-friendly — cost if wrong: UI swap.
- **Task 11:** `/auth/sign-out` accepts an optional `next` form field (sanitised with safeRedirectPath, default "/"), so someone signed in with the wrong account can sign out and land back on the invite — cost if wrong: none.
- **Task 11:** `acceptInvite` is `(token) => Promise<FormState>` (bound to the token; the unused prev/formData parameters were removed to satisfy lint) — cost if wrong: none.
- **Task 11:** dates on the team page are formatted on the server in the workspace's time zone, so server and browser render the same text — cost if wrong: none.
- **Task 11:** Playwright locally allows 90s per test and 20s per expect (CI keeps 30s/5s with a production build): every local run starts a cold dev server and parallel sign-ins all wait on the first compile of the workspace routes; two team tests failed on that and passed alone and with the longer local timeouts — cost if wrong: slow local failure reports.
- **Task 11:** added invite-dialog copy not pinned by the plan ("You'll get a link to send them. They join when they open it and sign in with this email.", role help text, "Invite link ready", "Role updated.") — cost if wrong: copy edits.
- **Task 12:** the CI env step runs `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/supabase-env.ts` (same flag as env:local) — cost if wrong: none.
- **Task 12:** Steps 1-4 (CI workflow, README, full local gate, commit) are done; steps 5-9 (GitHub repo, hosted Supabase, Vercel, deployed smoke check, Google) need Daksh's accounts and passwords and are handed to him — the gate also ran e2e in CI mode (`CI=1`, production server): 22/22 — cost if wrong: deployment not yet verified.
- **Final:** the audit-log test now expects editing to be refused with 42501 instead of silently updating nothing — the new grants make the refusal explicit — cost if wrong: none.
- **Final:** Data API left on, rate limits and Sentry not added — the plan schedules them for M12, M5 and M12 — cost if wrong: the column-grant fix above was needed precisely because the Data API is on.

## Final review (self-review)

The end-of-milestone review was done inline by the implementer, not by an independent reviewer.

Fixed:

- column-level UPDATE grants (Important, security): Supabase grants UPDATE on every column, so through the still-enabled Data API an owner could reassign a membership to another user, an admin could change a workspace's slug/created_by, and managers could rewrite an invite's email/expiry. New migration 20261025072508_column_update_grants.sql limits UPDATE to the columns the app edits (workspaces: name, website, timezone, currency, updated_at; memberships: role; invitations: revoked_at; audit_log: none) — tests "owners can't hand a membership to another user", "admins can change details but not a workspace's URL or creator", "managers can revoke an invite but not rewrite it" RED→GREEN; "owners can't move a membership into another workspace" already passed before the fix (Postgres checks the SELECT policy on the updated row) and stays as a guard; suite 48/48 integration, 88/88 unit, 22/22 e2e (CI mode).

Deferred (minor):

- the role select keeps showing the attempted role after a refused change until reload (an error toast explains).
- an owner can't step down to admin from the UI (their own role select is hidden); they can leave or be demoted by another owner.
- any member can insert audit_log rows for their workspace through the Data API (actor is always themselves), so the log can get noise.
- no custom not-found or error pages yet (Next.js defaults).
- website is validated only in the app; through the Data API it can hold any text, so keep rendering it as plain text until the Data API is off (M12).
- owners/admins can insert invites with any expiry through the Data API.

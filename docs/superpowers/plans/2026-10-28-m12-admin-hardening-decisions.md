# Milestone 12: decisions log

Calls made while building milestone 12 that differ from or add to [the plan](2026-10-28-m12-admin-hardening.md) and the spec, each with what it costs if it turns out wrong.

## Rulings

- **Platform admins are set by email** (`PLATFORM_ADMIN_EMAILS`), not a database role. It's one setting, can't be changed from inside the app, and demo guests are always refused.
  - Everyone else gets the normal 404, so the page's existence isn't revealed.
  - The page is read-only. Its cross-tenant queries live in `src/privileged/admin/`.
  - Demo sandboxes are summed up rather than listed.
- **Sentry is left out.** The spec lists it, but `@sentry/nextjs` brings a large OpenTelemetry tree (the reason Inngest was dropped in M4) and needs an account and DSN. Instead:
  - the app has error pages (`error.tsx`, `global-error.tsx`, `not-found.tsx`) that show a reference digest and log the details on the server, where Vercel's logs keep them;
  - every AI call is logged with tokens and latency in `usage_events`, and its cost is estimated in the analytics.
  - Cost if wrong: adding Sentry later is one package and an instrumentation file.
- **Security headers on every response:**
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a permissions policy that turns off camera, microphone, location, payment and USB, and two-year HSTS;
  - `frame-ancestors 'self'` with `X-Frame-Options: SAMEORIGIN` everywhere except `/widget/*`, which keeps the domain-based policy from milestone 6;
  - `X-Powered-By` removed.
  - An e2e test checks the headers.
- **Accessibility:** `@axe-core/playwright` 4.13.0 (4.14.0 was under two weeks old) checks 17 pages in CI against WCAG 2.1 A and AA, failing on serious or critical problems. It found 4 colour-contrast problems, now fixed:
  - destructive badges and buttons used red text on a light red background; they now use a darker red (`red-800`, or `red-200` in dark mode);
  - completed bookings on the calendar used muted text on a muted background;
  - the widget header and the inbox filter counts were faded with opacity.
- **Performance:** a new index on `conversations (workspace_id, created_at)` for the analytics and plan-limit counts. Other hot queries already had indexes.
- **Security review** against the spec's section 7:
  - zod on every input;
  - RLS on every table, with privileged code isolated and lint-enforced;
  - rate limits and plan caps on the public chat;
  - prompt-injection handling (documents as data, tools as the only actions, customer confirmation for bookings);
  - signed manage links;
  - demo sandboxes that can't email or invite;
  - signed and idempotent Stripe webhooks;
  - visitor tokens hashed and short-lived.
  - Nothing new was found beyond the contrast issues.
- **The case study and Upwork assets** were drafted in a parallel session in the portfolio repo, on its own branch (`frontdesk-ai-case-study`). They're reviewed and merged there, not in this repo.

## Deferred minors

- There's no Sentry (above).
- The admin page lists the latest 200 workspaces, with no search.

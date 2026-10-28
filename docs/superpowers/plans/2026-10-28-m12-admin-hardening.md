# Milestone 12: platform admin and hardening

**Goal:** Finish FrontDesk AI as a product a client can inspect.

- A read-only platform admin page lists every workspace with its plan, status, usage and AI cost, with a platform-wide cost chart.
- The app gets security headers and error pages.
- Automated accessibility checks run on the main pages.
- The README is final.

The case study and Upwork assets are drafted in parallel in the portfolio repo.

**Spec:** [4.11 Platform admin](../specs/2026-10-24-frontdesk-ai-design.md), and milestone 12 in section 10: security review, performance, accessibility, docs, case study.

## Tasks

1. **Platform admin:**
   - `PLATFORM_ADMIN_EMAILS` (comma-separated) decides who sees `/admin`; everyone else gets a 404;
   - the queries are cross-tenant, so they live in `src/privileged/admin/`;
   - tests: a unit test for the admin check, an integration test for the overview numbers, and an e2e test for the page and the 404.
2. **Hardening:**
   - security headers on every route: `nosniff`, a strict referrer policy, a permissions policy, HSTS, and `frame-ancestors 'self'` everywhere except the widget page, which keeps its own policy;
   - `error.tsx`, `global-error.tsx` and `not-found.tsx`;
   - an index on `conversations (workspace_id, created_at)` for analytics and limits;
   - an e2e header test;
   - `@axe-core/playwright` checks on the landing, sign-in, demo, salon site, widget, overview, inbox, Analytics and Test lab pages, failing on serious or critical violations (fix what it finds);
   - a self-review against the security list in the spec.
3. **Docs:** the README as a full project page, covering features, architecture, data protection, testing, setup and links.

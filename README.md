# FrontDesk AI

An AI receptionist for service businesses like salons and spas. It answers customers from the business's own data, books appointments into a real calendar, captures leads, and hands the chat to a person when it isn't sure. Multi-tenant, with every business's data protected by Postgres row level security, and tested end to end.

[![CI](https://github.com/dakshn15/frontdesk-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/dakshn15/frontdesk-ai/actions/workflows/ci.yml) [![Evaluation](https://github.com/dakshn15/frontdesk-ai/actions/workflows/eval.yml/badge.svg)](https://github.com/dakshn15/frontdesk-ai/actions/workflows/eval.yml)

**Live:** [frontdesk-ai-app.vercel.app](https://frontdesk-ai-app.vercel.app) · **Try it with no sign-up:** [the live demo](https://frontdesk-ai-app.vercel.app/demo) gives you a private 24-hour copy of a salon, with its website, receptionist and a dashboard full of data.

## What it does

- **Answers from the business's own data.** Owners enter services, staff and their hours, opening hours, closed days, policies and verified answers, and add knowledge: PDF, Word, text or Markdown files, web pages, whole sites through their sitemap, or pasted text. Knowledge is split into passages and searched with hybrid vector and keyword search (pgvector plus Postgres full text, merged with reciprocal rank fusion). The receptionist says when it isn't sure instead of guessing.
- **Books into a real calendar.** An availability engine respects staff hours, time off, buffers, notice and booking windows, and a Postgres exclusion constraint makes double booking impossible. The AI proposes a time; the customer confirms it with their name and email. Customers get confirmation and reminder emails with a calendar file and a link to cancel or reschedule. Each staff member has a private calendar feed.
- **One script tag on any website.** The widget is an iframe, so the host site's CSS can't break it. It streams answers with source chips, shows booking cards and a contact form, keeps the conversation across reloads, and only loads on the domains the owner allows.
- **A live inbox.** Chats update in real time (Supabase Realtime under row level security). Staff take a chat over from the AI, reply in the visitor's chat or by email, hand it back or resolve it. Owners get an email when a visitor asks for a person; if nobody picks it up in 5 minutes, or the business is closed, the visitor is asked for their email.
- **A test lab.** A playground shows how each answer was made: tools used, passages found, the verified answer, model, tokens, cost and time, with "Fix this answer". Saved tests use simple checks (must use a tool, must or must not mention something, must say it isn't sure, must hand off) or an AI grader, and run in one click. Questions it struggled with in real chats are listed for review.
- **Analytics.** Conversations, bookings made by the AI, leads, handoff rate, chats resolved without a person, top topics and outcomes (tagged when a chat goes quiet), and AI cost per day by provider.
- **Billing.** A 14-day trial, then Starter or Pro through Stripe Checkout and the Customer Portal. Plans limit monthly chats, knowledge sources and team seats; at a limit the widget offers the contact form instead of AI replies.
- **Teams and a platform admin.** Owners, admins and staff with invites; a read-only admin page lists every workspace with its plan, usage and AI cost.

## Built with

Next.js 16 (App Router, server actions, Turbopack), React 19, TypeScript, Tailwind CSS 4 and shadcn/ui · Supabase (Postgres, Auth, Realtime) with Drizzle ORM and SQL migrations · AI SDK 7 with OpenAI (gpt-5.4-mini) and Google Gemini as fallback, tool calling and streaming · pgvector · Stripe (REST, signed and idempotent webhooks) · Resend · Recharts · Vitest and Playwright · GitHub Actions · Vercel.

## Run it locally

You need Node 24 and Docker Desktop (running).

```bash
npm ci
npm run db:start     # local Supabase: Postgres, Auth and a mail catcher
npm run env:local    # writes .env.local from the running stack
npm run dev          # http://localhost:3300
```

Sign-up and password-reset emails land in the local mail catcher at http://127.0.0.1:54324.

### Sample data

`npm run db:seed` deletes the sample workspace and recreates it as a full copy of the demo salon (Bloom Hair & Beauty): services, staff, hours, policies, answers, knowledge, bookings, chats, a month of analytics history and Test lab tests. It has no demo expiry and an active Pro subscription (customer `cus_showcase_seed`, not a real Stripe customer), so the receptionist keeps answering after the trial. Run it again any time to undo manual edits.

```bash
SEED_OWNER_PASSWORD=<a local password> npm run db:seed   # first run: creates demo@frontdesk.test
npm run db:seed                                          # later runs: the owner exists, no password needed
npm run db:seed -- --dry-run                             # say what it would delete and create, change nothing
SEED_OWNER_PASSWORD=<a local password> npm run db:reset:seed   # wipe the local database, then seed
```

| Setting               | Flag         | Default                                                    |
| --------------------- | ------------ | ---------------------------------------------------------- |
| `SEED_WORKSPACE_SLUG` | `--slug`     | `bloom-hair-beauty`                                        |
| `SEED_OWNER_EMAIL`    | `--email`    | `demo@frontdesk.test` (local only)                         |
| `SEED_OWNER_PASSWORD` | `--password` | none; only used to create a new local owner, never printed |
|                       | `--env-file` | `.env.local` (variables already in the shell win)          |

It reads the database and Supabase settings from `.env.local`, prints what it will delete before deleting it, and runs the delete and the seed in one transaction. It asks for `--yes` before touching a database that isn't local, or a workspace owned by someone other than the seed owner.

To seed production, sign up in the live app with the account that should own the sample workspace (the seeder only creates users locally), then put the production `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` in a git-ignored file such as `.env.production.local`, and run:

```bash
SEED_OWNER_EMAIL=<your account email> npm run db:seed -- --env-file .env.production.local --dry-run
SEED_OWNER_EMAIL=<your account email> npm run db:seed -- --env-file .env.production.local --yes
```

## Tests

```bash
npm test                  # unit tests
npm run test:integration  # database and security rules, against local Supabase
npm run test:e2e          # browser tests with Playwright
npm run eval              # the demo salon's tests against the real AI models (needs OPENAI_API_KEY)
npm run typecheck && npm run lint && npm run format:check
```

GitHub Actions runs all but the evaluation on every push, against a fresh local Supabase stack, with a scripted AI model so tests are stable and free. [The evaluation](https://github.com/dakshn15/frontdesk-ai/actions/workflows/eval.yml) runs nightly against the real models, with an AI grader, and fails if a must-pass answer breaks; add an `OPENAI_API_KEY` repository secret to turn it on.

## Security

Every table has row level security. App code reads and writes through `withRls(claims, fn)`, which runs each request's queries in one transaction under the signed-in user's role and token claims, so Postgres itself decides what a user can see or change. The two writes a policy can't express, creating a workspace and accepting an invite, go through `security definer` functions in a `private` schema that the Supabase Data API doesn't expose, and an ESLint rule stops app code from importing the privileged connection. The public chat, webhooks and background jobs use that connection and scope every query by workspace in code, which integration tests check.

- Website visitors get a short-lived, hashed session token, never a database key. The chat API checks the origin, the widget page sets `frame-ancestors` from the owner's allowed domains, and rate limits cap every public endpoint.
- Documents are treated as data, not instructions: the AI can only act through server-checked tools, and can't book without the customer's confirmation.
- Demo visitors are anonymous users the database itself stops from creating workspaces or joining teams; demo email never leaves the app.
- Stripe webhooks are signature-checked and stored, so a repeated event changes nothing.
- Every response carries security headers (`nosniff`, a strict referrer policy, HSTS, a permissions policy, and no framing outside the widget). Automated accessibility checks (axe, WCAG 2.1 AA) run on the main pages in CI.

## Project layout

```
src/app/            routes: landing, auth, dashboard pages, widget, demo, admin, API routes
src/features/       domain code per area: queries, records (RLS writes), actions, schemas, rules
src/privileged/     code that may use the privileged connection: chat API, widget, demo, billing, jobs
src/jobs/           background work: knowledge ingestion, reminders
src/db/             Drizzle schema with RLS policies, withRls, error helpers
src/components/     UI: shadcn/ui primitives, app shell, forms
supabase/           local config, email templates, SQL migrations (generated by drizzle-kit)
tests/              unit, integration and e2e tests, plus shared test helpers
```

## Deploying

1. Create an empty public GitHub repository and push `main`. CI runs on the push.
2. Create a Supabase project. In Authentication, set the Site URL to the Vercel URL and add `<vercel url>/**` to the redirect URLs, and paste the two templates from `supabase/templates/` with their subjects from `supabase/config.toml`. Then run `npx supabase login`, `npx supabase link --project-ref <ref>` and `npx supabase db push`.
3. Import the repository in Vercel and set `DATABASE_URL` (the transaction pooler connection string, port 6543), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the production URL) and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`.
4. Optional, booking emails: create a Resend account, then set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Without them, emails are recorded in the `email_log` table and not sent. Resend's test sender only delivers to your own address; to email customers, verify a domain you own in Resend.
   - For reminders and the daily job (demo clean-up and chat tagging), set `CRON_SECRET` to any random string of 16+ characters; `vercel.json` schedules both.
   - For knowledge embeddings, set `OPENAI_API_KEY` (set a monthly spend limit in OpenAI first). Without it, knowledge search uses keywords only.
   - For the receptionist, `OPENAI_API_KEY` (and optionally `GOOGLE_GENERATIVE_AI_API_KEY` as a fallback). Without either, it replies that it can't answer right now.
   - For the live demo, turn on "Allow anonymous sign-ins" in Supabase (Authentication → Sign In / Providers). To stop bots, create a Cloudflare Turnstile widget for your domain, turn on captcha in Supabase (Authentication → Attack Protection) with its secret key, and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel. `CRON_SECRET` also runs the daily demo clean-up.
5. Optional, billing: in Stripe test mode, create Starter and Pro monthly prices and a webhook endpoint at `<vercel url>/api/webhooks/stripe` for `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`, then set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO` in Vercel.
6. Optional, platform admin: set `PLATFORM_ADMIN_EMAILS` to a comma-separated list of the emails that may open `/admin`.
7. Optional, Google sign-in: create a Google Cloud OAuth client with the redirect URI `https://<project ref>.supabase.co/auth/v1/callback`, enable the Google provider in Supabase, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel and redeploy.

Account emails (sign-up, password reset) still use Supabase's built-in email, which only reaches the project's own team members until custom SMTP is set up.

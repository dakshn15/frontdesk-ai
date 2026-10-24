# FrontDesk AI, Milestone 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed app where a business owner signs up, confirms their email, creates a workspace, invites teammates with roles, and manages the workspace, with every table protected by Row Level Security.

**Architecture:** One Next.js 16 App Router app. Supabase provides Postgres and Auth: a local stack through the Supabase CLI and Docker, and a hosted project in production. Drizzle defines the schema and RLS policies and generates SQL migrations into `supabase/migrations`, which the Supabase CLI applies. App code reads and writes only through `withRls(claims, fn)`, which runs a request's queries in one transaction under the signed-in user's role and JWT claims, so Postgres enforces tenancy. The two writes a policy can't express (creating a workspace, accepting an invite) go through `security definer` functions in a `private` schema that the Data API doesn't expose.

**Tech Stack:** Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Tailwind CSS 4.3.3, shadcn/ui (CLI 4.22.1), Supabase (supabase-js 2.118.0, @supabase/ssr 0.12.7, CLI 2.122.0), Drizzle ORM 0.45.4 and drizzle-kit 0.31.11, postgres.js 3.4.9, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-24-frontdesk-ai-design.md` (sections 3, 4.1, 5, 6, 7, 8, 10 milestone 1, 13)

## Scope

In: repo and tooling, CI, local and hosted Supabase, auth (email and password with confirmation, password reset, Google sign-in behind a flag), workspaces with business details (name, website, time zone, currency), roles (owner, admin, staff), invitations shared as a copyable link with a 7-day expiry, audit log records, RLS on every table, base UI (landing page, auth screens, app shell, overview, settings, team), first deployment.

Out (later milestones): onboarding steps for services, staff, hours and knowledge (M2, M4); emailing invite links (M3, when Resend arrives; until then the owner copies the link); platform admin and Sentry (M12); turning off the Supabase Data API (M12 hardening).

## Global Constraints

- Project folder: `D:\portfolio-work\portfolio-projects\frontdesk-ai`. Every path below is relative to it.
- Node 24 (local is v24.11.0). npm is the package manager; commit `package-lock.json`. Install exact versions (`npm i -E`).
- TypeScript stays on 5.9.3. typescript-eslint 8.72 supports TypeScript `<6.1.0`, so TypeScript 7 would break linting.
- Next.js 16 differs from older versions: `proxy.ts` replaces middleware, and page and layout `params` and `searchParams` are Promises. Before writing code that touches routing, the proxy, route handlers, server actions or forms, read the matching guide in `node_modules/next/dist/docs/` (the generated AGENTS.md says the same). Keep `cacheComponents` and the React Compiler off in M1.
- Docker Desktop must be running for anything that uses the local Supabase stack (`docker info` prints a server version).
- App data goes through Drizzle only. supabase-js is used for Auth only, never to read or write app tables.
- App code (everything in `src/` outside `src/jobs/` and `src/app/api/webhooks/`) never imports `@/db/admin`. An ESLint rule enforces it (Task 2).
- Every table has RLS enabled. Every workspace-owned table has `workspace_id uuid not null` referencing `workspaces(id) on delete cascade`.
- IDs are `uuid default gen_random_uuid()`. Times are `timestamptz`, stored in UTC. Drizzle uses `casing: "snake_case"`, so TypeScript fields are camelCase and columns are snake_case.
- Roles are exactly `owner`, `admin`, `staff`. Invites grant `admin` or `staff`, never `owner`. Invites expire 7 days after creation.
- Every server action validates input with Zod on the server and returns `ActionResult` (Task 6) for expected failures instead of throwing. Call `redirect()` outside `try`/`catch`.
- UI copy uses the product name "FrontDesk AI", plain short sentences, and no exclamation marks. Where this plan gives exact copy, use it word for word.
- Layouts work from 320px wide with no sideways scrolling.
- Secrets live in `.env.local` (gitignored) and in Vercel. `.env.example` lists every variable name without values.
- Commit when a task's steps pass, using Conventional Commits. Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A `next` value that points off-site (`//evil.com`, `https://evil.com`, `/\evil.com`) on sign-in, email confirmation or the OAuth callback must land on `/dashboard`. Test: Task 6, `safeRedirectPath` cases.
2. An invite for `ana.case@example.com` must be accepted by a user whose account email is `Ana.Case@Example.com`. Test: Task 4, "accepts regardless of email case".
3. A signed-out invitee who creates an account must return to the invite after confirming their email, not to onboarding. Test: Task 11 e2e, "new user signs up from an invite and joins".
4. A business name with no Latin letters (`美容室`), or one another workspace already uses, must still get a valid, unique URL. Test: Task 8, slug cases and "same name twice gets a suffixed slug".
5. A member removed while their dashboard is open must get "not found" on the next load, and their stale form submissions must fail. Test: Task 11, "removed member loses access immediately".

---

### Task 1: Scaffold the app and tooling

**Files:**
- Create (by create-next-app): `package.json`, `src/app/*`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `AGENTS.md`
- Create: `src/env/schema.ts`, `src/env/server.ts`, `src/env/client.ts`, `vitest.config.ts`, `tests/helpers/server-only-stub.ts`, `tests/unit/env.test.ts`, `.env.example`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `parseServerEnv(source: Record<string, string | undefined>): ServerEnv` and `parseClientEnv(source: Record<string, string | undefined>): ClientEnv` in `src/env/schema.ts`
  - `ServerEnv = { DATABASE_URL: string; DB_POOL_MAX: number; NEXT_PUBLIC_SUPABASE_URL: string; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string; NEXT_PUBLIC_SITE_URL: string; NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: boolean }`; `ClientEnv` holds the four `NEXT_PUBLIC_*` fields
  - `getServerEnv(): ServerEnv` in `src/env/server.ts` (memoised, starts with `import "server-only"`)
  - `clientEnv: ClientEnv` in `src/env/client.ts`, built from literal `process.env.NEXT_PUBLIC_…` references so Next inlines them
  - npm scripts: `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `test` (`vitest run --project unit`)

- [ ] **Step 1: Scaffold into the existing folder (it already holds `docs/`)**

```bash
npx create-next-app@16.4.3 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-react-compiler --yes
```
Expected: "Success! Created frontdesk-ai". If the CLI rejects `--no-react-compiler`, drop the flag and answer No at the prompt.

- [ ] **Step 2: Read `AGENTS.md`, list `node_modules/next/dist/docs/`, and remove `cacheComponents: true` from `next.config.ts` if the scaffold set it**

- [ ] **Step 3: Pin versions**

```bash
npm i -E next@16.4.3 react@19.3.1 react-dom@19.3.1 zod@4.6.7 server-only@0.0.1
npm i -D -E typescript@5.9.3 eslint-config-next@16.4.3 vitest@5.0.5 vite-tsconfig-paths@6.1.1 prettier@3.9.10 @types/node@24
```

- [ ] **Step 4: Initialise git and commit the scaffold**

Add `.nvmrc` containing `24`. Add to `.gitignore`: `.env*.local`, `/test-results`, `/playwright-report`, `/blob-report`, `/supabase/.temp`, `/supabase/.branches`.
```bash
git init -b main
git add -A
git commit -m "chore: scaffold Next.js 16 app"
```

- [ ] **Step 5: Write the failing test `tests/unit/env.test.ts`**

```ts
const full = {
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000/",
};
it("parses a complete environment and applies defaults", () => {
  const env = parseServerEnv(full);
  expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  expect(env.DB_POOL_MAX).toBe(5);
  expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(false);
});
it("reads the Google flag and pool size", () => {
  const env = parseServerEnv({ ...full, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true", DB_POOL_MAX: "1" });
  expect(env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(true);
  expect(env.DB_POOL_MAX).toBe(1);
});
it("names every missing variable in one error", () => {
  expect(() => parseServerEnv({})).toThrow(
    /DATABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY[\s\S]*NEXT_PUBLIC_SITE_URL/,
  );
});
it("keeps server values out of the client env", () => {
  expect(parseClientEnv(full)).not.toHaveProperty("DATABASE_URL");
});
```

- [ ] **Step 6: Add `vitest.config.ts` and the scripts, then run the test**

Config: plugin `tsconfigPaths()`; `resolve.alias` maps `"server-only"` to the absolute path of `tests/helpers/server-only-stub.ts` (an empty module); `test.projects` holds one project for now, `unit`: include `tests/unit/**/*.test.ts`, environment `node`. Task 2 adds the `integration` project.

Run: `npm test`
Expected: FAIL, cannot resolve `@/env/schema`.

- [ ] **Step 7: Implement `src/env/schema.ts`, `src/env/server.ts`, `src/env/client.ts`**

Use Zod 4 (`z.url()` for URLs). Remove one trailing slash from `NEXT_PUBLIC_SITE_URL`. On failure, throw `Missing or invalid environment variables: NAME (reason), …` listing every bad key.

- [ ] **Step 8: Verify**

Run: `npm test`, then `npm run lint`, `npm run typecheck`, `npm run build`
Expected: 4 tests pass; lint, typecheck and build succeed.

- [ ] **Step 9: Add `.env.example`, Prettier and commit**

`.env.example` lists `DATABASE_URL`, `DB_POOL_MAX`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, and the test-only `SUPABASE_SECRET_KEY` and `MAILPIT_URL`, each with a one-line comment. `.prettierrc.json` is `{}`; `.prettierignore` holds `.next`, `supabase/migrations/meta`, `package-lock.json`, `playwright-report`, `test-results`.
```bash
npm run format
git add -A
git commit -m "chore: env validation, Vitest and Prettier"
```

---

### Task 2: Local Supabase, the database client and `withRls`

**Files:**
- Create: `supabase/config.toml` (by `supabase init`), `scripts/supabase-env.ts`, `src/db/connection.ts`, `src/db/index.ts`, `src/db/admin.ts`, `src/db/errors.ts`, `src/db/schema/index.ts` (empty barrel for now), `tests/unit/supabase-env.test.ts`, `tests/unit/db-errors.test.ts`, `tests/integration/global-setup.ts`, `tests/integration/setup.ts`, `tests/integration/rls-client.test.ts`
- Modify: `package.json`, `eslint.config.mjs`, `vitest.config.ts` (add the `integration` project: include `tests/integration/**/*.test.ts`, `globalSetup: "tests/integration/global-setup.ts"`, `setupFiles: ["tests/integration/setup.ts"]`, `env: { DB_POOL_MAX: "1" }`, `testTimeout: 20000`)

**Interfaces:**
- Consumes: `getServerEnv` (Task 1)
- Produces:
  - `parseEnvOutput(text: string): Record<string, string>` and `mapSupabaseStatus(vars: Record<string, string | undefined>): Record<string, string>` in `scripts/supabase-env.ts`; run directly, it prints `KEY=value` lines
  - `getPgError(err: unknown): { code: string; message: string } | null`, `PG_UNIQUE_VIOLATION = "23505"`, `PG_CHECK_VIOLATION = "23514"`, `PG_INSUFFICIENT_PRIVILEGE = "42501"`, `PG_RAISE = "P0001"` in `src/db/errors.ts`
  - `type AuthClaims = { sub: string; email?: string } & Record<string, unknown>`, `type RlsTx`, and `withRls<T>(claims: AuthClaims | null, fn: (tx: RlsTx) => Promise<T>): Promise<T>` in `src/db/index.ts`
  - `adminDb` in `src/db/admin.ts`: the same Drizzle instance with no role switch
  - npm scripts: `test:integration` (`vitest run --project integration`), `db:start` (`supabase start`), `db:stop` (`supabase stop`), `db:reset` (`supabase db reset`), `db:generate` (`drizzle-kit generate`), `env:local` (`node scripts/supabase-env.ts > .env.local`)
  - `.env.local` keys: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `MAILPIT_URL`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`

- [ ] **Step 1: Install**

```bash
npm i -E drizzle-orm@0.45.4 postgres@3.4.9 @supabase/supabase-js@2.118.0 @supabase/ssr@0.12.7
npm i -D -E drizzle-kit@0.31.11 supabase@2.122.0
```

- [ ] **Step 2: Initialise Supabase and set the auth basics**

Run `npx supabase init` (answer No to the editor prompts). In `supabase/config.toml` set `project_id = "frontdesk-ai"`; under `[auth]` set `site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/**"]`, `minimum_password_length = 8`; under `[auth.email]` set `enable_confirmations = true`; under `[auth.rate_limit]` set `email_sent = 100` and `sign_in_sign_ups = 100`, so test runs don't hit the default limits.

- [ ] **Step 3: Start the stack**

Run: `docker info`, then `npm run db:start`, then `npx supabase status -o env`
Expected: API on `http://127.0.0.1:54321`, database on port 54322, and an env listing. Note which key and mail variable names it prints; Step 4's fallbacks cover both naming schemes.

- [ ] **Step 4: Write the failing test `tests/unit/supabase-env.test.ts`**

```ts
it("parses KEY=\"value\" lines", () => {
  expect(parseEnvOutput('API_URL="http://127.0.0.1:54321"\nDB_URL="postgresql://x"\n')).toEqual({
    API_URL: "http://127.0.0.1:54321",
    DB_URL: "postgresql://x",
  });
});
it("maps CLI names to app names", () => {
  expect(
    mapSupabaseStatus({ API_URL: "http://a", DB_URL: "postgresql://d", PUBLISHABLE_KEY: "pk", SECRET_KEY: "sk", MAILPIT_URL: "http://m" }),
  ).toEqual({
    NEXT_PUBLIC_SUPABASE_URL: "http://a",
    DATABASE_URL: "postgresql://d",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
    SUPABASE_SECRET_KEY: "sk",
    MAILPIT_URL: "http://m",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
  });
});
it("falls back to legacy key names and the default mail URL", () => {
  const out = mapSupabaseStatus({ API_URL: "http://a", DB_URL: "postgresql://d", ANON_KEY: "anon", SERVICE_ROLE_KEY: "service" });
  expect(out.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon");
  expect(out.SUPABASE_SECRET_KEY).toBe("service");
  expect(out.MAILPIT_URL).toBe("http://127.0.0.1:54324");
});
it("uses INBUCKET_URL when that's what the CLI prints", () => {
  expect(mapSupabaseStatus({ API_URL: "http://a", DB_URL: "postgresql://d", ANON_KEY: "a", SERVICE_ROLE_KEY: "s", INBUCKET_URL: "http://i" }).MAILPIT_URL).toBe("http://i");
});
it("explains what to do when the stack isn't running", () => {
  expect(() => mapSupabaseStatus({})).toThrow(/npm run db:start/);
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `npm test -- tests/unit/supabase-env.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 6: Implement `scripts/supabase-env.ts`**

Mail URL order: `MAILPIT_URL`, then `INBUCKET_URL`, then `http://127.0.0.1:54324`. The main block runs only when the file is executed directly (`import.meta.url === pathToFileURL(process.argv[1]).href`); it reads `npx supabase status -o env` with `execSync`. The file uses only erasable TypeScript, so Node 24 runs it without a build step.

- [ ] **Step 7: Verify and write `.env.local`**

Run: `npm test`, then `npm run env:local`
Expected: tests pass; `.env.local` holds the 7 keys.

- [ ] **Step 8: Write the failing test `tests/unit/db-errors.test.ts`**

```ts
it("reads a Postgres error", () => {
  expect(getPgError({ code: "23505", message: "duplicate key" })).toEqual({ code: "23505", message: "duplicate key" });
});
it("unwraps Drizzle's query error", () => {
  expect(getPgError({ message: "Failed query", cause: { code: "P0001", message: "last_owner" } })).toEqual({ code: "P0001", message: "last_owner" });
});
it("returns null for anything else", () => {
  expect(getPgError(new Error("x"))).toBeNull();
  expect(getPgError("x")).toBeNull();
  expect(getPgError({ code: 42 })).toBeNull();
});
```

- [ ] **Step 9: Implement `src/db/errors.ts`, run, see it pass**

Walk `.cause` up to 3 levels; a match needs a 5-character string `code` and a string `message`.
Run: `npm test` Expected: PASS.

- [ ] **Step 10: Write the integration setup and the failing test `tests/integration/rls-client.test.ts`**

`setup.ts` loads `.env.local` with `process.loadEnvFile` when the file exists. `global-setup.ts` loads it the same way, runs `select 1` with postgres.js, and on failure throws `Local Supabase isn't reachable. Start Docker Desktop, then run npm run db:start.`
```ts
const sub = randomUUID();
it("runs as authenticated with the caller's id and claims", async () => {
  const [row] = await withRls({ sub, email: "a@example.com" }, (tx) =>
    tx.execute(sql`select auth.uid()::text as uid, current_user as role, auth.jwt()->>'email' as email`),
  );
  expect(row).toEqual({ uid: sub, role: "authenticated", email: "a@example.com" });
});
it("runs as anon without claims", async () => {
  const [row] = await withRls(null, (tx) => tx.execute(sql`select auth.uid() as uid, current_user as role`));
  expect(row).toEqual({ uid: null, role: "anon" });
});
it("ignores a role claim, so a token can't escalate", async () => {
  const [row] = await withRls({ sub, role: "service_role" }, (tx) => tx.execute(sql`select current_user as role`));
  expect(row.role).toBe("authenticated");
});
it("doesn't leak the role past the transaction", async () => {
  await withRls({ sub }, (tx) => tx.execute(sql`select 1`));
  const [row] = await adminDb.execute(sql`select current_user as role`);
  expect(row.role).toBe("postgres");
});
it("rolls back and rethrows when the callback throws", async () => {
  await expect(withRls({ sub }, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
});
```
Run: `npm run test:integration` Expected: FAIL, `@/db` not found.

- [ ] **Step 11: Implement `src/db/connection.ts`, `src/db/index.ts`, `src/db/admin.ts`**

`connection.ts`: `postgres(env.DATABASE_URL, { prepare: false, max: env.DB_POOL_MAX })` (`prepare: false` is required by Supabase's transaction pooler) and `drizzle(client, { schema, casing: "snake_case" })`. `withRls` runs `db.transaction`, then one statement that sets both settings, then the role:
```ts
const claimsJson = JSON.stringify(claims ? { ...claims, role: "authenticated" } : { role: "anon" });
await tx.execute(sql`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('request.jwt.claim.sub', ${claims?.sub ?? ""}, true)`);
await tx.execute(sql.raw(claims ? "set local role authenticated" : "set local role anon"));
return fn(tx);
```
`RlsTx` is the transaction parameter type (`Parameters<Parameters<typeof db.transaction>[0]>[0]`). `set local` ends with the transaction, so no reset is needed.

- [ ] **Step 12: Run, see it pass**

Run: `npm run test:integration` Expected: 5 tests PASS.

- [ ] **Step 13: Add the ESLint guard and prove it works**

In `eslint.config.mjs` add a block for `src/**/*.{ts,tsx}` that ignores `src/jobs/**` and `src/app/api/webhooks/**`, with `no-restricted-imports` on `@/db/admin` and the message `Use withRls from @/db. The admin connection is only for jobs and webhooks.` Create a temporary `src/lint-check.ts` that imports `@/db/admin` and run `npm run lint`. Expected: the error with that message. Delete the file and run `npm run lint` again. Expected: clean.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(db): local Supabase, Drizzle client and withRls"
```

---

### Task 3: Core schema: profiles, workspaces, memberships, audit log

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema/enums.ts`, `src/db/schema/profiles.ts`, `src/db/schema/workspaces.ts`, `src/db/schema/memberships.ts`, `src/db/schema/audit-log.ts`, `supabase/migrations/<ts>_private_helpers.sql` (custom), `supabase/migrations/<ts>_core_tables.sql` (generated), `supabase/migrations/<ts>_core_functions.sql` (custom), `tests/helpers/test-db.ts`, `tests/helpers/seed.ts`, `tests/integration/core-schema.test.ts`
- Modify: `src/db/schema/index.ts`

**Interfaces:**
- Consumes: `withRls`, `adminDb`, `getPgError`, `AuthClaims` (Task 2)
- Produces:
  - Drizzle: enum `workspaceRole` and `type WorkspaceRole = "owner" | "admin" | "staff"`; tables `profiles`, `workspaces`, `memberships`, `auditLog`
  - SQL: `private.is_member(ws uuid) → boolean`, `private.has_role(ws uuid, roles text[]) → boolean`, `private.shares_workspace(other uuid) → boolean`, `private.create_workspace(p_name text, p_slug text, p_website text, p_timezone text, p_currency text) → uuid`
  - SQL errors use SQLSTATE `P0001` with the message `not_authenticated` or `last_owner`
  - Test helpers (they use their own postgres.js connection and only type imports from `src/`, so Playwright can load them): `type TestUser = { id: string; email: string; password: string }`; `createTestUser(opts?: { email?: string; fullName?: string; password?: string }): Promise<TestUser>` (Auth admin API with `email_confirm: true`; default email `test-<uuid>@example.com`, default password `Password123!`); `claimsFor(user: TestUser): AuthClaims`; `createTestWorkspace(owner: TestUser, opts?: { name?: string }): Promise<{ id: string; slug: string }>` (calls `private.create_workspace` as the owner; slug `test-<8 hex>`, time zone `America/Chicago`, currency `USD`); `addTestMember(workspaceId: string, user: TestUser, role: WorkspaceRole): Promise<void>`; `trackWorkspace(id: string): void`; `cleanupTestData(): Promise<void>` (deletes tracked workspaces first, then tracked users)

`drizzle.config.ts`:
```ts
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  casing: "snake_case",
  schemaFilter: ["public"],
  entities: { roles: { provider: "supabase" } },
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Tables:

| Table | Columns | Constraints |
|---|---|---|
| `profiles` | `id` uuid pk → `auth.users.id` on delete cascade; `email` text not null; `fullName` text not null default `''`; `avatarUrl` text; `createdAt`, `updatedAt` timestamptz not null default now() (`updatedAt` uses `$onUpdate`) | |
| `workspaces` | `id`; `name` text not null; `slug` text not null unique; `website` text; `timezone` text not null; `currency` text not null; `createdBy` uuid → `profiles.id` on delete set null; `createdAt`; `updatedAt` | check `char_length(name) between 2 and 80`; check `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48`; check `currency ~ '^[A-Z]{3}$'` |
| `memberships` | `id`; `workspaceId` → workspaces on delete cascade; `userId` → `profiles.id` on delete cascade; `role` workspace_role not null; `createdAt` | unique (`workspace_id`, `user_id`); index (`user_id`) |
| `audit_log` | `id`; `workspaceId` → workspaces on delete cascade, nullable; `actorId` → `profiles.id` on delete set null; `action` text not null; `targetType` text; `targetId` uuid; `metadata` jsonb not null default `'{}'`; `createdAt` | index (`workspace_id`, `created_at` desc) |

Policies, all `to authenticated` (import roles from `drizzle-orm/supabase`). A command with no policy is denied. `{owner,admin}` below means `array['owner','admin']`, a `text[]`, so the helpers don't depend on the enum and can be created before the tables.

| Table | For | Using | With check |
|---|---|---|---|
| profiles | select | `id = (select auth.uid()) or private.shares_workspace(id)` | |
| profiles | update | `id = (select auth.uid())` | `id = (select auth.uid())` |
| workspaces | select | `private.is_member(id)` | |
| workspaces | update | `private.has_role(id, {owner,admin})` | same |
| workspaces | delete | `private.has_role(id, {owner})` | |
| memberships | select | `private.is_member(workspace_id)` | |
| memberships | update | `private.has_role(workspace_id, {owner}) or (private.has_role(workspace_id, {admin}) and role <> 'owner')` | `role <> 'owner' or private.has_role(workspace_id, {owner})` |
| memberships | delete | `user_id = (select auth.uid()) or private.has_role(workspace_id, {owner}) or (private.has_role(workspace_id, {admin}) and role <> 'owner')` | |
| audit_log | select | `private.has_role(workspace_id, {owner,admin})` | |
| audit_log | insert | | `private.is_member(workspace_id) and actor_id = (select auth.uid())` |

- [ ] **Step 1: Write the test helpers and the failing test `tests/integration/core-schema.test.ts`**

`afterAll(cleanupTestData)`. Users are `ana` (owner), `ben`, `cara`, created per test with `createTestUser`. Assertions:
- "creates a profile when a user signs up": `createTestUser({ fullName: "Ana Lopez" })`; the `profiles` row (read with `adminDb`) has that email and `fullName: "Ana Lopez"`.
- "create_workspace makes the caller the owner and logs it": after `createTestWorkspace(ana)`, `withRls(claimsFor(ana))` reads one membership with `role: "owner"` and an `audit_log` row with `action: "workspace.created"`.
- "anonymous callers can't create workspaces": `withRls(null, tx => tx.execute(sql\`select private.create_workspace('X Salon','x-salon',null,'UTC','USD')\`))` rejects.
- "users only see their own workspaces": with workspaces for ana and ben, `withRls(claimsFor(ben))` selects only ben's workspace, none of ana's memberships, and only ben's own profile.
- "teammates see each other's profiles": after `addTestMember(anaWs, ben, "staff")`, ben can select ana's profile.
- "direct inserts are blocked": as ana, inserting into `workspaces` rejects with `getPgError(e)?.code === "42501"`; as ben, inserting a membership into ana's workspace rejects with `42501`.
- "staff can't edit or delete; admins edit; only owners delete": staff `update … returning` gives `[]`; admin update returns 1 row; admin delete returns `[]`; owner delete returns 1 row and `adminDb` then finds 0 memberships for that workspace.
- "admins can't touch owners": admin updating the owner's role returns `[]`; admin setting a staff member to `owner` rejects with `42501`; owner promoting an admin to `owner` succeeds.
- "the last owner can't leave or step down": owner deleting their own membership rejects with `{ code: "P0001", message: "last_owner" }`; so does updating their own role to `admin`; after promoting ben to owner, ana can leave.
- "staff can leave on their own": staff deleting their own membership returns 1 row.
- "unknown time zones are rejected": owner updating `timezone` to `Mars/Olympus` rejects.
- "users can rename themselves but can't change their profile email": as ana, updating `fullName` succeeds and updating `email` rejects with `42501`.
- "the audit log is for owners and admins and can't be edited": staff select returns `[]`; owner select returns at least 1 row; owner `update … returning` returns `[]`.

Run: `npm run test:integration -- tests/integration/core-schema.test.ts`
Expected: FAIL, `relation "public.workspaces" does not exist` or `function private.create_workspace does not exist`.

- [ ] **Step 2: Create the helper functions migration**

Run: `npx drizzle-kit generate --custom --name=private_helpers` and fill the file. Use plpgsql, so the bodies can name `public.memberships` before the table exists:
```sql
create schema if not exists private;

create function private.is_member(ws uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.memberships m where m.workspace_id = ws and m.user_id = (select auth.uid()));
end $$;
```
`private.has_role(ws uuid, roles text[])` is the same with `and m.role::text = any(roles)`. `private.shares_workspace(other uuid)` returns whether a membership for the caller and a membership for `other` share a `workspace_id`.

- [ ] **Step 3: Write the schema files and generate the tables migration**

Write the tables and policies above with `pgTable` and `pgPolicy`, and export them from `src/db/schema/index.ts`.
Run: `npm run db:generate -- --name=core_tables`
Expected: one SQL file with the enum, 4 tables, the check constraints, RLS enabled on all 4 tables, and 10 policies. Don't edit generated files by hand.

- [ ] **Step 4: Create the functions migration**

Run: `npx drizzle-kit generate --custom --name=core_functions` and fill it, in this order:
1. Profiles follow `auth.users`:
```sql
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
```
   Add `private.sync_profile_email()` with trigger `on_auth_user_email_changed` (`after update of email on auth.users … when (old.email is distinct from new.email)`), which copies the new email to `profiles`.
2. Users may edit only their name and avatar:
```sql
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;
```
3. Time zones must be real: `private.validate_workspace()` runs `perform now() at time zone new.timezone;` (Postgres raises on unknown zones), on trigger `before insert or update of timezone on public.workspaces`.
4. A workspace always keeps an owner. The row lock serialises owner changes in one workspace, so two owners can't step down at the same moment; `found` is false when the whole workspace is being deleted, so the cascade isn't blocked:
```sql
create function private.ensure_workspace_has_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.workspaces where id = old.workspace_id for update;
    if found and not exists (
      select 1 from public.memberships m
      where m.workspace_id = old.workspace_id and m.role = 'owner' and m.id <> old.id
    ) then
      raise exception 'last_owner';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger ensure_workspace_has_owner before update of role or delete on public.memberships
  for each row execute function private.ensure_workspace_has_owner();
```
5. Workspace creation:
```sql
create function private.create_workspace(p_name text, p_slug text, p_website text, p_timezone text, p_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.workspaces (name, slug, website, timezone, currency, created_by)
  values (p_name, p_slug, nullif(p_website, ''), p_timezone, p_currency, v_user)
  returning id into v_id;
  insert into public.memberships (workspace_id, user_id, role) values (v_id, v_user, 'owner');
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id)
  values (v_id, v_user, 'workspace.created', 'workspace', v_id);
  return v_id;
end $$;
```
6. Grants:
```sql
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.shares_workspace(uuid),
  private.has_role(uuid, text[]),
  private.create_workspace(text, text, text, text, text) to authenticated;
```

- [ ] **Step 5: Apply the migrations**

Run: `npm run db:reset`
Expected: the three migrations apply in timestamp order with no errors.

- [ ] **Step 6: Run the tests, see them pass**

Run: `npm run test:integration`
Expected: all core-schema and rls-client tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): workspaces, memberships, profiles and audit log with RLS"
```

---

### Task 4: Invitations

**Files:**
- Create: `src/db/schema/invitations.ts`, `supabase/migrations/<ts>_invitations.sql` (generated), `supabase/migrations/<ts>_invitation_functions.sql` (custom), `src/features/team/invite-token.ts`, `tests/unit/invite-token.test.ts`, `tests/integration/invitations.test.ts`
- Modify: `src/db/schema/index.ts`, `tests/helpers/seed.ts`

**Interfaces:**
- Consumes: Task 3 tables, SQL helpers and test helpers
- Produces:
  - `INVITE_TTL_DAYS = 7`; `createInviteToken(): { token: string; tokenHash: string }`; `hashInviteToken(token: string): string`; `inviteExpiresAt(now: Date): Date`; `type InviteStatus = "pending" | "accepted" | "revoked" | "expired"`; `inviteStatus(invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InviteStatus`
  - Drizzle table `invitations`
  - SQL `private.accept_invitation(p_token text) → text` (the workspace slug), raising `not_authenticated`, `invite_not_found`, `invite_revoked`, `invite_used`, `invite_expired` or `invite_email_mismatch`
  - SQL `private.invitation_preview(p_token text) → table (workspace_name text, workspace_slug text, role public.workspace_role, email text, inviter_name text, status text)`, with zero rows for an unknown token
  - Test helper `createTestInvite(workspaceId: string, invitedBy: TestUser, opts: { email: string; role: "admin" | "staff"; expiresAt?: Date }): Promise<{ id: string; token: string }>`

Table `invitations`: `id`; `workspaceId` → workspaces on delete cascade; `email` text not null; `role` workspace_role not null; `tokenHash` text not null unique; `invitedBy` → `profiles.id` on delete set null; `expiresAt` timestamptz not null; `acceptedAt`; `acceptedBy` → `profiles.id` on delete set null; `revokedAt`; `createdAt`. Checks: `email = lower(email)`, `role <> 'owner'`. Unique index on (`workspace_id`, `email`) where `accepted_at is null and revoked_at is null`.

Policies (to authenticated): select `private.has_role(workspace_id, {owner,admin})`; insert with check `private.has_role(workspace_id, {owner,admin}) and invited_by = (select auth.uid())`; update using and with check `private.has_role(workspace_id, {owner,admin})`.

Status precedence, the same in TypeScript and SQL: accepted, then revoked, then expired (`expires_at <= now`), otherwise pending.

- [ ] **Step 1: Write the failing test `tests/unit/invite-token.test.ts`**

```ts
it("creates a URL-safe token and its SHA-256 hash", () => {
  const { token, tokenHash } = createInviteToken();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(tokenHash).toBe(hashInviteToken(token));
  expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
});
it("never repeats a token", () => {
  expect(new Set(Array.from({ length: 100 }, () => createInviteToken().token)).size).toBe(100);
});
it("hashes the same way every time", () => {
  expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
it("expires exactly 7 days later", () => {
  expect(inviteExpiresAt(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-31T10:00:00.000Z");
});
it("reports status in precedence order", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  const past = new Date("2026-10-20T00:00:00Z");
  const future = new Date("2026-10-30T00:00:00Z");
  expect(inviteStatus({ acceptedAt: past, revokedAt: null, expiresAt: past }, now)).toBe("accepted");
  expect(inviteStatus({ acceptedAt: null, revokedAt: past, expiresAt: past }, now)).toBe("revoked");
  expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe("expired");
  expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("pending");
});
```
Run: `npm test` Expected: FAIL, module not found.

- [ ] **Step 2: Implement `src/features/team/invite-token.ts`, see it pass**

Token: `randomBytes(32).toString("base64url")`. Hash: `createHash("sha256").update(token, "utf8").digest("hex")`.
Run: `npm test` Expected: PASS.

- [ ] **Step 3: Write the failing test `tests/integration/invitations.test.ts`**

- "TypeScript and Postgres hash tokens the same way": `select encode(sha256(convert_to('abc', 'UTF8')), 'hex')` equals `hashInviteToken("abc")`.
- "owners and admins can invite; staff can't": inserting as staff rejects with `42501`.
- "nobody can be invited as owner": inserting `role: "owner"` as the owner rejects with `23514`.
- "one pending invite per email": a second pending invite for the same email rejects with `23505`.
- "accepting adds the member with the invited role": ben accepts a staff invite through `withRls(claimsFor(ben), tx => tx.execute(sql\`select private.accept_invitation(${token}) as slug\`))`; the result is the workspace slug; ben's membership has `role: "staff"`; the invite has `acceptedAt` set and `acceptedBy` = ben; `audit_log` has `member.joined`.
- "accepts regardless of email case": user created as `Ana.Case.<uuid>@Example.com`, invite stored as the lower-case email; accepting succeeds.
- "rejects used, expired, revoked, wrong-email and unknown tokens": each rejects with `P0001` and `invite_used`, `invite_expired` (invite created with `expiresAt` in the past), `invite_revoked` (set `revoked_at` with `adminDb`), `invite_email_mismatch` (cara uses ben's invite), `invite_not_found` (random token).
- "accepting when already a member keeps the current role": an existing admin accepts a staff invite for their own email (inserted with `adminDb`); their role stays `admin`.
- "anyone with the link can preview it": `withRls(null)` selecting from `private.invitation_preview(token)` returns `{ workspace_name, workspace_slug, role: "staff", email, inviter_name: "Ana Lopez", status: "pending" }`; a random token returns `[]`.
- "the preview reports expired and accepted invites": `status` is `"expired"` and `"accepted"` respectively.

Run: `npm run test:integration -- tests/integration/invitations.test.ts`
Expected: FAIL, relation `invitations` does not exist.

- [ ] **Step 4: Add the table, generate and write the functions migration**

Write `src/db/schema/invitations.ts`, then run `npm run db:generate -- --name=invitations` and `npx drizzle-kit generate --custom --name=invitation_functions`. Fill the custom file:
```sql
create function private.accept_invitation(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.invitations%rowtype;
  v_slug text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.invitations
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;
  if not found then raise exception 'invite_not_found'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite_used'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite_expired'; end if;
  select email into v_email from auth.users where id = v_user;
  if lower(v_email) <> v_inv.email then raise exception 'invite_email_mismatch'; end if;
  insert into public.memberships (workspace_id, user_id, role)
  values (v_inv.workspace_id, v_user, v_inv.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (v_inv.workspace_id, v_user, 'member.joined', 'invitation', v_inv.id, jsonb_build_object('role', v_inv.role));
  select slug into v_slug from public.workspaces where id = v_inv.workspace_id;
  return v_slug;
end $$;
```
`private.invitation_preview` is `language sql stable security definer set search_path = ''`. It joins `invitations` to `workspaces` and left-joins `profiles` on `invited_by` (`coalesce(full_name, '')`), filters on the same token hash expression, and computes `status` with a `case` in the precedence above. Then:
```sql
revoke execute on function private.accept_invitation(text), private.invitation_preview(text) from public;
grant execute on function private.accept_invitation(text) to authenticated;
grant execute on function private.invitation_preview(text) to anon, authenticated;
```
Add `createTestInvite` to `tests/helpers/seed.ts`. It inserts as the inviter through RLS, with `createInviteToken()` and `inviteExpiresAt(new Date())` unless `expiresAt` is given.

- [ ] **Step 5: Apply and run, see it pass**

Run: `npm run db:reset`, then `npm run test:integration`
Expected: all integration tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): invitations with hashed tokens, accept and preview functions"
```

---

### Task 5: Base UI, theme and landing page

**Files:**
- Create (by shadcn): `components.json`, `src/components/ui/*`, `src/lib/utils.ts`
- Create: `src/components/brand/logo.tsx`, `src/components/theme/theme-provider.tsx`, `src/components/theme/theme-toggle.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(auth)/layout.tsx`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `package.json` (script `test:e2e`: `playwright test`)
- Delete: `src/app/page.tsx` (the `(marketing)` page replaces it)

**Interfaces:**
- Produces: `<Logo className?: string showName?: boolean />` (default `showName = true`): the lucide `ConciergeBell` icon in a rounded primary-coloured square plus the wordmark "FrontDesk AI"; `<ThemeToggle />`, a dropdown with Light, Dark and System; the shadcn components listed in Step 2; an `(auth)` layout that centres its children in one column under a `<Logo>` linking to `/`

- [ ] **Step 1: Load the `frontend-design` skill for the visual direction**

Direction: a calm, trustworthy SaaS look. Neutral surfaces, one brand colour (teal), Geist Sans (the scaffold default), `0.75rem` radius, generous spacing, works from 320px wide.

- [ ] **Step 2: Add shadcn/ui and theming**

```bash
npx shadcn@4.22.1 init
npx shadcn@4.22.1 add button input label card select dropdown-menu avatar badge dialog alert-dialog separator sonner sidebar skeleton tooltip command popover table
npm i -E next-themes@0.4.6 lucide-react@1.61.0
```
At the init prompts choose base colour Neutral with CSS variables.

- [ ] **Step 3: Set the brand tokens in `src/app/globals.css`**

Light: `--primary: oklch(0.52 0.09 185)`, `--primary-foreground: oklch(0.985 0 0)`. Dark: `--primary: oklch(0.72 0.11 182)`, `--primary-foreground: oklch(0.2 0.03 185)`. Set `--ring` to the primary value in both themes and `--radius: 0.75rem`. Leave the other shadcn tokens as generated.

- [ ] **Step 4: Root layout**

`metadata = { title: { default: "FrontDesk AI", template: "%s · FrontDesk AI" }, description: "An AI front desk that answers from your business data and books appointments." }`. Use `<html lang="en" suppressHydrationWarning>`, `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`), and `<Toaster />`.

- [ ] **Step 5: Install Playwright and write `playwright.config.ts`**

```bash
npm i -D -E @playwright/test@1.64.1
npx playwright install chromium
```
Config: load `.env.local` with `process.loadEnvFile` when present; `testDir: "tests/e2e"`; `fullyParallel: true`; `retries: process.env.CI ? 1 : 0`; `use: { baseURL: "http://localhost:3000", trace: "on-first-retry" }`; projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7, `testMatch: /smoke\.spec\.ts/`); `webServer: { command: process.env.CI ? "npm run start" : "npm run dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 }`.

- [ ] **Step 6: Write the failing test `tests/e2e/smoke.spec.ts`**

```ts
test("the landing page explains the product and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("FrontDesk AI");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The AI front desk that never guesses.");
  await expect(page.getByRole("link", { name: "Create your workspace" })).toHaveAttribute("href", "/sign-up");
});
test("the page never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("the theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
```
Run: `npm run test:e2e` Expected: FAIL (the scaffold page is still there).

- [ ] **Step 7: Build the landing page and the `(auth)` layout**

The header holds `<Logo>`, a "Sign in" link and `<ThemeToggle>` (accessible name "Change theme"). The hero h1 reads "The AI front desk that never guesses." and the paragraph reads "FrontDesk AI answers your customers from your own business data, books appointments into your real calendar, and hands the chat to your team when it isn't sure." Buttons: "Create your workspace" (primary, `/sign-up`) and "Sign in" (outline, `/sign-in`). Footer: "© 2026 FrontDesk AI · A portfolio project by Daksh Nimavat".

- [ ] **Step 8: Verify and commit**

Run: `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run build`
Expected: smoke tests pass on desktop and mobile; the rest succeed.
```bash
git add -A
git commit -m "feat(ui): design tokens, theme, landing page and Playwright"
```

---

### Task 6: Sessions, proxy and auth routes

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/lib/auth/redirect.ts`, `src/lib/auth/routing.ts`, `src/lib/auth/session.ts`, `src/lib/action-result.ts`, `src/features/workspaces/queries.ts`, `src/app/dashboard/page.tsx`, `src/app/auth/confirm/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/sign-out/route.ts`, `src/app/auth/error/page.tsx`, `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`, `tests/unit/redirect.test.ts`, `tests/unit/routing.test.ts`, `tests/e2e/auth-guard.spec.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `withRls`, `AuthClaims` (Task 2); `memberships`, `workspaces`, `WorkspaceRole` (Task 3); `getServerEnv`, `clientEnv` (Task 1)
- Produces:
  - `createSupabaseServerClient(): Promise<SupabaseClient>` (cookie-based, per the Supabase SSR guide) and `createSupabaseBrowserClient(): SupabaseClient`
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; isSignedIn: boolean }>`, which calls `auth.getClaims()`
  - `safeRedirectPath(next: string | null | undefined, siteUrl: string, fallback?: string): string` (fallback defaults to `/dashboard`)
  - `routeDecision(pathname: string, search: string, isSignedIn: boolean): { type: "next" } | { type: "redirect"; to: string }`
  - `getAuthClaims(): Promise<AuthClaims | null>` (wrapped in React `cache`; uses `auth.getClaims()`, never `getSession()`) and `requireUser(nextPath?: string): Promise<AuthClaims>` (redirects to `/sign-in?next=…`)
  - `type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }`, with `ok(data)` and `fail(error, fieldErrors?)` helpers
  - `listMyWorkspaces(claims: AuthClaims): Promise<{ id: string; name: string; slug: string; role: WorkspaceRole }[]>`, ordered by membership `createdAt` ascending
  - Routes: `GET /auth/confirm`, `GET /auth/callback`, `POST /auth/sign-out`, page `/auth/error`, page `/dashboard`

- [ ] **Step 1: Read the Next 16 guides for the proxy and route handlers in `node_modules/next/dist/docs/`**

- [ ] **Step 2: Write the failing tests `tests/unit/redirect.test.ts` and `tests/unit/routing.test.ts`**

```ts
const site = "http://localhost:3000";
it.each([
  ["/w/bloom", "/w/bloom"],
  ["/invite/abc?x=1", "/invite/abc?x=1"],
  ["http://localhost:3000/invite/abc", "/invite/abc"],
  ["//evil.com", "/dashboard"],
  ["/\\evil.com", "/dashboard"],
  ["https://evil.com/w/x", "/dashboard"],
  ["javascript:alert(1)", "/dashboard"],
  ["w/bloom", "/dashboard"],
  ["", "/dashboard"],
  [null, "/dashboard"],
])("safeRedirectPath(%j) gives %s", (next, expected) => {
  expect(safeRedirectPath(next, site)).toBe(expected);
});
```
```ts
const toSignIn = (next: string) => ({ type: "redirect", to: `/sign-in?next=${encodeURIComponent(next)}` });
it.each([
  ["/dashboard", "", false, toSignIn("/dashboard")],
  ["/w/bloom/team", "?tab=1", false, toSignIn("/w/bloom/team?tab=1")],
  ["/onboarding", "", false, toSignIn("/onboarding")],
  ["/account/update-password", "", false, toSignIn("/account/update-password")],
  ["/wizard", "", false, { type: "next" }],
  ["/invite/abc", "", false, { type: "next" }],
  ["/", "", false, { type: "next" }],
  ["/sign-in", "", true, { type: "redirect", to: "/dashboard" }],
  ["/sign-up", "", true, { type: "redirect", to: "/dashboard" }],
  ["/forgot-password", "", true, { type: "redirect", to: "/dashboard" }],
  ["/dashboard", "", true, { type: "next" }],
])("routeDecision(%s%s, signedIn=%s)", (path, search, signedIn, expected) => {
  expect(routeDecision(path, search, signedIn)).toEqual(expected);
});
```
Run: `npm test` Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `safeRedirectPath` and `routeDecision`, see them pass**

`safeRedirectPath` resolves `next` against `siteUrl` with `new URL`, accepts it only when the origin equals `siteUrl`'s origin and the raw value starts with `/` (not `//` or `/\`) or with `siteUrl` itself, and returns `pathname + search + hash`. `routeDecision` matches whole path segments: the protected prefixes are `/dashboard`, `/onboarding`, `/w`, `/account`, and the signed-out-only pages are `/sign-in`, `/sign-up`, `/forgot-password`.
Run: `npm test` Expected: PASS.

- [ ] **Step 4: Supabase clients, `updateSession` and `src/proxy.ts`**

Follow the Supabase Next.js SSR guide, using the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name. `proxy` calls `updateSession`, then `routeDecision`. For a redirect, build `NextResponse.redirect` and copy over the cookies plus the `cache-control`, `expires` and `pragma` headers from the session response, as the guide requires. Matcher: `"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"`.

- [ ] **Step 5: Session helpers, `ActionResult`, `listMyWorkspaces` and `/dashboard`**

`/dashboard` calls `requireUser("/dashboard")` and `listMyWorkspaces`; with no workspaces it redirects to `/onboarding`, otherwise to `/w/<first slug>` (Task 9 changes the choice).

- [ ] **Step 6: Auth route handlers and the error page**

- `/auth/confirm`: reads `token_hash`, `type` and `next`, then calls `verifyOtp({ type, token_hash })`. On success, `type === "recovery"` goes to `/account/update-password`; anything else goes to `safeRedirectPath(next, siteUrl)`. On failure it goes to `/auth/error?reason=link`.
- `/auth/callback`: `exchangeCodeForSession(code)`, then `safeRedirectPath(next, siteUrl)`. On failure it goes to `/auth/error?reason=oauth`.
- `/auth/sign-out` (POST): `auth.signOut()`, then a 303 redirect to `/`.
- `/auth/error` copy: `link` shows "That link has expired or was already used. Request a new one." with a link to `/sign-in`; `oauth` shows "Google sign-in didn't finish. Try again."; anything else shows "Something went wrong signing you in."

- [ ] **Step 7: Email templates**

`confirmation.html`: heading "Confirm your email", the line "Click the button to finish creating your FrontDesk AI account.", and a button "Confirm email" linking to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`. `recovery.html`: heading "Reset your password" and a button "Choose a new password" linking to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password`. In `config.toml`:
```toml
[auth.email.template.confirmation]
subject = "Confirm your FrontDesk AI account"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Reset your FrontDesk AI password"
content_path = "./supabase/templates/recovery.html"
```
Run: `npm run db:stop` then `npm run db:start`. Expected: the stack restarts with no config errors.

- [ ] **Step 8: Write and run `tests/e2e/auth-guard.spec.ts`**

```ts
test("signed-out visitors go to sign-in with a return path", async ({ page }) => {
  await page.goto("/w/some-salon/team");
  await expect(page).toHaveURL("/sign-in?next=%2Fw%2Fsome-salon%2Fteam");
});
test("a bad confirmation link shows a helpful error", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nope&type=email");
  await expect(page).toHaveURL("/auth/error?reason=link");
  await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
});
```
Run: `npm run test:e2e` Expected: PASS.

- [ ] **Step 9: Verify and commit**

Run: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Expected: all succeed.
```bash
git add -A
git commit -m "feat(auth): Supabase sessions, proxy guard and auth routes"
```

---

### Task 7: Sign-up, sign-in and password reset screens

**Files:**
- Create: `src/features/auth/schemas.ts`, `src/features/auth/actions.ts`, `src/app/(auth)/sign-up/page.tsx`, `src/app/(auth)/sign-up/sign-up-form.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/sign-in-form.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/forgot-password/forgot-password-form.tsx`, `src/app/account/update-password/page.tsx`, `src/app/account/update-password/update-password-form.tsx`, `src/components/auth/google-button.tsx`, `tests/unit/auth-schemas.test.ts`, `tests/e2e/helpers/mailpit.ts`, `tests/e2e/helpers/auth.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Task 6 (`createSupabaseServerClient`, `createSupabaseBrowserClient`, `safeRedirectPath`, `requireUser`, `ActionResult`, `clientEnv`); `createTestUser` (Task 3)
- Produces:
  - Zod schemas: `signUpSchema` (`fullName` trimmed, 1 to 80; `email` trimmed and lower-cased; `password` 8 to 72), `signInSchema` (`email`, `password` min 1, optional `next`), `emailOnlySchema`, `newPasswordSchema` (`password` 8 to 72 and `confirmPassword`, refined to match, with the issue on `confirmPassword`)
  - Server actions shaped for `useActionState` as `(prev: ActionResult, formData: FormData) => Promise<ActionResult>`: `signUp`, `signIn` (redirects on success), `resendConfirmation`, `requestPasswordReset`, `updatePassword` (redirects to `/dashboard`)
  - `latestEmailLink(to: string, pathIncludes: string): Promise<string>` in `tests/e2e/helpers/mailpit.ts`: polls `${MAILPIT_URL}/api/v1/search?query=to:${to}` every 500 ms for up to 15 s, opens the newest message with `/api/v1/message/{ID}`, and returns the first `href` containing `pathIncludes`, with `&amp;` decoded
  - `signIn(page: Page, user: { email: string; password: string }, opts?: { next?: string }): Promise<void>` in `tests/e2e/helpers/auth.ts` (opens `/sign-in`, adding `?next=` when given, fills the form and submits)

Exact copy:

| Situation | Text |
|---|---|
| Sign-up succeeded (also shown for emails that already have an account) | "Check your inbox. We sent a link to confirm your email." |
| `invalid_credentials` | "That email and password don't match." |
| `email_not_confirmed` | "Confirm your email first." plus a button "Send the link again" |
| Resend done | "We sent a new link." |
| Reset requested (always) | "If there's an account for that email, we've sent a reset link." |
| Passwords differ | "Passwords don't match." |
| Password too short | "Use at least 8 characters." |
| Any other auth error | "Something went wrong. Try again in a moment." |

Screens:
- Sign up (title "Create your account"): fields "Full name", "Work email", "Password" (hint "At least 8 characters"); hidden `next` from the search params; button "Create account"; link "Already have an account? Sign in" that keeps `next`. `signUp` calls `auth.signUp({ email, password, options: { emailRedirectTo: siteUrl + safeRedirectPath(next, siteUrl), data: { full_name } } })` and, on success, replaces the form with the success text.
- Sign in (title "Sign in"): "Email", "Password", link "Forgot password?", button "Sign in"; on success redirect to `safeRedirectPath(next, siteUrl)`.
- Google button ("Continue with Google", on both screens, only when `clientEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`): `signInWithOAuth({ provider: "google", options: { redirectTo: \`${location.origin}/auth/callback?next=${encodeURIComponent(next)}\` } })`.
- Forgot password (title "Reset your password"): "Email", button "Send reset link"; calls `resetPasswordForEmail(email, { redirectTo: siteUrl + "/account/update-password" })`.
- Update password (title "Choose a new password", calls `requireUser`): "New password", "Confirm password", button "Save password"; calls `auth.updateUser({ password })`.

- [ ] **Step 1: Write the failing test `tests/unit/auth-schemas.test.ts`**

```ts
it("trims the name and lower-cases the email", () => {
  expect(signUpSchema.parse({ fullName: "  Ana ", email: " Ana@Salon.COM ", password: "longenough" })).toMatchObject({
    fullName: "Ana",
    email: "ana@salon.com",
  });
});
it("enforces password length", () => {
  expect(signUpSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "1234567" }).success).toBe(false);
  expect(signUpSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "x".repeat(73) }).success).toBe(false);
});
it("flags mismatched passwords on the confirm field", () => {
  const r = newPasswordSchema.safeParse({ password: "Password123!", confirmPassword: "Password124!" });
  expect(r.success).toBe(false);
  expect(r.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "Passwords don't match." });
});
```
Run: `npm test` Expected: FAIL.

- [ ] **Step 2: Implement `src/features/auth/schemas.ts`, see it pass**

- [ ] **Step 3: Write the e2e helpers and the failing test `tests/e2e/auth.spec.ts`**

```ts
test("a new owner signs up and confirms their email", async ({ page }) => {
  const email = `owner-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Ana Lopez");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox.")).toBeVisible();
  await page.goto(await latestEmailLink(email, "/auth/confirm"));
  await expect(page).toHaveURL("/onboarding");
});
test("sign-in explains a wrong password, then works", async ({ page }) => {
  const user = await createTestUser();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  await signIn(page, user);
  await expect(page).toHaveURL("/onboarding");
});
test("a user resets a forgotten password", async ({ page }) => {
  const user = await createTestUser();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If there's an account for that email, we've sent a reset link.")).toBeVisible();
  await page.goto(await latestEmailLink(user.email, "/auth/confirm"));
  await expect(page).toHaveURL("/account/update-password");
  await page.getByLabel("New password").fill("NewPassword456!");
  await page.getByLabel("Confirm password").fill("NewPassword456!");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL("/onboarding");
  await page.request.post("/auth/sign-out");
  await signIn(page, { email: user.email, password: "NewPassword456!" });
  await expect(page).toHaveURL("/onboarding");
});
```
Run: `npm run test:e2e -- tests/e2e/auth.spec.ts` Expected: FAIL, `/sign-up` returns 404. (`/onboarding` itself arrives in Task 8; these tests only check the URL.)

- [ ] **Step 4: Implement the actions, screens and Google button**

- [ ] **Step 5: Run and verify**

Run: `npm run test:e2e`, `npm test`, `npm run lint`, `npm run typecheck`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): sign-up, sign-in and password reset screens"
```

---

### Task 8: Onboarding: create the workspace

**Files:**
- Create: `src/features/workspaces/slug.ts`, `src/features/workspaces/schemas.ts`, `src/features/workspaces/records.ts`, `src/features/workspaces/actions.ts`, `src/lib/locale-options.ts`, `src/components/forms/searchable-select.tsx`, `src/app/onboarding/page.tsx`, `src/app/onboarding/workspace-form.tsx`, `src/app/w/[slug]/page.tsx`, `tests/unit/slug.test.ts`, `tests/unit/workspace-schemas.test.ts`, `tests/integration/workspace-records.test.ts`
- Modify: `src/features/workspaces/queries.ts`, `src/lib/auth/session.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Tasks 2, 3 and 6
- Produces:
  - `slugify(name: string): string`; `withRandomSuffix(slug: string): string` (appends `-` and 4 characters from `[a-z0-9]`, trimming the base so the result is at most 48 characters)
  - `parseWebsite(input: string): { ok: true; value: string | null } | { ok: false }`
  - `isValidTimeZone(tz: string): boolean` (`Intl.supportedValuesOf("timeZone")` plus `"UTC"`); `isValidCurrency(code: string): boolean` (`Intl.supportedValuesOf("currency")`)
  - `workspaceDetailsSchema` and `type WorkspaceDetails = { name: string; website: string | null; timezone: string; currency: string }`
  - `timeZoneOptions(): { value: string; label: string }[]` (label is the zone with `_` shown as a space); `currencyOptions(): { value: string; label: string }[]` (label like `USD · US Dollar` from `Intl.DisplayNames`; USD, GBP, EUR, CAD, AUD and INR first, then the rest alphabetically)
  - `<SearchableSelect name: string label: string options: { value: string; label: string }[] defaultValue?: string placeholder?: string />`: a shadcn Command and Popover combobox that submits through a hidden input
  - `createWorkspaceRecord(claims: AuthClaims, input: WorkspaceDetails): Promise<{ id: string; slug: string }>`: calls `private.create_workspace`; on `23505` retries with `withRandomSuffix(slugify(name))` up to 3 times, then throws. Each attempt is its own `withRls` call, because a failed statement aborts the transaction it ran in.
  - action `createWorkspace(prev: ActionResult, formData: FormData): Promise<ActionResult>`, which redirects to `/w/<slug>`
  - `type Membership = { membershipId: string; role: WorkspaceRole; workspace: { id: string; name: string; slug: string; website: string | null; timezone: string; currency: string } }`
  - `getMembershipBySlug(claims: AuthClaims, slug: string): Promise<Membership | null>`, wrapped in React `cache`
  - `requireMembership(slug: string): Promise<{ claims: AuthClaims; membership: Membership }>`: calls `requireUser(\`/w/${slug}\`)`, then `notFound()` when there's no membership

Exact copy: page title and heading "Set up your business"; intro "This is what your receptionist will use. You can change it later."; fields "Business name", "Website (optional)", "Time zone", "Currency"; button "Create workspace"; errors "Use 2 to 80 characters.", "Enter a full website address, like bloomsalon.com.", "Choose a time zone from the list.", "Choose a currency from the list."; a "Back to dashboard" link when the user already has a workspace.

- [ ] **Step 1: Write the failing tests `tests/unit/slug.test.ts` and `tests/unit/workspace-schemas.test.ts`**

```ts
it.each([
  ["Bloom Hair & Beauty", "bloom-hair-beauty"],
  ["Café Lumière", "cafe-lumiere"],
  ["  --Hello--  ", "hello"],
  ["Nail   Bar 24/7", "nail-bar-24-7"],
  ["美容室", "workspace"],
  ["Hi", "workspace"],
  ["A".repeat(60), "a".repeat(40)],
  ["abcdefghi ".repeat(6), "abcdefghi-abcdefghi-abcdefghi-abcdefghi"],
])("slugify(%j) gives %s", (name, expected) => expect(slugify(name)).toBe(expected));
it("adds a 4-character suffix and stays within 48 characters", () => {
  expect(withRandomSuffix("bloom-hair-beauty")).toMatch(/^bloom-hair-beauty-[a-z0-9]{4}$/);
  expect(withRandomSuffix("a".repeat(48)).length).toBeLessThanOrEqual(48);
});
```
```ts
it.each([
  ["", { ok: true, value: null }],
  ["bloomsalon.com", { ok: true, value: "https://bloomsalon.com" }],
  ["http://bloom.com/about", { ok: true, value: "http://bloom.com/about" }],
  ["not a url", { ok: false }],
  ["ftp://bloom.com", { ok: false }],
  ["javascript:alert(1)", { ok: false }],
  ["localhost", { ok: false }],
])("parseWebsite(%j)", (input, expected) => expect(parseWebsite(input)).toEqual(expected));
it("normalises valid details", () => {
  expect(workspaceDetailsSchema.parse({ name: " Bloom ", website: "", timezone: "America/Chicago", currency: "usd" })).toEqual({
    name: "Bloom", website: null, timezone: "America/Chicago", currency: "USD",
  });
});
it("rejects bad details with the exact messages", () => {
  const r = workspaceDetailsSchema.safeParse({ name: "B", website: "nope", timezone: "Mars/Olympus", currency: "ABC" });
  expect(z.flattenError(r.error!).fieldErrors).toEqual({
    name: ["Use 2 to 80 characters."],
    website: ["Enter a full website address, like bloomsalon.com."],
    timezone: ["Choose a time zone from the list."],
    currency: ["Choose a currency from the list."],
  });
});
```
Run: `npm test` Expected: FAIL.

- [ ] **Step 2: Implement `slug.ts`, `schemas.ts` and `locale-options.ts`, see them pass**

`slugify`: NFKD-normalise, strip combining marks, lower-case, replace runs of characters outside `[a-z0-9]` with `-`, trim hyphens, cut to 40 characters, trim hyphens again; anything shorter than 3 characters becomes `workspace`. `parseWebsite`: add `https://` when there's no scheme, accept only `http:` and `https:` with a dot in the hostname, and drop a lone trailing `/`.

- [ ] **Step 3: Write the failing test `tests/integration/workspace-records.test.ts`**

- "creates the workspace and returns its slug": name `Bloom <8 hex>` gives slug `bloom-<8 hex>`; the owner's membership exists; `trackWorkspace(id)`.
- "same name twice gets a suffixed slug": two calls with `Twin Salon <8 hex>` give `twin-salon-<8 hex>` and then a slug matching `^twin-salon-<8 hex>-[a-z0-9]{4}$`.
- "stores normalised details": an empty website is stored as `null` and the currency as `USD`.

Run: `npm run test:integration -- tests/integration/workspace-records.test.ts` Expected: FAIL.

- [ ] **Step 4: Implement `records.ts`, `getMembershipBySlug` and `requireMembership`, see them pass**

- [ ] **Step 5: Build `/onboarding`, the `createWorkspace` action and a minimal `/w/[slug]` page**

`/onboarding` calls `requireUser("/onboarding")`. The time zone defaults on the client, after mount, to the browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), falling back to `America/Chicago`; currency defaults to `USD`. `/w/[slug]/page.tsx` calls `requireMembership(slug)` and renders an h1 with the workspace name (Task 9 builds the full overview).

- [ ] **Step 6: Extend the first test in `tests/e2e/auth.spec.ts`**

After the URL check: fill "Business name" with `Bloom Hair & Beauty ${Date.now()}`, choose "America/Chicago" in "Time zone", click "Create workspace", then expect the URL to match `/\/w\/bloom-hair-beauty-\d+/` and the h1 to contain "Bloom Hair & Beauty".
Run: `npm run test:e2e -- tests/e2e/auth.spec.ts` Expected: PASS.

- [ ] **Step 7: Verify and commit**

Run: `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`. Expected: all pass.
```bash
git add -A
git commit -m "feat(workspaces): onboarding creates a workspace with a unique slug"
```

---

### Task 9: App shell and workspace switching

**Files:**
- Create: `src/app/w/[slug]/layout.tsx`, `src/components/app-shell/app-sidebar.tsx`, `src/components/app-shell/sidebar-nav.tsx`, `src/components/app-shell/workspace-switcher.tsx`, `src/components/app-shell/user-menu.tsx`, `src/components/app-shell/nav-items.ts`, `src/lib/auth/home.ts`, `src/features/account/queries.ts`, `src/features/team/queries.ts`, `tests/unit/home.test.ts`, `tests/unit/nav-items.test.ts`, `tests/e2e/shell.spec.ts`
- Modify: `src/app/w/[slug]/page.tsx`, `src/app/dashboard/page.tsx`, `src/proxy.ts`

**Interfaces:**
- Consumes: `requireMembership`, `Membership`, `listMyWorkspaces` (Tasks 6 and 8); `profiles`, `memberships`
- Produces:
  - `LAST_WORKSPACE_COOKIE = "fd_last_workspace"` and `pickHomeWorkspace(workspaces: { slug: string }[], lastSlug: string | undefined): string | null` in `src/lib/auth/home.ts`
  - `navItems(slug: string, role: WorkspaceRole): { label: string; href: string; icon: LucideIcon }[]`: Overview `/w/{slug}` (`LayoutDashboard`), Team `/w/{slug}/team` (`Users`), Settings `/w/{slug}/settings` (`Settings`, owner and admin only)
  - `getMyProfile(claims: AuthClaims): Promise<{ fullName: string; email: string; avatarUrl: string | null }>` in `src/features/account/queries.ts`
  - `countMembers(claims: AuthClaims, workspaceId: string): Promise<number>` in `src/features/team/queries.ts`

- [ ] **Step 1: Write the failing tests `tests/unit/home.test.ts` and `tests/unit/nav-items.test.ts`**

```ts
const list = [{ slug: "north" }, { slug: "south" }];
it("returns the last workspace when the user still belongs to it", () => expect(pickHomeWorkspace(list, "south")).toBe("south"));
it("falls back to the first workspace", () => {
  expect(pickHomeWorkspace(list, "gone")).toBe("north");
  expect(pickHomeWorkspace(list, undefined)).toBe("north");
});
it("returns null when there are no workspaces", () => expect(pickHomeWorkspace([], "south")).toBeNull());
```
```ts
it("hides Settings from staff", () => {
  expect(navItems("bloom", "staff").map((i) => i.label)).toEqual(["Overview", "Team"]);
});
it("shows Settings to owners and admins", () => {
  expect(navItems("bloom", "admin").map((i) => i.href)).toEqual(["/w/bloom", "/w/bloom/team", "/w/bloom/settings"]);
});
```
Run: `npm test` Expected: FAIL.

- [ ] **Step 2: Implement `home.ts` and `nav-items.ts`, see them pass**

- [ ] **Step 3: Build the shell**

`layout.tsx` calls `requireMembership(slug)` and renders the shadcn `SidebarProvider`. `AppSidebar` has `WorkspaceSwitcher` in the header, `SidebarNav` in the content (a client component that marks the active item with `usePathname`), and `UserMenu` in the footer. `SidebarInset` has a top bar with `SidebarTrigger` and `ThemeToggle`.
- `WorkspaceSwitcher`: a dropdown listing `listMyWorkspaces` (name plus a role badge, a check on the current one) and "New workspace", which goes to `/onboarding`.
- `UserMenu`: avatar initials, name and email; items "Light", "Dark", "System"; "Sign out" as a form that POSTs to `/auth/sign-out`.
- Overview `/w/[slug]`: h1 "Welcome to {name}". A "Business details" card shows the website (or "No website yet"), time zone and currency, plus an "Edit details" link to settings for owners and admins. A "Team" card shows "{n} members" (or "1 member") and a "Manage team" link.

- [ ] **Step 4: Remember the last workspace**

In `src/proxy.ts`, when the path matches `^/w/([a-z0-9-]+)(?:/|$)`, set `fd_last_workspace` on the response (`httpOnly`, `sameSite: "lax"`, `path: "/"`, one year, `secure` in production). `/dashboard` now redirects to `pickHomeWorkspace(list, cookie)`.

- [ ] **Step 5: Write and run `tests/e2e/shell.spec.ts`**

- "switches between workspaces and remembers the last one": seed a user with "North Salon" and "South Spa" (`createTestWorkspace`), call `signIn`, open the switcher, choose "South Spa", expect the URL to be South's; go to `/dashboard` and expect South's URL again.
- "on a phone, the menu opens from the top bar": `page.setViewportSize({ width: 390, height: 844 })`; the "Team" link is hidden until the "Toggle Sidebar" button is tapped.
- "staff don't see Settings": seed a staff member (`addTestMember`), sign in, and expect no "Settings" link.

Run: `npm run test:e2e -- tests/e2e/shell.spec.ts` Expected: PASS.

- [ ] **Step 6: Verify and commit**

Run: `npm test`, `npm run lint`, `npm run typecheck`. Expected: all pass.
```bash
git add -A
git commit -m "feat(app): sidebar shell, workspace switcher and overview"
```

---

### Task 10: Workspace settings

**Files:**
- Create: `src/features/workspaces/permissions.ts`, `src/app/w/[slug]/settings/page.tsx`, `src/app/w/[slug]/settings/business-details-form.tsx`, `src/app/w/[slug]/settings/delete-workspace-dialog.tsx`, `tests/unit/permissions.test.ts`, `tests/integration/workspace-settings.test.ts`, `tests/e2e/settings.spec.ts`
- Modify: `src/features/workspaces/records.ts`, `src/features/workspaces/actions.ts`, `src/components/app-shell/nav-items.ts`

**Interfaces:**
- Consumes: `requireMembership`, `workspaceDetailsSchema`, `SearchableSelect`, `withRls` (earlier tasks)
- Produces:
  - In `permissions.ts`: `canEditWorkspace(role: WorkspaceRole): boolean`, `canDeleteWorkspace(role)`, `canManageTeam(role)`, `canChangeRole(actor: WorkspaceRole, target: WorkspaceRole, next: WorkspaceRole): boolean`, `canRemoveMember(actor: WorkspaceRole, target: WorkspaceRole, isSelf: boolean): boolean`. These mirror the Task 3 policies. They decide what the UI shows and let actions fail early; RLS still enforces. The last-owner rule lives only in the database (`last_owner`).
  - `updateWorkspaceRecord(claims: AuthClaims, workspaceId: string, input: WorkspaceDetails): Promise<"ok" | "not_allowed">`: `update … returning`, where no row means `not_allowed`; writes audit `workspace.updated` with `metadata: { changed: string[] }` (changed field names)
  - `deleteWorkspaceRecord(claims: AuthClaims, workspaceId: string): Promise<"ok" | "not_allowed">`
  - Actions with `slug` bound: `updateWorkspaceDetails(slug, prev, formData)` returns `ok()` (the form shows a toast "Saved."); `deleteWorkspace(slug, prev, formData)` needs `confirmName` equal to the workspace name (otherwise "Type the workspace name exactly to confirm.") and redirects to `/dashboard`

- [ ] **Step 1: Write the failing test `tests/unit/permissions.test.ts`**

```ts
it("only owners and admins edit and manage the team; only owners delete", () => {
  expect([canEditWorkspace("owner"), canEditWorkspace("admin"), canEditWorkspace("staff")]).toEqual([true, true, false]);
  expect([canManageTeam("owner"), canManageTeam("admin"), canManageTeam("staff")]).toEqual([true, true, false]);
  expect([canDeleteWorkspace("owner"), canDeleteWorkspace("admin"), canDeleteWorkspace("staff")]).toEqual([true, false, false]);
});
it.each([
  ["owner", "staff", "admin", true], ["owner", "admin", "owner", true], ["owner", "owner", "admin", true],
  ["admin", "staff", "admin", true], ["admin", "admin", "staff", true],
  ["admin", "owner", "admin", false], ["admin", "staff", "owner", false], ["staff", "staff", "admin", false],
] as const)("canChangeRole(%s changes %s to %s) is %s", (a, t, n, ok) => expect(canChangeRole(a, t, n)).toBe(ok));
it.each([
  ["staff", "staff", true, true], ["staff", "admin", false, false],
  ["admin", "staff", false, true], ["admin", "admin", false, true], ["admin", "owner", false, false],
  ["owner", "owner", false, true], ["owner", "admin", false, true],
] as const)("canRemoveMember(%s removes %s, self=%s) is %s", (a, t, self, ok) => expect(canRemoveMember(a, t, self)).toBe(ok));
```
Run: `npm test` Expected: FAIL.

- [ ] **Step 2: Implement `permissions.ts`, see it pass; switch `navItems` to `canEditWorkspace`**

- [ ] **Step 3: Write the failing test `tests/integration/workspace-settings.test.ts`**

- "staff can't change details": `updateWorkspaceRecord` as staff returns `"not_allowed"` and the row is unchanged.
- "admins can change details and it's logged": returns `"ok"`; the audit row has `action: "workspace.updated"` and `metadata.changed` equal to `["name"]`.
- "only the owner can delete": admin gets `"not_allowed"`; owner gets `"ok"` and the workspace is gone.

Run: `npm run test:integration -- tests/integration/workspace-settings.test.ts` Expected: FAIL.

- [ ] **Step 4: Implement the records and actions, see them pass**

- [ ] **Step 5: Build `/w/[slug]/settings`**

`notFound()` unless `canEditWorkspace`. Section "Business details" holds the onboarding fields, prefilled, with the button "Save changes". Section "Danger zone" (owners only) has a button "Delete workspace" that opens an alert dialog: "This deletes {name}, its team and everything in it. This can't be undone.", an input labelled "Type {name} to confirm", and a button "Delete workspace".

- [ ] **Step 6: Write and run `tests/e2e/settings.spec.ts`**

- "an owner renames the workspace": change "Business name", click "Save changes", expect the "Saved." toast, reload, and expect the new name in the switcher.
- "staff get a 404 on settings": `const res = await page.goto(\`/w/${slug}/settings\`)` and `expect(res?.status()).toBe(404)`.
- "an owner deletes the workspace after typing its name": a wrong name shows "Type the workspace name exactly to confirm."; the right name ends at `/onboarding`.

Run: `npm run test:e2e -- tests/e2e/settings.spec.ts` Expected: PASS.

- [ ] **Step 7: Verify and commit**

```bash
git add -A
git commit -m "feat(workspaces): settings for business details and workspace deletion"
```

---

### Task 11: Team and invitations

**Files:**
- Create: `src/features/team/records.ts`, `src/features/team/actions.ts`, `src/features/team/messages.ts`, `src/app/w/[slug]/team/page.tsx`, `src/app/w/[slug]/team/members-table.tsx`, `src/app/w/[slug]/team/invite-dialog.tsx`, `src/app/w/[slug]/team/pending-invites.tsx`, `src/app/invite/[token]/page.tsx`, `src/app/invite/[token]/accept-form.tsx`, `tests/integration/team-records.test.ts`, `tests/e2e/team.spec.ts`
- Modify: `src/features/team/queries.ts`

**Interfaces:**
- Consumes: `createInviteToken`, `inviteExpiresAt`, `inviteStatus`, `InviteStatus` (Task 4); permissions (Task 10); `getPgError` (Task 2); `requireMembership`, `getAuthClaims`, `getMembershipBySlug` (Tasks 6 and 8); `updateWorkspaceRecord` (Task 10)
- Produces:
  - Queries: `listMembers(claims: AuthClaims, workspaceId: string): Promise<{ membershipId: string; userId: string; fullName: string; email: string; avatarUrl: string | null; role: WorkspaceRole; joinedAt: Date }[]>` (owners, then admins, then staff, then by name); `listPendingInvites(claims: AuthClaims, workspaceId: string): Promise<{ id: string; email: string; role: "admin" | "staff"; expiresAt: Date; status: InviteStatus }[]>` (not accepted and not revoked, expired ones included, newest first); `getInvitePreview(claims: AuthClaims | null, token: string): Promise<{ workspaceName: string; workspaceSlug: string; role: WorkspaceRole; email: string; inviterName: string; status: InviteStatus } | null>`
  - Records:
    - `createInviteRecord(claims, workspaceId, input: { email: string; role: "admin" | "staff" }): Promise<{ ok: true; token: string } | { ok: false; error: "not_allowed" | "already_member" }>`. In one `withRls` transaction: refuse if a member's profile has that email; set `revoked_at = now()` on pending invites for that email; insert the new invite; write audit `invite.created` with `{ email, role }`.
    - `revokeInviteRecord(claims, workspaceId, inviteId): Promise<"ok" | "not_allowed">` (audit `invite.revoked`)
    - `changeRoleRecord(claims, workspaceId, membershipId, role: WorkspaceRole): Promise<"ok" | "not_allowed" | "last_owner">` (audit `member.role_changed` with `{ from, to }`)
    - `removeMemberRecord(claims, workspaceId, membershipId): Promise<"ok" | "not_allowed" | "last_owner">` (audit `member.left` when removing yourself, otherwise `member.removed`). Write the audit row before the delete, because the insert policy needs the actor to still be a member. If the delete removes no row, throw inside `withRls` so the audit row rolls back too, then return `"not_allowed"`.
    - `acceptInviteRecord(claims, token): Promise<{ ok: true; slug: string } | { ok: false; error: InviteError }>` where `InviteError = "invite_not_found" | "invite_revoked" | "invite_used" | "invite_expired" | "invite_email_mismatch"`
  - `teamErrorMessage(code: string, vars?: { email?: string }): string` in `messages.ts`, mapping to the copy below
  - Actions with `slug` bound: `inviteMember`, `revokeInvite`, `changeMemberRole`, `removeMember`; plus `acceptInvite(token)`, which redirects to `/w/<slug>`

Exact copy:

| Code or situation | Text |
|---|---|
| `already_member` | "That person is already in this workspace." |
| `last_owner` | "A workspace needs at least one owner. Make someone else an owner first." |
| `not_allowed` | "You don't have permission to do that." |
| `invite_not_found` | "This invite link isn't valid." |
| `invite_revoked` | "This invite was cancelled." |
| `invite_used` | "This invite has already been used." |
| `invite_expired` | "This invite has expired. Ask for a new one." |
| `invite_email_mismatch` | "This invite was sent to {email}. Sign in with that email to accept it." |
| Invite created | "Send this link to {email}. It works once and expires in 7 days." |
| Link copied | "Link copied." |

Screens:
- `/w/[slug]/team`, visible to every member. Heading "Team". A members table with name and email, role, and joined date. The role is a select where `canChangeRole` allows and a badge otherwise. A row menu offers "Remove from workspace" when `canRemoveMember` allows, or "Leave workspace" on your own row. Confirm dialogs: "Remove {name}? They'll lose access right away." and "Leave {workspace}? You'll need a new invite to come back."
- Invite (`canManageTeam`): the button "Invite teammate" opens a dialog with "Email" and "Role" (Staff by default, or Admin) and the button "Create invite link". The dialog then shows the created copy, a read-only input labelled "Invite link" holding `${siteUrl}/invite/${token}`, and a "Copy link" button. The token is shown only here; only its hash is stored.
- Pending invites (`canManageTeam`): email, role, "Expires {date}" or "Expired", and a "Revoke" button.
- `/invite/[token]`, no sign-in required: `getInvitePreview(await getAuthClaims(), token)`.
  - `null`, `accepted`, `revoked` or `expired`: the matching copy and a link to `/`.
  - Pending and signed out: "{inviterName} invited you to join {workspaceName} as {Admin|Staff}." and "This invite is for {email}.", with the buttons "Sign in to accept" (`/sign-in?next=/invite/{token}`) and "Create an account" (`/sign-up?next=/invite/{token}`).
  - Pending and signed in with another email (case-insensitive compare): the mismatch copy and a "Sign out" button.
  - Pending and signed in with the right email: an "Accept and join" button.

- [ ] **Step 1: Write the failing test `tests/integration/team-records.test.ts`**

- "an owner's invite link lets a teammate join": `createInviteRecord` returns a token; `acceptInviteRecord(claimsFor(ben), token)` returns `{ ok: true, slug }`; `listMembers` includes ben as `staff`.
- "inviting an existing member is refused": `{ ok: false, error: "already_member" }`.
- "a new invite cancels the older link": the first token now gives `invite_revoked` and the second works.
- "staff can't invite, change roles or remove others": each returns `"not_allowed"`.
- "admins can't remove owners": `"not_allowed"`.
- "the last owner can't leave": `removeMemberRecord` on your own membership returns `"last_owner"`.
- "removed member loses access immediately": after the owner removes an admin, `getMembershipBySlug(admin)` is `null`, `updateWorkspaceRecord(admin)` is `"not_allowed"`, and `listMembers(admin)` is `[]`.
- "staff don't see pending invites": `listPendingInvites(staff)` is `[]`.
- "staff can leave and it's logged": leaving returns `"ok"`, and `adminDb` finds a `member.left` audit row.
- "a refused removal leaves no audit row": staff trying to remove an admin gets `"not_allowed"`, and `adminDb` finds no `member.removed` row for that membership.

Run: `npm run test:integration -- tests/integration/team-records.test.ts` Expected: FAIL.

- [ ] **Step 2: Implement the queries, records and messages, see them pass**

Map database errors with `getPgError`: `P0001` with an `invite_*` or `last_owner` message gives that code; `42501` gives `not_allowed`.

- [ ] **Step 3: Build the team page, the invite dialog and the invite page**

- [ ] **Step 4: Write and run `tests/e2e/team.spec.ts`**

- "owner invites someone who already has an account": the owner signs in, opens Team, clicks "Invite teammate", enters the existing user's email with role Staff, clicks "Create invite link", and reads `page.getByLabel("Invite link").inputValue()`. In a fresh context (`browser.newContext()`), open the link, click "Sign in to accept", fill the sign-in form that opens (it carries `next`), expect `/invite/<token>`, click "Accept and join", expect `/w/<slug>`, and expect no "Settings" link.
- "new user signs up from an invite and joins": open the link signed out, click "Create an account", sign up with the invited email, open the confirmation link from Mailpit, expect `/invite/<token>`, accept, and expect `/w/<slug>`.
- "the wrong account sees who the invite is for": signed in as another user, the page shows "This invite was sent to {email}."
- "owner revokes a pending invite": click "Revoke"; the link then shows "This invite was cancelled."

Run: `npm run test:e2e -- tests/e2e/team.spec.ts` Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm test`, `npm run test:integration`, `npm run lint`, `npm run typecheck`. Expected: all pass.
```bash
git add -A
git commit -m "feat(team): members, roles, invite links and accepting invites"
```

---

### Task 12: CI, README and the first deployment

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (replace the scaffold text), `.env.example`, `package.json` (add `"engines": { "node": ">=24" }`)

**Interfaces:**
- Consumes: every script from the earlier tasks
- Produces: a CI workflow that runs on pushes to `main` and on pull requests; a public GitHub repository; a hosted Supabase project; a Vercel deployment

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - name: Start Supabase
        run: npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor
      - name: Export Supabase env
        run: node scripts/supabase-env.ts >> "$GITHUB_ENV"
      - run: npm run test:integration
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
```

- [ ] **Step 2: Write the README**

Sections:
- "FrontDesk AI": one paragraph from spec section 1, plus "Status: milestone 1 of 12 (foundation)".
- "Run it locally": needs Node 24 and Docker Desktop; then `npm ci`, `npm run db:start`, `npm run env:local`, `npm run dev`; local emails at `http://127.0.0.1:54324`.
- "Tests": the four test commands.
- "How data is protected": three sentences on `withRls`, RLS policies and the `private` functions.
- "Project layout": the top-level folders.
- "Deploying": Steps 5 to 9 below.

- [ ] **Step 3: Run the full local gate**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run db:reset && npm run test:integration && npm run build && npm run test:e2e
```
Expected: every command passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: GitHub Actions pipeline and setup README"
```

- [ ] **Step 5: GitHub (Daksh creates the repo; push only after his go-ahead)**

Daksh creates an empty public repository named `frontdesk-ai` on github.com (no README, licence or .gitignore). Then:
```bash
git remote add origin <repo URL>
git push -u origin main
```
Expected: the CI run on GitHub passes.

- [ ] **Step 6: Hosted Supabase (Daksh)**

Create a project named `frontdesk-ai` in the East US (North Virginia) region. Under Authentication, URL Configuration: set the Site URL to the Vercel URL and add `<vercel URL>/**` to the redirect URLs. Paste the two email templates and their subjects. Then run, with his own login and database password:
```bash
npx supabase login
npx supabase link --project-ref <project ref>
npx supabase db push
```
Expected: `db push` applies every migration. Note: until custom SMTP arrives in M3, Supabase's built-in email only reaches the project's team members, so only Daksh's own address receives confirmation emails.

- [ ] **Step 7: Vercel (Daksh)**

Import the repository and set: `DATABASE_URL` (the transaction pooler connection string, port 6543), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the production URL), and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`. Deploy.

- [ ] **Step 8: Smoke-check the deployment in the browser**

The landing page renders; `/dashboard` redirects to `/sign-in?next=%2Fdashboard`; Daksh signs up with his own email, confirms it, and creates a workspace.

- [ ] **Step 9: Google sign-in (optional, Daksh)**

Create a Google Cloud OAuth client (web application) with the redirect URI `https://<project ref>.supabase.co/auth/v1/callback`. Enable the Google provider in Supabase with its client ID and secret, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel, and redeploy.

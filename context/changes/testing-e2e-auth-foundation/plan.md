# Testing E2E Auth Foundation Implementation Plan

## Overview

Bootstrap a root Playwright e2e harness for sendlog and prove the real passwordless auth boundary: anonymous users are redirected from gated pages, the Supabase magic-link → `/auth/confirm` → SSR cookie path establishes a session middleware honors, sign-out clears access, and signed-out mutation APIs return structured JSON `401` (not HTML redirects).

This is Phase 1 of `context/foundation/test-plan.md` §3 — risks #1 (broken login/session/gate) and a slice of #2 (anonymous API denial).

## Current State Analysis

- No test runner exists: `package.json` has no `test` script and no Playwright/Vitest/Jest dependency.
- CI (`.github/workflows/ci.yml`) runs `npm ci` → `astro sync` → `lint` → `guardrails` → `build` only.
- Auth is passwordless and server-owned: `/api/auth/magic-link` → Inbucket email → `/auth/confirm` (`verifyOtp`) → `@supabase/ssr` cookies → `src/middleware.ts` `getUser()` gate on `PROTECTED_ROUTES`.
- Local Supabase is already configured for this flow: `site_url = http://127.0.0.1:3000`, email confirmations off, custom `magic_link.html` template appends `token_hash` and `type=magiclink` to `{{ .RedirectTo }}`, Inbucket on port `54324`.
- HTML protected pages redirect to `/auth/signin?next=...`; mutation APIs (e.g. `POST /api/climbs`) return `{ error: { code, message, context } }` with `401` when unauthenticated.

## Desired End State

A developer with Docker + local Supabase running can execute `npm run test:e2e` and see Chromium specs pass that prove:

1. `/dashboard` redirects anonymous users to sign-in with `next=%2Fdashboard`.
2. Submitting the magic-link form lands on check-email, the real Inbucket email is consumed, `/auth/confirm` establishes session cookies, and `/dashboard` shows the authenticated user.
3. `/historia` or `/projekty` is reachable with the session (no redirect back to sign-in).
4. Sign-out clears the session; revisiting `/dashboard` redirects to sign-in.
5. An unauthenticated `POST /api/climbs` returns JSON `401`, not an HTML redirect.

`context/foundation/test-plan.md` §6.1 is filled with the auth e2e cookbook pattern. CI e2e gate remains deferred until the Inbucket fixture is stable locally.

### Key Discoveries:

- `src/middleware.ts:5-25` — protected-route list and `buildSignInRedirect({ next })` for anonymous HTML access.
- `src/pages/api/auth/magic-link.ts` — OTP request with `emailRedirectTo` pointing at `/auth/confirm`.
- `src/pages/auth/confirm.ts` — `verifyOtp` with `type=magiclink`; this is the session boundary tests must exercise.
- `supabase/templates/magic_link.html:6` — link shape: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink`.
- `src/pages/api/climbs.ts:57-59` — intentional JSON `401` for signed-out API callers.

## What We're NOT Doing

- CI blocking or non-blocking e2e job (deferred per test-plan "local first, CI once stable").
- Cross-user private-state isolation (Phase 2 scope).
- Climb/project CRUD flows, catalog, or map tests (Phases 2–3).
- Unit or integration test runners.
- Multi-browser matrix (Chromium only).
- `role="alert"` / `aria-live` additions to auth error components (deferred; use text/heading selectors).
- Redirect-safety smoke for unsafe `next` (lower priority; `sanitizeNextPath` has lower-level coverage).
- Mocked or admin-API-shortcut auth that replaces the real Inbucket magic-link path.

## Implementation Approach

Four incremental phases: (1) install Playwright and wire `webServer` to the existing Astro dev command, (2) build a deterministic Inbucket polling helper and shared auth fixture, (3) write the auth-gate specs covering core flows + API negative, (4) document the cookbook pattern and local prerequisites.

All authed specs depend on local Supabase (`npx supabase start`) with `.env` / `.dev.vars` populated from `npx supabase status`. Tests assume Inbucket at `http://127.0.0.1:54324` and the app at `http://127.0.0.1:3000`.

## Critical Implementation Details

The Inbucket REST API shape must be verified against the running local stack at implementation time (Supabase CLI bundles a specific Inbucket version). The helper should poll with backoff until the mailbox contains a message whose HTML body includes an `href` matching `/auth/confirm` with `token_hash` and `type=magiclink`. Do not hardcode a single API path without a live smoke check — archived docs reference the web UI at port `54324`, but the helper should use the JSON API (`/api/v1/...`) for automation.

Playwright `webServer` starts only the Astro app — it does **not** start Supabase. Document this prerequisite clearly; a missing Supabase stack surfaces as `missing_config` redirects, not Playwright timeouts.

Session proof requires asserting both visible UI state (dashboard heading, user email, `Wyloguj` button) **and** presence of `sb-*-auth-token` cookies after the confirm redirect.

## Phase 1: Playwright Harness Bootstrap

### Overview

Add `@playwright/test` as a root dev dependency, configure `playwright.config.ts` with a `webServer` targeting `npm run dev -- --host 127.0.0.1 --port 3000`, add npm scripts, gitignore entries, and a minimal smoke spec that proves the harness can reach the app.

### Changes Required:

#### 1. Dependencies and scripts

**File**: `package.json`

**Intent**: Add Playwright as the project's e2e runner with discoverable npm scripts matching the test-plan stack table.

**Contract**: Add `@playwright/test` to `devDependencies`. Add scripts `test:e2e` (`playwright test`) and `test:e2e:ui` (`playwright test --ui`). Do not add CI wiring in this phase.

#### 2. Playwright configuration

**File**: `playwright.config.ts` (new, repo root)

**Intent**: Configure Chromium-only e2e against the local Astro SSR dev server with CI-safe defaults.

**Contract**: `testDir: "tests/e2e"`, `use.baseURL: "http://127.0.0.1:3000"`, `projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]`, `webServer` with `command: "npm run dev -- --host 127.0.0.1 --port 3000"`, `url: "http://127.0.0.1:3000"`, `reuseExistingServer: !process.env.CI`, `timeout: 120_000`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0`, `workers: process.env.CI ? 1 : undefined`, `trace: "on-first-retry"`.

#### 3. Gitignore and directory scaffold

**Files**: `.gitignore`, `tests/e2e/smoke.spec.ts` (new)

**Intent**: Keep Playwright artifacts out of version control and prove the harness reaches a public page before auth fixtures exist.

**Contract**: Gitignore `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`. Smoke spec visits `/` (or `/auth/signin`) and asserts a known heading or link is visible — no Supabase dependency.

### Success Criteria:

#### Automated Verification:

- `npm install` succeeds and `@playwright/test` appears in `package-lock.json`
- `npx playwright install chromium` succeeds
- `npm run lint` passes (new config/spec included)
- `npm run build` passes with existing `SUPABASE_URL` / `SUPABASE_KEY` env vars
- `npm run test:e2e -- tests/e2e/smoke.spec.ts` passes with dev server auto-started (Supabase not required for smoke spec)

#### Manual Verification:

- `playwright.config.ts` `webServer` command matches test-plan §4 guidance (`127.0.0.1:3000`)
- Smoke spec failure produces readable Playwright output (trace on retry configured)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Inbucket Auth Fixture

### Overview

Build reusable test helpers that submit the real magic-link form, poll local Inbucket for the email, extract the `/auth/confirm` URL, and complete sign-in — establishing a browser context with valid Supabase session cookies.

### Changes Required:

#### 1. Test constants

**File**: `tests/e2e/constants.ts` (new)

**Intent**: Centralize deterministic test email, Inbucket base URL, and protected-route paths so specs stay DRY.

**Contract**: Export `E2E_TEST_EMAIL` (e.g. `e2e-auth@example.com`), `INBUCKET_BASE_URL` (`http://127.0.0.1:54324`), `APP_BASE_URL` (`http://127.0.0.1:3000`), and `PROTECTED_ROUTES` mirroring middleware (`/dashboard`, `/historia`, `/projekty`).

#### 2. Inbucket polling helper

**File**: `tests/e2e/helpers/inbucket.ts` (new)

**Intent**: Retrieve the latest magic-link confirm URL from local Inbucket without manual inbox inspection.

**Contract**: Export `waitForMagicLink(email: string, options?: { timeoutMs?: number }): Promise<string>` that polls Inbucket's JSON API until a message for the mailbox exists, parses the HTML/text body for an `http://127.0.0.1:3000/auth/confirm` URL containing `token_hash` and `type=magiclink`, and returns the full URL. Use exponential backoff (e.g. 500ms → 2s) with a default timeout of 30s. Throw a descriptive error if Inbucket is unreachable (suggest `npx supabase start`).

#### 3. Auth flow helper

**File**: `tests/e2e/helpers/auth.ts` (new)

**Intent**: Encapsulate the full passwordless sign-in path so specs focus on assertions, not ceremony.

**Contract**: Export `signInViaMagicLink(page: Page, options?: { email?: string; next?: string }): Promise<void>` that: navigates to `/auth/signin` (with optional `?next=`), fills `getByLabel("Email")`, clicks `getByRole("button", { name: "Wyślij link logowania" })`, waits for `/auth/check-email`, calls `waitForMagicLink`, navigates to the confirm URL, and waits for navigation to complete (landing on `next` or `/dashboard`). Export `assertAuthenticated(page: Page, email: string)` checking dashboard heading `Panel`, visible `Witaj, <email>`, and `Wyloguj` button plus `sb-*-auth-token` cookie presence. Export `signOut(page: Page)` clicking `Wyloguj` and waiting for signed-out state.

#### 4. Helper barrel

**File**: `tests/e2e/helpers/index.ts` (new)

**Intent**: Follow repo module convention with a public export surface for test helpers.

**Contract**: Re-export from `inbucket.ts` and `auth.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on new helper files
- A minimal `tests/e2e/auth-fixture.spec.ts` (can be temporary, merged into Phase 3 specs) passes end-to-end: `signInViaMagicLink` → `assertAuthenticated` → `signOut` when local Supabase + Inbucket are running and `.env` has local credentials

#### Manual Verification:

- Helper error when Supabase is stopped mentions the prerequisite (`npx supabase start`, populate env from `npx supabase status`)
- Retrieved magic-link URL matches the template contract (`token_hash` + `type=magiclink` query params)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Auth Gate E2E Specs

### Overview

Write the durable auth-gate spec suite covering anonymous redirects, session establishment, middleware honoring, sign-out, and signed-out API denial — using the Phase 2 helpers and accessible selectors documented in research.

### Changes Required:

#### 1. Anonymous gate and sign-in request spec

**File**: `tests/e2e/auth-gate.spec.ts` (new)

**Intent**: Prove unauthenticated users cannot reach gated HTML pages and can request a magic link.

**Contract**: Test cases:
- `anonymous user is redirected from /dashboard to sign-in with next` — visit `/dashboard`, assert URL is `/auth/signin?next=%2Fdashboard`, assert heading `Zaloguj się w SendLog`.
- `magic-link form submits and shows check-email` — fill email, submit, assert `/auth/check-email` with heading `Sprawdź swoją skrzynkę`.

Use `test.describe` grouping; unauthenticated tests must not depend on Phase 2 helpers except where noted.

#### 2. Full session lifecycle spec

**File**: `tests/e2e/auth-session.spec.ts` (new)

**Intent**: Prove the real magic-link path establishes a session middleware honors and sign-out clears it.

**Contract**: Serial test group (`test.describe.configure({ mode: "serial" })`) with cases:
- `magic-link confirm establishes session on dashboard` — `signInViaMagicLink` with `next: "/dashboard"`, `assertAuthenticated`.
- `middleware honors session on another gated page` — with established session, navigate to `/historia` (or `/projekty`), assert no redirect to sign-in and page content loads for authenticated user.
- `sign-out clears gated access` — `signOut`, revisit `/dashboard`, assert redirect to `/auth/signin`.

Each authed test uses a fresh browser context or clears cookies in `beforeEach` to avoid cross-test leakage. Prefer `test.beforeEach` cookie clear over shared `storageState` until stability is proven.

#### 3. Signed-out API negative spec

**File**: `tests/e2e/api-auth.spec.ts` (new)

**Intent**: Prove mutation APIs return structured JSON `401` for anonymous callers — preserving the HTML-redirect vs JSON-401 distinction.

**Contract**: Use Playwright `request` fixture (no session cookies). `POST /api/climbs` with minimal JSON body `{ routeId: "test", climbedOn: "2026-01-01" }`. Assert `status === 401`, response `Content-Type` includes `application/json`, body matches `{ error: { code: "unauthenticated", message: string } }` shape (do not assert exact Polish message text if it risks i18n churn — assert `code` and structure).

#### 4. Remove temporary fixture spec

**File**: `tests/e2e/auth-fixture.spec.ts` (if created in Phase 2)

**Intent**: Avoid duplicate coverage once durable specs exist.

**Contract**: Delete or fold into `auth-session.spec.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test:e2e` passes all specs in `tests/e2e/` when local Supabase is running with env configured
- `npm run build` still passes

#### Manual Verification:

- Failing a middleware redirect (e.g. by clearing cookies mid-test) produces a clear Playwright assertion message
- API negative spec does not follow an HTML redirect (response URL stays on `/api/climbs`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cookbook Documentation

### Overview

Fill in `context/foundation/test-plan.md` §6.1 with the auth e2e cookbook pattern and document local prerequisites so future contributors and Phase 2 rollout can add tests consistently.

### Changes Required:

#### 1. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 TBD placeholder with actionable patterns discovered during implementation.

**Contract**: Under `### 6.1 Adding an e2e test for auth and gated pages`, document: prerequisites (`npx supabase start`, copy keys to `.env`/`.dev.vars`, `npx playwright install chromium`), how to run (`npm run test:e2e`), file layout (`tests/e2e/`, `helpers/`), when to use `signInViaMagicLink` vs anonymous `request` fixture, selector conventions (Polish UI strings from research), and the rule that authed HTML tests must prove cookies + middleware, not just form submission.

#### 2. Agent onboarding update

**File**: `AGENTS.md`

**Intent**: Surface the new test commands in the repository guidelines tripwire section so agents discover e2e without reading the test plan.

**Contract**: Add to Build/Test commands: `npm run test:e2e` — Playwright e2e (requires local Supabase + Inbucket). Note CI does not run e2e yet.

#### 3. Environment example annotation

**File**: `.env.example`

**Intent**: Clarify that e2e tests need the same Supabase vars as local dev, sourced from `npx supabase status`.

**Contract**: Add a one-line comment above `SUPABASE_URL` noting e2e auth tests require local Supabase credentials.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (if markdown touched by lint-staged paths)
- `npm run guardrails` passes

#### Manual Verification:

- A new contributor can follow §6.1 alone to run auth e2e tests without reading the full plan
- `AGENTS.md` test command matches `package.json` scripts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### E2E Tests:

- Anonymous HTML gate redirect with `next` preservation
- Magic-link form → check-email → Inbucket → confirm → session cookies
- Middleware honors session on multiple protected routes
- Sign-out clears session and re-gates pages
- Signed-out API returns JSON `401` with structured error

### Manual Testing Steps:

1. Stop Supabase, run `npm run test:e2e` — smoke spec passes, authed specs fail with clear prerequisite message.
2. Start Supabase, run full suite — all specs green.
3. Open Playwright HTML report after an intentional failure — trace is usable.

## Performance Considerations

- Chromium only, single worker locally, serial session tests to avoid Inbucket race on same mailbox.
- Inbucket polling capped at 30s default; tune if local email delivery is slow.
- `reuseExistingServer: true` locally avoids restarting Astro between runs.

## Migration Notes

No database migrations. No production deploy changes. CI unchanged in this phase.

## References

- Research: `context/changes/testing-e2e-auth-foundation/research.md`
- Test plan: `context/foundation/test-plan.md` §3 Phase 1, §4, §5
- Auth middleware: `src/middleware.ts`
- Magic-link handler: `src/pages/api/auth/magic-link.ts`
- Confirm callback: `src/pages/auth/confirm.ts`
- API auth denial: `src/pages/api/climbs.ts`
- Local Supabase config: `supabase/config.toml`, `supabase/templates/magic_link.html`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Playwright Harness Bootstrap

#### Automated

- [x] 1.1 `npm install` succeeds and `@playwright/test` appears in `package-lock.json` — 8c05dba
- [x] 1.2 `npx playwright install chromium` succeeds — 8c05dba
- [x] 1.3 `npm run lint` passes — 8c05dba
- [x] 1.4 `npm run build` passes with existing Supabase env vars — 8c05dba
- [x] 1.5 `npm run test:e2e -- tests/e2e/smoke.spec.ts` passes — 8c05dba

#### Manual

- [x] 1.6 `webServer` command matches test-plan guidance (`127.0.0.1:3000`) — 8c05dba
- [x] 1.7 Smoke spec failure produces readable Playwright output — 8c05dba

### Phase 2: Inbucket Auth Fixture

#### Automated

- [x] 2.1 `npm run lint` passes on new helper files — d1b4bd1
- [x] 2.2 Auth fixture spec passes with local Supabase + Inbucket running — d1b4bd1

#### Manual

- [x] 2.3 Helper error when Supabase is stopped mentions prerequisite — d1b4bd1
- [x] 2.4 Retrieved magic-link URL matches template contract — d1b4bd1

### Phase 3: Auth Gate E2E Specs

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run test:e2e` passes all specs with local Supabase running
- [x] 3.3 `npm run build` still passes

#### Manual

- [x] 3.4 Middleware redirect failure produces clear assertion message
- [x] 3.5 API negative spec does not follow HTML redirect

### Phase 4: Cookbook Documentation

#### Automated

- [ ] 4.1 `npm run guardrails` passes

#### Manual

- [ ] 4.2 New contributor can follow §6.1 to run auth e2e tests
- [ ] 4.3 `AGENTS.md` test command matches `package.json` scripts

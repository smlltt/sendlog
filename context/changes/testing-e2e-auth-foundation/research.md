---
date: 2026-06-09T15:17:49+02:00
researcher: GPT-5.5
git_commit: 4a34f15bb950000e961d137983656f2f63b269ec
branch: feature/tests
repository: sendlog
topic: "testing-e2e-auth-foundation"
tags: [research, codebase, testing, e2e, auth, playwright, supabase]
status: complete
last_updated: 2026-06-09
last_updated_by: GPT-5.5
---

# Research: testing-e2e-auth-foundation

**Date**: 2026-06-09T15:17:49+02:00
**Researcher**: GPT-5.5
**Git Commit**: 4a34f15bb950000e961d137983656f2f63b269ec
**Branch**: feature/tests
**Repository**: sendlog

## Research Question

Research the Phase 1 test rollout change `testing-e2e-auth-foundation`: how to bootstrap the e2e harness, prove real auth session behavior, prove gated pages are actually gated, and identify whether request/API negative checks belong in this foundation.

## Summary

The project has no active test runner today, so Phase 1 should add a minimal root Playwright setup and keep the first scope narrow: anonymous protected-route redirects, the real Supabase magic-link session path, authenticated access to gated pages, sign-out, and one cheap signed-out API negative check.

The live auth flow is passwordless and server-side. `/api/auth/magic-link` sends a Supabase OTP email, `/auth/confirm` verifies `token_hash` with `type=magiclink`, `src/lib/supabase.ts` writes Supabase SSR cookies, and `src/middleware.ts` uses `getUser()` to decide protected-page access. A useful e2e test must prove the middleware honors the resulting cookies; form submission alone is not enough.

The main implementation decision is how tests obtain the real magic link. Local Supabase already has Inbucket and a custom magic-link template configured, so the most faithful local path is: submit the app form, read the email from local Inbucket, follow the real `/auth/confirm` URL, then assert gated access. CI should wait until that fixture is deterministic.

## Detailed Findings

### Existing Test And Runtime Surface

- No Playwright, Vitest, Jest, Cypress, or Mocha setup exists at the app root. `package.json:5-15` only defines `dev`, `build`, `preview`, `lint`, `format`, and guardrail scripts; `package.json:43-64` has no test-runner dependency.
- CI currently runs install, Astro type sync, lint, guardrails, and build, but no test command (`.github/workflows/ci.yml:18-25`). The deploy job repeats install/sync/build before Wrangler deploy (`.github/workflows/ci.yml:37-47`).
- Astro is configured for SSR on Cloudflare (`astro.config.mjs:10-16`), and the local dev command is plain `astro dev` (`package.json:6-8`). Playwright should launch the same app path with `npm run dev -- --host 127.0.0.1 --port 3000`.
- The test plan already assigns Phase 1 to "E2e harness + auth gate" and explicitly plans Playwright with a dev `webServer` on `127.0.0.1:3000` (`context/foundation/test-plan.md:66-82`).
- Quality gates say e2e auth is required only after Phase 1 lands, local first and CI once stable (`context/foundation/test-plan.md:91-103`). The plan also excludes exhaustive browser coverage and unit tests as rollout goals (`context/foundation/test-plan.md:131-139`).

### Auth Flow To Exercise

- `/auth/signin` renders the passwordless `MagicLinkForm`, sanitizes `next`, maps known error codes to localized copy, and passes both into the form (`src/pages/auth/signin.astro:9-14`, `src/pages/auth/signin.astro:28`).
- The sign-in form posts to `/api/auth/magic-link`, includes hidden `next`, and has no password field (`src/components/auth/MagicLinkForm.tsx:41-69`).
- `/auth/signup` redirects to `/auth/signin` while preserving `next`, so e2e should not treat signup as a separate active password flow (`src/pages/auth/signup.astro:4-9`).
- Legacy password API routes still exist but are rollback-only and unlinked (`src/pages/api/auth/signin.ts:4-7`, `src/pages/api/auth/signup.ts:4-7`).
- `/api/auth/magic-link` validates email with zod, sanitizes `next`, builds a same-origin `/auth/confirm?next=...` redirect URL, calls `supabase.auth.signInWithOtp({ shouldCreateUser: true, emailRedirectTo })`, then redirects to `/auth/check-email` (`src/pages/api/auth/magic-link.ts:8-48`).
- `/auth/confirm` requires `token_hash` and `type=magiclink`, verifies via `supabase.auth.verifyOtp`, and redirects to sanitized `next` (`src/pages/auth/confirm.ts:7-30`). The accepted OTP type is centralized in `src/lib/auth/types.ts:38-47`.
- `createClient()` uses `@supabase/ssr` and Astro cookies to read request cookies and write response cookies (`src/lib/supabase.ts:5-23`). This is the session boundary the e2e suite must prove.
- `sanitizeNextPath()` accepts only same-origin path values and rejects absolute URLs, protocol-relative URLs, backslashes, control characters, empty values, and oversized values (`src/lib/auth/redirect.ts:24-45`).

### Protected Routes And API Boundaries

- Middleware creates a request-scoped Supabase client, calls `supabase.auth.getUser()`, sets `context.locals.user`, and redirects anonymous users away from `/dashboard`, `/historia`, `/projekty`, and `/private-state-smoke` (`src/middleware.ts:5-25`).
- `/dashboard` displays the authenticated user's email and a sign-out form (`src/pages/dashboard.astro:24-35`, `src/pages/dashboard.astro:53-60`).
- `/historia` and `/projekty` only read private state after `Astro.locals.user` is not null (`src/pages/historia.astro:38-47`, `src/pages/projekty.astro:41-50`).
- Mutation APIs intentionally are not HTML-redirect gated. They call `createPrivateStateClient(..., context.locals.user)` and return structured `401` JSON when signed out (`src/pages/api/climbs.ts:57-59`, `src/pages/api/climbs.ts:179-185`, `src/pages/api/projects.ts:43-44`, `src/pages/api/projects.ts:140-146`).
- Sign-out is POST-only, calls `supabase.auth.signOut()` through the SSR cookie client, and redirects home (`src/pages/api/auth/signout.ts:6-11`). Sign-out controls exist in both dashboard and the catalog header (`src/pages/dashboard.astro:53-60`, `src/components/catalog/CatalogHeader.astro:34-38`).

### Local Supabase Testability

- Supabase local auth is configured for `http://127.0.0.1:3000`, signup is enabled, email confirmations are off, and a custom magic-link template is configured (`supabase/config.toml:150-156`, `supabase/config.toml:202-209`, `supabase/config.toml:234-241`).
- The magic-link template appends `token_hash` and `type=magiclink` to `{{ .RedirectTo }}`, matching the live callback route (`supabase/templates/magic_link.html:5-8`).
- If Supabase env vars are absent, `createClient()` returns `null` (`src/lib/supabase.ts:5-8`), middleware treats the request as anonymous (`src/middleware.ts:19-26`), and magic-link requests redirect with `missing_config` (`src/pages/api/auth/magic-link.ts:25-28`).
- The archived passwordless config explicitly calls for local Inbucket checks, cookie inspection, protected-route return, expired/reused link recovery, external `next` rejection, and sign-out smoke (`context/archive/2026-06-01-passwordless-auth-flow/supabase-config.md:59-72`, `context/archive/2026-06-01-passwordless-auth-flow/supabase-config.md:117-123`).

### Playwright Harness Shape

- Add `@playwright/test` as a root dev dependency.
- Add `playwright.config.ts` at the repo root with:
  - `webServer.command`: `npm run dev -- --host 127.0.0.1 --port 3000`
  - `webServer.url` and `use.baseURL`: `http://127.0.0.1:3000`
  - `reuseExistingServer: !process.env.CI`
  - `forbidOnly: !!process.env.CI`
  - `retries: process.env.CI ? 2 : 0`
  - `workers: process.env.CI ? 1 : undefined`
  - `trace: "on-first-retry"`
- Start with Chromium only. This aligns with the test plan's explicit decision not to pursue exhaustive browser coverage in the initial rollout (`context/foundation/test-plan.md:136-139`).
- Put specs under `tests/e2e/`. Add a setup/auth helper only after the local Supabase/Inbucket fixture is deterministic.
- Keep CI opt-in until the auth fixture is stable. Once enabled, CI needs browser install and Supabase test env, not just the existing build secrets.

### Robust UI Selectors

- Sign-in heading: `getByRole("heading", { name: "Zaloguj się w SendLog" })` (`src/pages/auth/signin.astro:20-23`).
- Email field: `getByLabel("Email")`, backed by `id="email"` and `name="email"` (`src/components/auth/FormField.tsx:37-45`, `src/components/auth/MagicLinkForm.tsx:45-56`).
- Submit button: `getByRole("button", { name: "Wyślij link logowania" })` (`src/components/auth/MagicLinkForm.tsx:62-68`).
- Pending submit state: button text changes to `Wysyłanie linku...` and is disabled (`src/components/auth/SubmitButton.tsx:25-37`).
- Client validation copy: `Email jest wymagany` and `Podaj prawidłowy adres email` (`src/components/auth/MagicLinkForm.tsx:19-27`). The rendered error paragraph currently has no `role="alert"` (`src/components/auth/FormField.tsx:58-62`).
- Server auth errors: localized copy for `missing_config`, `invalid_email`, `magic_link_failed`, and `invalid_or_expired_link` is in `src/i18n/ui.ts:76-80` and rendered by `src/components/auth/ServerError.tsx:10-14`; it also lacks `role="alert"`.
- Check-email page: heading `Sprawdź swoją skrzynkę` and retry link `Nie dotarł email? Poproś o kolejny link` (`src/pages/auth/check-email.astro:20-28`).
- Dashboard: heading `Panel`, visible `Witaj, <email>`, links `Otwórz historię przejść` / `Otwórz moje projekty`, and sign-out button `Wyloguj` (`src/pages/dashboard.astro:33-58`).
- Catalog header signed-out link: `getByRole("link", { name: "Zaloguj się" })` (`src/components/catalog/CatalogHeader.astro:40-43`).
- Catalog header signed-in state: links `Historia`, `Projekty`, visible email, and `Wyloguj` button (`src/components/catalog/CatalogHeader.astro:25-38`).

## Recommended Phase 1 Coverage

1. **Anonymous gate redirect**: visit `/dashboard` without storage state and assert redirect to `/auth/signin?next=%2Fdashboard`.
2. **Magic-link request**: submit `/auth/signin` with a deterministic local test email and assert `/auth/check-email`.
3. **Real callback and session**: read the local Inbucket email, follow the actual `/auth/confirm?token_hash=...&type=magiclink&next=...` URL, assert landing on `/dashboard`, assert user email and `Wyloguj`, and verify Supabase `sb-*-auth-token` cookies exist.
4. **Middleware honors session**: navigate to `/historia` or `/projekty` with the established session and assert the user is not redirected back to sign-in.
5. **Sign-out clears access**: click `Wyloguj`, assert home page or signed-out header, then revisit `/dashboard` and assert redirect to sign-in.
6. **Signed-out API negative**: make a direct unauthenticated request to one private mutation endpoint and assert structured JSON `401`, not an HTML redirect.
7. **Optional redirect safety smoke**: request a magic link with an unsafe `next` value and assert the app falls back safely. This can be lower priority if lower-level coverage already exists for `sanitizeNextPath()`.

Cross-user private-state isolation is essential, but it is a better fit for Phase 2 unless Phase 1 introduces reusable multi-user auth fixtures at very low additional cost.

## Code References

- `package.json:5-15` - current npm scripts, no test script.
- `.github/workflows/ci.yml:18-25` - current CI quality gate sequence.
- `context/foundation/test-plan.md:66-82` - Phase 1 Playwright intent and webServer guidance.
- `src/pages/api/auth/magic-link.ts:8-48` - magic-link request handler.
- `src/pages/auth/confirm.ts:7-30` - magic-link callback and Supabase OTP verification.
- `src/lib/supabase.ts:5-23` - SSR Supabase cookie client.
- `src/middleware.ts:5-25` - protected-route gate and `context.locals.user`.
- `src/pages/api/climbs.ts:57-59` - signed-out private API denial path.
- `src/pages/api/projects.ts:43-44` - signed-out private projects API denial path.
- `supabase/config.toml:150-156` - local auth site URL.
- `supabase/templates/magic_link.html:5-8` - local magic-link URL template.

## Architecture Insights

The auth boundary is intentionally server-owned. React islands render forms and controls, but Supabase sessions are created and consumed by Astro server routes, API routes, and middleware. E2e tests should therefore use browser-visible behavior plus cookie/session effects rather than importing app internals.

The app has two different unauthenticated behaviors by design: protected HTML pages redirect to sign-in with `next`, while JSON mutation APIs return structured `401` objects. The e2e foundation should preserve that distinction so future private-flow tests can rely on it.

The safest first Playwright design is local-first. A mocked auth shortcut would miss the exact risk the test plan highlights: a user appearing to sign in while middleware still treats them as anonymous. If a shortcut is ever added, it should be a separate explicit test-only path and not replace the real magic-link smoke.

## Historical Context

- `context/archive/2026-06-01-passwordless-auth-flow/plan.md:5-7` - S-03 replaced password auth with the Supabase passwordless flow.
- `context/archive/2026-06-01-passwordless-auth-flow/research.md:14-18` - earlier research identified token-hash magic links and server callback cookies as the auth core.
- `context/archive/2026-06-01-passwordless-auth-flow/plan.md:17-18` - `next` redirect safety was an explicit requirement.
- `context/archive/2026-06-01-passwordless-auth-flow/plan.md:347-356` - historical verification called for real sign-in, protected return, sign-out, and redirect checks.
- `context/archive/2026-05-31-private-user-state-contract/plan.md:27-31` - private state privacy is layered across middleware, app filtering, and RLS.
- `context/archive/2026-05-31-private-user-state-contract/plan.md:61-65` - private state must be scoped by authenticated Supabase user.
- `context/archive/2026-06-03-personal-projects-list/research.md:236-240` - API routes intentionally return JSON auth errors instead of middleware redirects.
- `context/archive/2026-06-01-route-climb-log/plan.md:458-467` - cross-user ownership negatives are required for climb logs.
- `context/archive/2026-06-03-personal-projects-list/plan.md:373-378` - cross-user ownership negatives are required for projects.

## Related Research

- `context/archive/2026-06-01-passwordless-auth-flow/research.md` - passwordless auth implementation research.
- `context/archive/2026-05-31-private-user-state-contract/research.md` - private state and RLS boundary research.
- `context/archive/2026-06-01-route-climb-log/research.md` - logged climb flow and auth-dependent private state research.
- `context/archive/2026-06-03-personal-projects-list/research.md` - projects API/page auth boundary research.
- `context/foundation/test-plan.md` - phased test rollout strategy.

## Open Questions

- What exact local Inbucket API shape should the Playwright helper use in this repository's Supabase CLI version?
- Should Phase 1 add only local `npm run test:e2e`, or also a non-required CI job that can be promoted once Supabase fixture setup is stable?
- Should auth error/status blocks gain `role="alert"` or `aria-live` as part of testability and accessibility, or stay text-only for this phase?

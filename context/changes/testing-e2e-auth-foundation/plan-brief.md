# Testing E2E Auth Foundation — Plan Brief

> Full plan: `context/changes/testing-e2e-auth-foundation/plan.md`
> Research: `context/changes/testing-e2e-auth-foundation/research.md`

## What & Why

Bootstrap Playwright e2e and prove the real passwordless auth boundary works end-to-end: anonymous users are gated, magic-link sign-in establishes Supabase SSR cookies that middleware honors, sign-out clears access, and mutation APIs return JSON `401` (not HTML redirects). This closes test-plan risks #1 and a slice of #2.

## Starting Point

sendlog has no test runner today. Auth is server-owned (magic-link → `/auth/confirm` → cookies → middleware). Local Supabase already ships Inbucket on port `54324` with a custom magic-link template matching the app's callback contract.

## Desired End State

`npm run test:e2e` runs Chromium specs locally that exercise the full auth gate. `context/foundation/test-plan.md` §6.1 documents how to add auth e2e tests. CI e2e gate remains deferred until the fixture is stable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| CI scope | Local-only for now | Ships harness fast; avoids flaky CI before Inbucket fixture is proven | Research / Plan |
| Magic-link retrieval | Poll local Inbucket REST API | Highest fidelity — exercises real email → confirm → cookie path | Research / Plan |
| Browser matrix | Chromium only | Matches test-plan exclusion of exhaustive browser coverage | Research |
| Coverage | Core 5 flows + API 401 negative | Covers risk #1 fully and anonymous API denial for #2 | Research / Plan |
| Auth error a11y | Defer `role="alert"` | Keep phase purely additive; use text selectors | Plan |
| Redirect-safety smoke | Out of scope | Lower priority; `sanitizeNextPath` has lower-level coverage | Research |

## Scope

**In scope:** Playwright install + config, Inbucket auth helper, auth-gate specs (redirect, session, middleware, sign-out, API 401), cookbook §6.1, `AGENTS.md` test command.

**Out of scope:** CI e2e job, cross-user isolation, CRUD/catalog/map tests, unit tests, multi-browser, mocked auth shortcuts.

## Architecture / Approach

Playwright `webServer` starts Astro on `127.0.0.1:3000`; Supabase must be started separately (`npx supabase start`). Tests submit the real magic-link form, poll Inbucket for the confirm URL, navigate it to establish cookies, then assert UI + middleware behavior. API negatives use Playwright's `request` fixture without cookies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Harness bootstrap | Playwright deps, config, smoke spec | `webServer` port/origin mismatch with Supabase `site_url` |
| 2. Inbucket fixture | Polling helper + `signInViaMagicLink` | Inbucket API shape varies by CLI version |
| 3. Auth gate specs | Redirect, session, middleware, sign-out, API 401 | Flaky email polling / shared mailbox races |
| 4. Cookbook docs | §6.1 + AGENTS.md update | Docs drift from actual helper API |

**Prerequisites:** Docker, `npx supabase start`, `.env` populated from `npx supabase status`, Node 22.14.0.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Inbucket JSON API path must be verified live at implementation time.
- Tests require manual Supabase start — Playwright `webServer` does not manage it.
- Same test email reused across serial tests; parallel workers could race on Inbucket mailbox.
- CI promotion is a follow-up change once local runs are consistently green.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally with Supabase running.
- Anonymous `/dashboard` → sign-in redirect with `next` is proven.
- Real magic-link path establishes cookies and unlocks gated pages.
- Sign-out re-gates pages; `POST /api/climbs` unsigned returns JSON `401`.
- §6.1 cookbook lets a new contributor add auth tests without re-reading the plan.

# Private Climber Flows and Isolation Test — Plan Brief

> Full plan: `context/changes/private-climber-flows-isolation/plan.md`
> Research: `context/changes/private-climber-flows-isolation/research.md`

## What & Why

Deliver test-plan Phase 2: prove private climber CRUD persists (climb edit, project add/remove) and per-user data isolation holds — user B cannot read or mutate user A's climbs/projects, and anonymous callers are denied all mutation endpoints. This closes risks #2, #3, and #4 from `context/foundation/test-plan.md` §2.

## Starting Point

Phase 1 shipped Playwright + real magic-link auth (`testing-e2e-auth-foundation`). `seed.spec.ts` covers climb add → reload → delete. Cross-user isolation was explicitly deferred. Private data uses layered privacy: RLS + app `user_id` scoping; non-owned mutations return `not_found`.

## Desired End State

`npm run test:e2e` passes specs for climb edit, project add→list→remove, cross-user API denial (`not_found`), cross-user UI read isolation, and extended anonymous API `401`s. Cookbook §6.2/§6.3 documents how to add private-flow and isolation tests.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Isolation layer | API-routed mutation denial + UI read isolation | Cheapest high-signal path per test-plan Risk #2 guidance | Research / Plan |
| Direct RLS probe | Deferred | App-layer test could pass if RLS alone regressed — documented residual gap | Research / Plan |
| Two-user fixture | Two browser contexts + `E2E_TEST_EMAIL_B` | Parallel sessions; `signInViaMagicLink` already supports email override | Plan |
| CRUD scope | Fill gaps only (edit + projects) | `seed.spec.ts` already covers climb add/delete | Research / Plan |
| Row ID capture | Intercept POST responses during UI setup | UUIDs not in DOM; avoids brittle Strapi `routeId` constants | Plan |
| Anon denial | Extend PATCH/DELETE climbs + POST/DELETE projects | Symmetric coverage beyond Phase 1's single POST | Plan |
| CI | Still local-only | Matches test-plan "local first, CI once stable" | Research |

## Scope

**In scope:** Shared fixture constants, two-user helpers, isolation specs (API + UI read), `climb-edit.spec.ts`, `projects-flow.spec.ts`, extended `api-auth.spec.ts`, cookbook §6.2/§6.3, test-plan §3 Phase 2 link.

**Out of scope:** Direct Supabase RLS probe, `SUPABASE_KEY` guard, CI e2e job, app/schema changes, re-testing climb add/delete, unit tests, multi-browser.

## Architecture / Approach

Reuse Phase 1 harness (`signInViaMagicLink`, Mailpit polling, `workers: 1`). Phase 2 adds `E2E_TEST_EMAIL_B` and dual-context helpers. Isolation specs: user A creates data via real UI (intercept POST for row id), user B attempts forbidden API mutations or visits gated read pages. CRUD specs follow `seed.spec.ts` conventions (role locators, timestamped oracle, self-cleanup, hydration retries).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared fixtures + two-user helpers | Constants, `createAuthenticatedContext`, response-capture helpers | Breaking `seed.spec.ts` during constants refactor |
| 2. Isolation specs | API `not_found` denial + UI read isolation on `/historia`/`/projekty` | Flaky dual-mailbox magic-link races without serial mode |
| 3. CRUD flow specs | Climb edit + project add→list→remove | `client:load` island hydration timing |
| 4. API denial + cookbook | Extended anon `401`s, §6.2/§6.3 documentation | Docs drift from actual helper API |

**Prerequisites:** Docker, `npx supabase start`, `.env` from `npx supabase status`, local Strapi catalog with seeded crag/route (`/regiony/rzedkowice/mala-gran`, route `test route`), Node 22.14.0.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- API-routed isolation tests do not prove RLS in isolation — an app-only regression in RLS with intact app scoping would not be caught.
- Strapi catalog must contain the fixture crag/route; missing catalog fails CRUD specs with UI errors, not Playwright timeouts.
- Two magic-link round-trips per isolation spec; serial execution keeps Mailpit mailboxes clean.
- Production RLS parity assumed (per `lessons.md`); tests run against local Supabase only.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally with Supabase + Strapi running.
- User B cannot mutate user A's climbs/projects (API `not_found`) or see A's rows on gated pages.
- Climb edit and project flows persist across reload.
- Anonymous mutation on both private endpoints returns JSON `401`.
- §6.2/§6.3 let a contributor add tests without re-reading the full plan.

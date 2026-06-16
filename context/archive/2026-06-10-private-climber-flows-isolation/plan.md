# Private Climber Flows and Isolation Test Implementation Plan

## Overview

Deliver Phase 2 of `context/foundation/test-plan.md` §3: prove private climber CRUD persists correctly (climb edit, project add/remove) and that per-user data isolation holds — user B cannot read or mutate user A's climbs/projects, and anonymous callers are denied all mutation endpoints.

This builds on the Phase 1 Playwright harness (`testing-e2e-auth-foundation`): real magic-link auth, `tests/e2e/helpers/`, and the `seed.spec.ts` exemplar. No application or schema changes — tests and documentation only.

## Current State Analysis

- **Phase 1 harness is live.** `@playwright/test` configured in `playwright.config.ts` with `webServer` on `127.0.0.1:3000`, `workers: 1`, Chromium only. Auth helpers (`signInViaMagicLink`, `assertAuthenticated`, `signOut`) poll Mailpit on port `54324`.
- **One user constant today.** `tests/e2e/constants.ts` exports `E2E_TEST_EMAIL = "e2e-auth@example.com"`. `signInViaMagicLink` already accepts an `email` override.
- **Partial CRUD coverage.** `seed.spec.ts` proves climb add → `/historia` persistence after reload → delete (Risk #3 slice). Gaps: climb **edit** (`PATCH /api/climbs`), project **add** (crag-row `ProjectAction` → `POST /api/projects`), project **list** (`/projekty`), project **remove** (`DELETE /api/projects`).
- **Isolation deferred from Phase 1.** `testing-e2e-auth-foundation` proved anonymous `POST /api/climbs` → JSON `401` only. Cross-user denial was explicitly out of scope.
- **Two-layer privacy model** (research): RLS (`auth.uid() = user_id` on `climbs`/`projects`) plus app-level `.eq("user_id", client.userId)` scoping. Non-owned mutations collapse to `not_found` (404) — never leak ownership. No read API; SSR pages use scoped helpers.
- **Cookbook gaps.** `test-plan.md` §6.2 and §6.3 are still `TBD`. §3 Phase 2 row has no change folder.

### Key Discoveries:

- `supabase/migrations/20260531172510_private_user_state.sql:72-125` — RLS on both tables, `authenticated`-only, per-operation `auth.uid() = user_id`.
- `src/lib/private-state/client.ts:30-44` — `createPrivateStateClient` throws `unauthenticated` without a resolved user.
- `src/pages/api/climbs.ts:210-261` / `src/pages/api/projects.ts:167-217` — PATCH/DELETE scoped by `id` + `user_id`; other-user rows → `not_found`.
- `src/components/climbs/HistoryClimbCard.tsx:249-297` — edit flow via `ClimbLogForm mode="edit"`; buttons `Edytuj`, `Zapisz zmiany`.
- `src/components/projects/ProjectAction.tsx:57-100` — crag-row add via `Dodaj do projektów`; on-list state `W projektach`.
- `src/components/projects/ProjectsListCard.tsx:224-262` — `/projekty` remove with two-step confirm matching history delete pattern.
- `tests/e2e/seed.spec.ts:30-32` — seeded catalog fixture: `/regiony/rzedkowice/mala-gran`, route name `test route`.

## Desired End State

A developer with Docker, local Supabase, and a seeded Strapi catalog can run `npm run test:e2e` and see specs pass that prove:

1. **Climb edit persists** — a logged climb's note can be edited on `/historia`, survives reload.
2. **Project add/remove persists** — a route added via crag-row toggle appears on `/projekty` after reload and can be removed.
3. **Cross-user mutation denial** — user B's authenticated `PATCH`/`DELETE` against user A's climb/project row IDs returns `404` with `error.code: "not_found"` (not a success or ownership leak).
4. **Cross-user read isolation** — user B's `/historia` and `/projekty` do not render rows created by user A.
5. **Anonymous mutation denial** — unauthenticated `PATCH`/`DELETE /api/climbs` and `POST`/`DELETE /api/projects` return JSON `401`.
6. **Cookbook filled** — `test-plan.md` §6.2, §6.3 document how to add private-flow and isolation tests.

## What We're NOT Doing

- Direct Supabase/RLS probe with `supabase-js` bypassing the app (deferred — API-routed denial is cheaper and matches the test-plan's "request/API-level negative checks" guidance; an RLS-only regression where app scoping still passes is a known residual gap documented in Open Risks).
- `SUPABASE_KEY` anon-vs-service-role guard (research open question — no production code change in this phase).
- CI e2e job (still "local first, CI once stable" per test-plan §5).
- Re-testing climb add/delete already covered by `seed.spec.ts`.
- Unit or integration test runners.
- Multi-browser matrix.
- Mocked auth shortcuts — all authed specs use `signInViaMagicLink`.

## Implementation Approach

Four incremental phases: (1) lift shared fixture constants and add a two-user helper surface, (2) write cross-user isolation specs (API mutation denial + UI read isolation), (3) write the remaining CRUD flow specs (climb edit, project add→list→remove), (4) extend anonymous API denial and fill cookbook §6.2/§6.3.

**Default decisions** (user skipped structured questions; grounded in research + test-plan Risk Response Guidance):

| Decision | Choice | Rationale |
| --- | --- | --- |
| Isolation layer | API-routed mutation denial + UI read isolation | Cheapest signal per test-plan §2 Risk #2; exercises real session cookies through app endpoints |
| Two-user fixture | Two browser contexts + `E2E_TEST_EMAIL_B` | Parallel sessions without sign-in/out churn; `signInViaMagicLink` already supports email override |
| CRUD scope | Fill gaps only (edit + projects) | `seed.spec.ts` already covers climb add/delete |
| Anon denial | Extend all four mutation verbs | Symmetric coverage of both private endpoints |
| Docs | Full §6.2 + §6.3 + test-plan §3 status | Phase 2 deliverable includes cookbook patterns |

All specs depend on: `npx supabase start`, `.env`/`.dev.vars` from `npx supabase status`, local Strapi catalog with the seeded crag/route from `seed.spec.ts`, and `workers: 1` (serial mailbox + shared DB state).

## Critical Implementation Details

Capture row IDs from **POST response interception** (`page.waitForResponse` on `POST /api/climbs` or `POST /api/projects`) after UI creation — climb/project UUIDs are not exposed in the visible DOM, and hardcoding Strapi `routeId` document IDs is brittle. The isolation setup creates data as user A via the real UI path, captures the returned `id`, then user B attempts forbidden mutations.

Isolation specs must run **serial** (`test.describe.configure({ mode: "serial" })`) and clean up user A's rows in `afterAll` so re-runs start clean. Use distinct timestamped notes/oracles per run (convention from `seed.spec.ts`).

Two-user magic-link sign-in requires **separate Mailpit mailbox clears** per email (`clearMailbox` before each `signInViaMagicLink` call) to avoid cross-user link confusion.

## Phase 1: Shared Fixtures and Two-User Helpers

### Overview

Centralize catalog fixture constants, add a second test user email, and expose helpers for dual-context auth and API response capture — the foundation isolation and CRUD specs share.

### Changes Required:

#### 1. Extend test constants

**File**: `tests/e2e/constants.ts`

**Intent**: DRY the seeded catalog fixture and introduce a second deterministic mailbox for user B.

**Contract**: Export `E2E_TEST_EMAIL_B` (e.g. `e2e-isolation-b@example.com`), `FIXTURE_CRAG_PATH` (`/regiony/rzedkowice/mala-gran`), `FIXTURE_ROUTE_NAME` (`test route`). Keep existing exports unchanged. Update `seed.spec.ts` to import these from `constants.ts` instead of local duplicates.

#### 2. Dual-context auth helper

**File**: `tests/e2e/helpers/auth.ts`

**Intent**: Let isolation specs sign in two users without duplicating context lifecycle boilerplate.

**Contract**: Export `createAuthenticatedContext(browser, options?: { email?: string })` returning `{ context, page }` with cookies cleared and `signInViaMagicLink` completed. Export `getAuthenticatedRequest(page)` returning `page.request` (inherits session cookies). Re-export from `tests/e2e/helpers/index.ts`.

#### 3. Response-capture helper

**File**: `tests/e2e/helpers/private-state.ts` (new)

**Intent**: Capture climb/project row IDs from mutation responses during UI setup without hardcoding Strapi document IDs.

**Contract**: Export `waitForClimbCreated(page): Promise<string>` — wraps `page.waitForResponse` for `POST /api/climbs` with `status === 201`, parses `{ climb: { id } }`, returns UUID. Export `waitForProjectCreated(page): Promise<string>` — same pattern for `POST /api/projects` → `{ project: { id } }`. Export `deleteClimbViaApi(page, id)` and `deleteProjectViaApi(page, id)` for cleanup. Barrel-export from `helpers/index.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on new/changed helper files
- `npm run test:e2e -- tests/e2e/seed.spec.ts` still passes (constants refactor did not break exemplar)

#### Manual Verification:

- `E2E_TEST_EMAIL_B` is a distinct mailbox from `E2E_TEST_EMAIL` — both receive magic links independently when signed in sequentially

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Cross-User Isolation Specs

### Overview

Prove Risk #2: user B cannot mutate user A's private rows (API `not_found`) and cannot see user A's data on gated read pages.

### Changes Required:

#### 1. Cross-user mutation denial — climbs

**File**: `tests/e2e/isolation-climbs.spec.ts` (new)

**Intent**: Prove `PATCH` and `DELETE /api/climbs` with another user's row id returns `not_found`, not success.

**Contract**: Serial describe. Setup: create authenticated context A and B. User A signs in, logs a climb on the fixture crag (UI, intercept `waitForClimbCreated`), captures `climbId`. User B signs in. Test cases:
- `user B cannot PATCH user A climb` — `pageB.request.patch("/api/climbs", { data: { id: climbId, climbedOn: "2020-01-01", note: "stolen" } })` → `404`, `error.code === "not_found"`.
- `user B cannot DELETE user A climb` — `pageB.request.delete("/api/climbs", { data: { id: climbId } })` → `404`, `error.code === "not_found"`.
Cleanup: user A deletes the climb via `deleteClimbViaApi`. Assert response `Content-Type` is JSON on all denial cases.

#### 2. Cross-user mutation denial — projects

**File**: `tests/e2e/isolation-projects.spec.ts` (new)

**Intent**: Prove `DELETE /api/projects` with another user's project id returns `not_found`.

**Contract**: Serial describe. User A adds fixture route to projects via crag-row `Dodaj do projektów` (intercept `waitForProjectCreated`), captures `projectId`. User B attempts `DELETE /api/projects` with `{ id: projectId }` → `404`, `error.code === "not_found"`. User A cleans up via `deleteProjectViaApi`. Note: there is no project PATCH endpoint — mutation denial is DELETE-only for projects.

#### 3. Cross-user UI read isolation

**File**: `tests/e2e/isolation-read.spec.ts` (new)

**Intent**: Prove gated SSR pages scoped to the current user do not render another user's rows.

**Contract**: Serial describe. User A creates a climb with a unique timestamped note and a project on the fixture route (UI). User B signs in, visits `/historia` — assert no `listitem` contains A's note. User B visits `/projekty` — assert no row heading matches `FIXTURE_ROUTE_NAME` (or the route is absent from the list). Cleanup as user A. Test names reference Risk #2 explicitly.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test:e2e -- tests/e2e/isolation-climbs.spec.ts tests/e2e/isolation-projects.spec.ts tests/e2e/isolation-read.spec.ts` passes with local Supabase + Strapi catalog running
- `npm run build` passes

#### Manual Verification:

- A failing isolation test produces an assertion that names which user/action leaked (not a generic timeout)
- User A's data is visible on A's `/historia` after setup (sanity — proves setup worked before B's denial)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Private Climber CRUD Flow Specs

### Overview

Fill the remaining Risk #3 and #4 e2e gaps: climb edit persistence and project add→list→remove persistence. Follow `seed.spec.ts` conventions exactly.

### Changes Required:

#### 1. Climb edit flow

**File**: `tests/e2e/climb-edit.spec.ts` (new)

**Intent**: Prove a climb's note can be edited on `/historia` and survives reload (Risk #3 edit path).

**Contract**: Sign in as `E2E_TEST_EMAIL`, land on fixture crag, log a climb with initial note `edit-before-${Date.now()}`. Navigate to `/historia`, locate row by initial note. Click `Edytuj`, change note field (`getByLabel("Notatka (opcjonalnie)")`) to `edit-after-${Date.now()}`, click `Zapisz zmiany`. Assert success notice `Zmiany zostały zapisane.`. Reload page — assert updated note visible, initial note absent. Cleanup via two-step delete (same pattern as `seed.spec.ts`). Use `expect(async () => …).toPass()` for `client:load` island hydration on edit open.

#### 2. Project add and remove flow

**File**: `tests/e2e/projects-flow.spec.ts` (new)

**Intent**: Prove project add via crag toggle persists to `/projekty` and can be removed (Risk #4).

**Contract**: Sign in, visit fixture crag. Locate fixture route row. If already on-list (`W projektach`), remove first via inline confirm so test starts from off-list. Click `Dodaj do projektów`, assert `Dodano do projektów.` and `W projektach` indicator. Navigate to `/projekty`, assert row with `FIXTURE_ROUTE_NAME` heading visible. Reload — row still present. Two-step remove on `/projekty` (`Usunąć z projektów?` → `Usuń`), assert `Usunięto z projektów.` and row count 0 for that route. Use hydration retry pattern for `ProjectAction` and `ProjectsListCard` islands.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run test:e2e -- tests/e2e/climb-edit.spec.ts tests/e2e/projects-flow.spec.ts` passes
- Full suite `npm run test:e2e` passes (all phases' specs green together)

#### Manual Verification:

- Edit spec failure on reload would indicate PATCH did not persist (the control question for Risk #3 edit)
- Project spec failure after reload would indicate POST did not persist (Risk #4)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Extended API Denial and Cookbook

### Overview

Extend anonymous mutation denial beyond Phase 1's single `POST /api/climbs` check, and fill test-plan cookbook §6.2/§6.3 so future contributors can add private-flow and isolation tests consistently.

### Changes Required:

#### 1. Extended anonymous API denial

**File**: `tests/e2e/api-auth.spec.ts`

**Intent**: Prove all private mutation verbs return JSON `401` when unauthenticated — symmetric coverage of both endpoints.

**Contract**: Add test cases using Playwright `request` fixture (no cookies):
- `PATCH /api/climbs` with `{ id: "00000000-0000-4000-8000-000000000001", climbedOn: "2026-01-01" }` → `401`, structured `{ error: { code: "unauthenticated" } }`.
- `DELETE /api/climbs` with `{ id: "00000000-0000-4000-8000-000000000001" }` → `401`.
- `POST /api/projects` with `{ routeId: "test" }` → `401`.
- `DELETE /api/projects` with `{ id: "00000000-0000-4000-8000-000000000001" }` → `401`.
Keep existing `POST /api/climbs` test. Assert `Content-Type` includes `application/json` and response URL stays on the API path (no HTML redirect).

#### 2. Test plan cookbook — private climber flows

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.2 TBD with actionable patterns from Phase 3.

**Contract**: Under `### 6.2 Adding an e2e test for private climber flows`, document: prerequisites (Supabase + Strapi catalog fixture), shared constants (`FIXTURE_CRAG_PATH`, `FIXTURE_ROUTE_NAME`), `signInViaMagicLink` with `next` pointing at fixture crag, hydration retry for `client:load` islands, timestamped oracle + cleanup convention (reference `seed.spec.ts`), climb edit selectors (`Edytuj`, `Zapisz zmiany`), project selectors (`Dodaj do projektów`, `/projekty` heading assertions).

#### 3. Test plan cookbook — isolation tests

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.3 TBD with the two-user isolation pattern.

**Contract**: Under `### 6.3 Adding a user-isolation or authorization test`, document: `E2E_TEST_EMAIL` + `E2E_TEST_EMAIL_B`, `createAuthenticatedContext` for dual sessions, `waitForClimbCreated`/`waitForProjectCreated` for ID capture, API `not_found` assertion contract, UI read-isolation on `/historia` + `/projekty`, serial execution requirement, cleanup obligation.

#### 4. Test plan phase status

**File**: `context/foundation/test-plan.md`

**Intent**: Link Phase 2 rollout row to this change folder.

**Contract**: Update §3 Phase 2 row: `Change folder` → `context/changes/private-climber-flows-isolation/`, `Status` → `planned` (or `implementing` once work starts). Add §6.5 note summarizing two-user fixture constraint if helpful.

#### 5. Agent onboarding

**File**: `AGENTS.md`

**Intent**: Surface two-user e2e prerequisite if not already documented.

**Contract**: Under test commands, note that isolation specs require two distinct test mailboxes and serial workers. Only add if Phase 1's `test:e2e` entry does not already mention Strapi catalog prerequisite for `seed.spec.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run guardrails` passes
- `npm run test:e2e` passes full suite with local Supabase + Strapi running

#### Manual Verification:

- A new contributor can follow §6.2 alone to add a climb-flow test without re-reading this plan
- §6.3 explains when to use API denial vs UI read-isolation checks

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### E2E Tests:

- Climb edit persists after reload (`climb-edit.spec.ts`)
- Project add → `/projekty` → reload → remove (`projects-flow.spec.ts`)
- User B `PATCH`/`DELETE` climb owned by A → `not_found` (`isolation-climbs.spec.ts`)
- User B `DELETE` project owned by A → `not_found` (`isolation-projects.spec.ts`)
- User B `/historia` and `/projekty` do not show A's rows (`isolation-read.spec.ts`)
- Anonymous `PATCH`/`DELETE /api/climbs`, `POST`/`DELETE /api/projects` → `401` (`api-auth.spec.ts` extension)
- Existing: climb add/delete (`seed.spec.ts`), auth gate (`auth-*.spec.ts`)

### Manual Testing Steps:

1. Stop Supabase — isolation specs fail with clear Mailpit prerequisite message; smoke spec still passes.
2. Start Supabase + Strapi — full `npm run test:e2e` green.
3. Intentionally break RLS in a local branch (e.g. drop one policy) — API isolation specs should still pass (documents the app-layer vs RLS residual gap); note in test output/README if observed.

## Performance Considerations

- `workers: 1` already configured — required for Mailpit mailbox isolation and shared DB cleanup ordering.
- Isolation + CRUD specs add ~4–6 magic-link round-trips per run; acceptable for local dev gate.
- Serial describe blocks within isolation files prevent concurrent dual-user mailbox races.

## Migration Notes

No database migrations. No production deploy changes. CI unchanged (e2e remains local-only).

## References

- Research: `context/changes/private-climber-flows-isolation/research.md`
- Test plan: `context/foundation/test-plan.md` §2 Risk #2–#4, §3 Phase 2, §6.2–§6.3
- Phase 1 plan: `context/changes/testing-e2e-auth-foundation/plan.md`
- RLS migration: `supabase/migrations/20260531172510_private_user_state.sql`
- Private-state client: `src/lib/private-state/client.ts`
- Climbs API: `src/pages/api/climbs.ts`
- Projects API: `src/pages/api/projects.ts`
- E2E exemplar: `tests/e2e/seed.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared Fixtures and Two-User Helpers

#### Automated

- [x] 1.1 `npm run lint` passes on new/changed helper files
- [x] 1.2 `npm run test:e2e -- tests/e2e/seed.spec.ts` still passes after constants refactor

#### Manual

- [x] 1.3 `E2E_TEST_EMAIL_B` receives magic links independently from `E2E_TEST_EMAIL`

### Phase 2: Cross-User Isolation Specs

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 Isolation specs pass with local Supabase + Strapi catalog running
- [x] 2.3 `npm run build` passes

#### Manual

- [x] 2.4 Isolation failure messages name the leaking user/action
- [x] 2.5 User A sanity check — A's data visible on A's `/historia` after setup

### Phase 3: Private Climber CRUD Flow Specs

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `climb-edit.spec.ts` and `projects-flow.spec.ts` pass
- [x] 3.3 Full `npm run test:e2e` suite passes

#### Manual

- [x] 3.4 Edit spec reload failure would indicate PATCH non-persistence
- [x] 3.5 Project spec reload failure would indicate POST non-persistence

### Phase 4: Extended API Denial and Cookbook

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run guardrails` passes
- [x] 4.3 Full `npm run test:e2e` passes

#### Manual

- [x] 4.4 Contributor can follow §6.2 to add a climb-flow test
- [x] 4.5 §6.3 explains API denial vs UI read-isolation tradeoff

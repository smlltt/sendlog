# Route Climb Log Implementation Plan

## Overview

Ship S-04, the roadmap's north-star slice: a signed-in climber can open an existing crag route page, log a climb inline for a specific canonical route, see that route update with a saved/count/latest-date indicator, and review all logged climbs on a protected `/historia` page ordered newest-first.

The plan builds on the shipped catalog, passwordless auth, core-flow guardrails, and the private-state foundation. It keeps the public catalog public, adds authenticated private-state behavior only where needed, and leaves delete/edit/project behavior for later roadmap slices.

## Current State Analysis

The route-view and private-state foundations are already in place. `src/pages/regiony/[region]/[crag].astro` loads a crag plus its routes and passes them into `src/components/catalog/RoutesTable.astro`. Each route carries `CatalogRoute.id`, the Strapi `documentId` that F-01 and F-02 define as the only canonical route reference for private state.

Supabase already has `public.climbs` with `route_id`, `climbed_on`, optional `note`, per-user RLS policies, and indexes for both history ordering and per-route lookups. `@/lib/private-state` exports `createPrivateStateClient`, `createClimb`, `listClimbs`, and `listClimbsByRoute`; S-04 should consume that module rather than issuing raw Supabase calls from pages or React components.

The main missing pieces are the S-04 UI/API layer, a stable UTC date helper required by repo rules, the protected history page, and guardrail/checklist updates that make the beta flow verifiable.

## Desired End State

After this plan lands:

- Signed-out users still browse crag route pages publicly and see a page-level Polish prompt explaining they can sign in to track routes.
- Signed-in users see inline route-row controls for logging a climb. The form defaults the date to today in UTC, accepts an optional free-text note, uses progress feedback while saving, and stays on the route page after success.
- A saved route row shows an inline success state plus an indicator with the user's logged-climb count and latest climb date. Multiple logs for the same route are allowed.
- `/historia` is protected by middleware and lists the current user's climbs newest-first, showing route name, crag context, grade, date, optional note, and a link back to the crag page where the route lives.
- `/dashboard` becomes a lightweight protected entry point linking to `/historia`.
- `npm run guardrails`, `npm run lint`, and `npm run build` pass; the beta-flow checklist includes the new route-log and history paths.

### Key Discoveries:

- `src/components/catalog/RoutesTable.astro` currently renders a four-column, mobile-card route table; S-04 must preserve that no-horizontal-scroll layout when adding signed-in actions.
- `src/lib/private-state/climbs.ts` already supports `createClimb`, `listClimbs`, and `listClimbsByRoute`; the UI/API layer does not need a new Supabase abstraction.
- `supabase/migrations/20260531172510_private_user_state.sql` intentionally allows multiple climb rows per `(user_id, route_id)`, so S-04 should support repeat ascents rather than enforcing one row per route.
- `src/middleware.ts` currently protects only `/dashboard` and `/private-state-smoke`; `/historia` must be added to the protected route list.
- `docs/verification/progress-feedback-actions.md` already has planned S-04 rows for `src/components/climbs/ClimbLogForm.tsx` and `/historia`, so this slice should flip those rows to `shipped`.
- The repo rule requires UTC date handling via a `formatDate()` helper, but no such helper exists yet. S-04 must add it before defaulting or displaying climb dates.

## What We're NOT Doing

- S-05 delete climb log UI or API. Mistake correction remains delete-and-relog in product terms, but the delete UI ships in the next slice.
- Edit climb log UI. V1 correction remains delete-and-relog, not edit-in-place.
- Projects list behavior or auto-removing a route from projects when logged.
- Stats, charts, totals, streaks, grade progression, or analytics.
- Per-route detail pages. Routes remain rows within `/regiony/[region]/[crag]`.
- Public profiles, shared histories, social feeds, or any cross-user visibility.
- A test runner setup. This repo still verifies through Astro sync, lint, guardrails, build, and manual smoke.
- A broad dashboard redesign beyond making `/dashboard` a useful protected entry point to history.

## Implementation Approach

Keep the crag route page public and server-rendered. When `Astro.locals.user` is present, the page creates a request-scoped `PrivateStateClient`, reads the user's climbs once, groups them by `routeId`, and passes small per-route summaries into the route table. When no user is present, it skips private-state reads and renders a page-level sign-in CTA with a safe `next` back to the current crag URL.

Mutations go through a narrow authenticated JSON API route. The React island owns only form state, validation, pending state, and inline success/error rendering; it never imports `@/lib/private-state`. The API route validates input with zod, builds the server-only private-state client from request headers/cookies and `Astro.locals.user`, calls `createClimb`, and maps `PrivateStateError` into the required structured `{ error: { code, message, context } }` response shape.

History is a protected Astro page backed by `listClimbs`. It uses the hydrated `route` field to render route/crag context and links back to the relevant crag page. Orphan rows stay dropped by default in S-04; showing orphaned historical rows is deferred until there is a real user-facing recovery requirement.

## Critical Implementation Details

### Public Route Page, Private Writes

The crag page remains public. Do not add `/regiony` routes to `PROTECTED_ROUTES`; that would violate the PRD guardrail that catalog browsing remains unauthenticated. Only the save API and `/historia` are authenticated surfaces. Signed-out route pages show a single page-level sign-in CTA, not per-row sign-in actions.

### Server-Only Boundary

`@/lib/private-state` must only be imported from Astro pages and API routes. React islands receive primitive props such as `routeId`, `initialSummary`, and translated strings, then call the S-04 API route for saves. This preserves the server-only Supabase/catalag-token boundary documented in `src/lib/private-state/index.ts`.

### Multiple Logs

Multiple climbs for one route are valid. Route-row indicators should summarize the current user's existing rows for that `routeId`, ideally with count and latest climb date. Do not add a uniqueness constraint or client-side block against repeat ascents.

### Date Handling

Add and use a UTC `formatDate()` helper before introducing climb-date defaults or display formatting. The S-04 contract should treat `climbedOn` as a `YYYY-MM-DD` UTC date string matching the Supabase `date` column, with no direct `new Date().toISOString()` calls in UI or server code.

## Phase 1: Private-State Preflight

### Overview

Verify the F-02 private-state behavior S-04 relies on before building visible UI. This phase does not add product functionality; it closes risk from remaining unchecked manual F-02 items.

### Changes Required:

#### 1. Review F-02 progress and smoke path

**File**: `context/changes/private-user-state-contract/plan.md`

**Intent**: Identify which F-02 progress items are still unchecked and confirm which ones matter for S-04's save, read, and privacy behavior.

**Contract**: Treat unchecked items around unauthenticated client rejection, unknown-route rejection, duplicate/orphan handling, and orphan cleanup as preflight verification targets. Do not change F-02 scope or archive status from this plan.

#### 2. Exercise private-state helper failure modes

**Files**: `src/lib/private-state/client.ts`, `src/lib/private-state/climbs.ts`, `src/pages/private-state-smoke.astro`

**Intent**: Prove the helper behavior S-04 will depend on before wiring user-facing UI to it.

**Contract**: Verify that `createPrivateStateClient(headers, cookies, null)` throws `PrivateStateError("unauthenticated")`, `createClimb` rejects an unknown `routeId` with `unknown_route`, and `listClimbs` default orphan handling does not surface rows whose catalog route is missing. Use the existing smoke page and local Supabase/Strapi setup rather than creating new product UI.

#### 3. Record preflight outcome

**File**: `context/changes/route-climb-log/change.md`

**Intent**: Leave a concise note that S-04 implementation was started with private-state preflight complete or blocked.

**Contract**: Add a short note under `## Notes` summarizing the preflight result and any blockers. If a blocker appears, stop before Phase 2 and fix or re-plan the private-state foundation first.

### Success Criteria:

#### Automated Verification:

- Astro types still regenerate after any preflight notes or supporting edits: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails still pass: `npm run guardrails`
- Production build still passes: `npm run build`

#### Manual Verification:

- `createPrivateStateClient(headers, cookies, null)` behavior is verified as `unauthenticated`.
- Unknown route write behavior is verified as `PrivateStateError("unknown_route")`.
- Default `listClimbs` orphan behavior is verified as dropping orphaned rows.
- Preflight result is recorded in `context/changes/route-climb-log/change.md`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Save API + Route-Page State

### Overview

Add the authenticated save path and the route-page UI for logging climbs inline: UTC date helper, JSON API, signed-in route summaries, page-level signed-out CTA, and a React form island that updates the row after save.

### Changes Required:

#### 1. UTC date helper module

**Files**: `src/lib/date/index.ts`, `src/lib/date/types.ts`, `src/lib/date/__tests__/README.md`

**Intent**: Provide the repo-required `formatDate()` helper before S-04 needs default date values or date display.

**Contract**: Export `formatDate(input: Date | string | number): string`, returning a UTC `YYYY-MM-DD` date string suitable for the `climbed_on date` column and HTML date inputs. The helper must avoid ad hoc call-site formatting and document future coverage for timezone boundary cases. `types.ts` can export the accepted input type alias if useful; `__tests__/README.md` records expected future tests because no runner exists.

#### 2. Climb save API route

**File**: `src/pages/api/climbs.ts`

**Intent**: Provide one authenticated JSON mutation endpoint for the inline route-row form.

**Contract**: Export `const prerender = false` and `POST`. Accept JSON with `{ routeId: string; climbedOn: string; note?: string | null }`; validate with zod, including a strict `YYYY-MM-DD` date string. Build a `PrivateStateClient` from `context.request.headers`, `context.cookies`, and `context.locals.user`, call `createClimb`, and return `201` with `{ climb }` on success. Map validation and `PrivateStateError` failures to structured JSON only:

```ts
{ error: { code, message, context } }
```

Use Polish user-facing messages and avoid leaking server secrets or raw Supabase errors in `message`.

#### 3. Climb UI types and form island

**Files**: `src/components/climbs/ClimbLogForm.tsx`, `src/components/climbs/types.ts`, `src/components/climbs/index.ts`, `src/components/climbs/__tests__/README.md`

**Intent**: Add the client-side inline form used inside a signed-in route row, without importing server-only private-state code.

**Contract**: `ClimbLogForm` accepts `routeId`, `defaultClimbedOn`, current summary values, and translated labels/messages as props or via `getTranslations()`. It renders a date input, optional note textarea, and `SubmitButton`; it posts to `/api/climbs` with JSON, shows pending state during the request, and calls back with the returned climb so the row summary updates immediately. The component must import `SubmitButton` so the progress guard can enforce the S-04 row in `docs/verification/progress-feedback-actions.md`.

#### 4. Route action component

**File**: `src/components/climbs/RouteClimbAction.tsx`

**Intent**: Encapsulate the per-route signed-in state: collapsed indicator, expandable inline form, success message, and summary update after save.

**Contract**: Accept a route id and initial summary `{ count: number; latestClimbedOn: string | null }`. When `count > 0`, render a Polish logged indicator with count and latest date. The action expands `ClimbLogForm` inline for a new save. After save, increment the count and update `latestClimbedOn` without navigating away.

#### 5. Extend route table props

**File**: `src/components/catalog/RoutesTable.astro`

**Intent**: Add signed-in climb actions to each route row while preserving the current public table and mobile card layout.

**Contract**: Extend props with optional `climbSummariesByRouteId` and an `isSignedIn` flag. When signed in, add an action cell/column that renders `RouteClimbAction` as a React island for each route. When signed out, keep the route rows read-only; do not render per-row sign-in CTAs. All visible strings come from `src/i18n/ui.ts`.

#### 6. Load route summaries and signed-out CTA on crag page

**File**: `src/pages/regiony/[region]/[crag].astro`

**Intent**: Make the route page aware of the current user's existing climbs without changing its public accessibility.

**Contract**: If `Astro.locals.user` is non-null, build a `PrivateStateClient`, call `listClimbs`, group returned rows by `routeId`, and pass summaries into `RoutesTable`. If private-state reads fail, render a Polish inline diagnostic near the route actions while leaving the public catalog content visible. If there is no user, render one page-level CTA above the route table along the lines of "Zaloguj się, aby śledzić swoje przejścia", linking to `/auth/signin?next=<current crag path>`.

#### 7. Add S-04 i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Keep all S-04 user-facing strings in the Polish dictionary and satisfy the i18n guardrail.

**Contract**: Add keys for page-level sign-in CTA, log button, logged indicator, count/latest-date labels, date/note fields, pending text, success message, validation errors, API/user-facing error messages, and history copy introduced in later phases.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass after adding S-04 strings/form imports: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "from \"@/lib/private-state\"" src/components` returns no React component imports.
- `rg "new Date\\(\\)\\.toISOString|toISOString\\(" src/components src/pages src/lib` does not show new S-04 date formatting calls.

#### Manual Verification:

- Signed-out crag route page remains public and shows one page-level Polish CTA to sign in and track routes.
- Signed-in crag route page shows inline log actions in route rows without horizontal scrolling on 375×667, 390×844, and 412×915 viewports.
- Date defaults to today's UTC `YYYY-MM-DD` value and can be changed.
- Note is optional; saving with an empty note succeeds.
- Saving a route shows pending feedback, then inline success and an updated logged count/latest-date indicator without leaving the route page.
- Saving the same route twice creates two history rows and updates the route-row count.
- Invalid API input returns structured `{ error: { code, message, context } }` JSON.
- Browser HTML and network responses do not expose `SUPABASE_KEY`, `STRAPI_API_TOKEN`, or private rows belonging to another user.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Personal History + Dashboard Entry

### Overview

Add the protected history surface required by FR-010 and make `/dashboard` a useful entry point to it.

### Changes Required:

#### 1. Protect `/historia`

**File**: `src/middleware.ts`

**Intent**: Ensure personal history is authenticated and preserves the passwordless `next` return path.

**Contract**: Add `"/historia"` to `PROTECTED_ROUTES`. Keep the existing `buildSignInRedirect({ next })` behavior unchanged so signed-out users return to `/historia` after passwordless auth.

#### 2. History page

**File**: `src/pages/historia.astro`

**Intent**: Render the current user's climb history ordered newest-first.

**Contract**: Protected Astro page using `CatalogLayout` or the same light catalog chrome. Build a `PrivateStateClient`, call `listClimbs`, and render a list of rows. Each row shows route name, crag context, grade, climb date, optional note, and, when both `route.regionSlug` and `route.cragSlug` are present, a link to `/regiony/${route.regionSlug}/${route.cragSlug}`. If either route slug is missing, keep the climb row visible and show a Polish unavailable-link fallback instead of rendering a broken `/regiony/null/null` URL. If no climbs exist, show a Polish empty state pointing users back to the catalog. If a private-state error occurs, render a Polish diagnostic without leaking secrets. Default orphan behavior is acceptable in S-04: rows with `route: null` are dropped by `listClimbs`.

#### 3. History list component

**Files**: `src/components/climbs/HistoryList.astro`, `src/components/climbs/HistorySkeleton.tsx` (if needed)

**Intent**: Keep history row markup reusable and mobile-friendly.

**Contract**: `HistoryList` accepts hydrated `UserClimbWithRoute[]` and renders semantic list rows. The row layout must work on mobile without horizontal scrolling. If a client-side or deferred loading state is introduced, use `Skeleton`; otherwise the server-rendered initial page can avoid a skeleton at runtime while the progress registry still documents the initial-load expectation.

#### 4. Dashboard entry point

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the starter protected dashboard content with a lightweight Polish entry point into personal history.

**Contract**: Keep the page protected through existing middleware. Render the signed-in user email, a primary link to `/historia`, and the existing POST sign-out button. Do not add stats, projects, or delete functionality. Prefer the light catalog styling for consistency unless the implementation finds a smaller low-risk edit.

#### 5. History i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Add Polish strings for `/historia`, dashboard entry copy, empty state, history labels, and error states.

**Contract**: All visible copy routes through `getTranslations()`. Do not add inline English literals in `src/pages/historia.astro`, `src/pages/dashboard.astro`, or `src/components/climbs/**`.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "\"/historia\"" src/middleware.ts src/pages/dashboard.astro` returns the protected route and dashboard link.
- `rg "deleteClimb|removeProject" src/pages/historia.astro src/components/climbs` returns no S-05/S-06 actions.

#### Manual Verification:

- Signed-out `/historia` redirects to `/auth/signin?next=/historia`; completing passwordless auth returns to `/historia`.
- Signed-in `/historia` lists climbs newest-first by `climbedOn`, with same-date rows stable by creation order from the helper.
- Each history row shows route name, crag context, grade, date, optional note, and a link back to the crag page.
- Multiple logs for the same route appear as separate history rows.
- Empty history renders a Polish empty state and link back to catalog browsing.
- `/dashboard` links to `/historia` and sign-out still works.
- Mobile viewports 375×667, 390×844, and 412×915 render history with no horizontal scrolling.
- User A cannot see User B's history in a second browser/session.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Guardrails + Beta Verification

### Overview

Make S-04 part of the existing verification harness: update the progress-action registry, run the static guardrails, and extend/fill the manual beta-flow checklist for the route-log and history paths.

### Changes Required:

#### 1. Flip S-04 progress-action rows to shipped

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Turn the planned S-04 rows into active guardrail rows once the form and history page exist.

**Contract**: Update `Climb-log save` status from `planned: S-04` to `shipped`. Update `Personal history initial load` from `planned: S-04` to `shipped` if the implementation uses a skeleton or other explicit initial-load primitive in the listed file. If `/historia` remains fully server-rendered with no deferred loading state, adjust the row's rationale/status explicitly rather than leaving a stale planned row.

#### 2. Update beta-flow checklist page/action scope

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: Make the manual checklist exercise the newly shipped route-log and history paths.

**Contract**: Change the S-04 planned rows to current paths: the crag route view with inline log form and `/historia`. Add progress-feedback checklist items for climb-log save and any shipped history loading primitive. Update the latest run with date, commit, branch/slice context, skipped rows, Polish/mobile/progress results, and response-time observations.

#### 3. Run S-04 verification pass

**Files**: `docs/verification/beta-flow-checklist.md`, `context/changes/route-climb-log/plan.md`

**Intent**: Record that the north-star flow passed both automated and manual verification before considering S-04 complete.

**Contract**: Run `npm run guardrails`, then the manual checklist against local dev or an available preview. Fill the checklist's "Latest run" section. Update this plan's `## Progress` section with the verification results and commit SHA when the implementation lands.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass with S-04 rows current: `npm run guardrails`
- Production build passes: `npm run build`
- `docs/verification/progress-feedback-actions.md` marks the climb-log save row as `shipped`.
- `docs/verification/beta-flow-checklist.md` includes `/historia` as current and includes a climb-log save progress-feedback row.

#### Manual Verification:

- The beta-flow checklist passes for `/auth/signin`, `/auth/signup`, `/auth/check-email`, route view with inline climb-log save, and `/historia`.
- The route-log save action shows progress feedback within ~300 ms on Slow 4G + 4× CPU and remains visible until success or visible error.
- Route view and history pass mobile checks at 375×667, 390×844, and 412×915.
- Response-time observations are recorded for the route view and history page, without turning the aspirational 800 ms target into a hard gate.
- The newest-first history and route-row saved/count indicator are verified with at least two logs on the same route.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering S-04 complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No automated test runner is configured.
- Future coverage should be documented in `src/lib/date/__tests__/README.md` for timezone boundary behavior.
- Future coverage should be documented in `src/components/climbs/__tests__/README.md` for form validation, pending state, API error rendering, repeat-log summary updates, and history row rendering.

### Integration Tests:

- `npx astro sync`, `npm run lint`, `npm run guardrails`, and `npm run build` are the automated gates after each phase.
- Local Supabase/Strapi smoke verifies `createClimb`, per-user RLS, route-id validation, and history hydration.
- The S-04 JSON API should be exercised manually with valid and invalid payloads to verify structured errors.

### Manual Testing Steps:

1. Start local Supabase and Astro with valid Supabase + Strapi env values.
2. Open a crag route page signed out and confirm it remains public with a page-level sign-in CTA.
3. Sign in through passwordless auth and return to the same crag page.
4. Expand one route's inline form, keep today's default date, leave note empty, save, and confirm inline success plus route-row indicator.
5. Save the same route again with a changed date and note; confirm the count/latest-date summary updates.
6. Open `/historia` and confirm newest-first rows show route, crag, grade, date, note, and crag link.
7. Repeat with a second user in another browser and confirm no cross-user history visibility.
8. Run the beta-flow checklist on mobile/throttled settings and record the latest run.

## Performance Considerations

S-04 adds one private-state read on signed-in crag route requests. At v1 scale this is bounded by a user's personal history size and uses the existing `(user_id, climbed_on desc, created_at desc)` index. The route page should read climbs once and group in memory rather than issuing `listClimbsByRoute` for every route row.

The save path performs one Supabase insert plus one catalog route validation. F-02's catalog cache absorbs the Strapi lookup at steady state. The inline React islands add interactivity only for signed-in route actions; signed-out public browsing should remain mostly server-rendered.

History is a protected, per-user list expected to be tens of rows during beta. If histories grow large later, add pagination or cursor-based loading in a separate plan.

## Migration Notes

No new Supabase migration is expected for S-04. The existing `public.climbs` table already supports route id, date, note, timestamps, repeat logs, per-user RLS, and newest-first ordering.

Rollback is a code revert of the S-04 UI/API/history changes. Any climb rows created during testing remain in Supabase; before public beta, test rows can be cleaned manually or through the existing private-state smoke cleanup path where appropriate.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD US-01, FR-009, FR-010: `context/foundation/prd.md`
- Private-state contract: `context/changes/private-user-state-contract/plan.md`
- Public catalog browse contract: `context/archive/2026-05-29-public-catalog-browse/plan.md`
- Passwordless auth flow: `context/archive/2026-06-01-passwordless-auth-flow/plan.md`
- Guardrails foundation: `context/archive/2026-06-01-core-flow-verification-guardrails/plan.md`
- Route table: `src/components/catalog/RoutesTable.astro`
- Crag page: `src/pages/regiony/[region]/[crag].astro`
- Private-state helpers: `src/lib/private-state/index.ts`, `src/lib/private-state/climbs.ts`
- Middleware: `src/middleware.ts`
- Progress registry: `docs/verification/progress-feedback-actions.md`
- Beta checklist: `docs/verification/beta-flow-checklist.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Private-State Preflight

#### Automated

- [x] 1.1 Astro types still regenerate after any preflight notes or supporting edits: `npx astro sync` — 323414f
- [x] 1.2 Root lint passes: `npm run lint` — 323414f
- [x] 1.3 Guardrails still pass: `npm run guardrails` — 323414f
- [x] 1.4 Production build still passes: `npm run build` — 323414f

#### Manual

- [x] 1.5 `createPrivateStateClient(headers, cookies, null)` behavior is verified as `unauthenticated`. — 323414f
- [x] 1.6 Unknown route write behavior is verified as `PrivateStateError("unknown_route")`. — 323414f
- [x] 1.7 Default `listClimbs` orphan behavior is verified as dropping orphaned rows. — 323414f
- [x] 1.8 Preflight result is recorded in `context/changes/route-climb-log/change.md`. — 323414f

### Phase 2: Save API + Route-Page State

#### Automated

- [x] 2.1 Astro types regenerate: `npx astro sync` — 19b4867
- [x] 2.2 Root lint passes: `npm run lint` — 19b4867
- [x] 2.3 Guardrails pass after adding S-04 strings/form imports: `npm run guardrails` — 19b4867
- [x] 2.4 Production build passes: `npm run build` — 19b4867
- [x] 2.5 `rg "from \"@/lib/private-state\"" src/components` returns no React component imports. — 19b4867
- [x] 2.6 `rg "new Date\\(\\)\\.toISOString|toISOString\\(" src/components src/pages src/lib` does not show new S-04 date formatting calls. — 19b4867

#### Manual

- [x] 2.7 Signed-out crag route page remains public and shows one page-level Polish CTA to sign in and track routes. — 19b4867
- [x] 2.8 Signed-in crag route page shows inline log actions in route rows without horizontal scrolling on 375×667, 390×844, and 412×915 viewports. — 19b4867
- [x] 2.9 Date defaults to today's UTC `YYYY-MM-DD` value and can be changed. — 19b4867
- [x] 2.10 Note is optional; saving with an empty note succeeds. — 19b4867
- [x] 2.11 Saving a route shows pending feedback, then inline success and an updated logged count/latest-date indicator without leaving the route page. — 19b4867
- [x] 2.12 Saving the same route twice creates two history rows and updates the route-row count. — 19b4867
- [x] 2.13 Invalid API input returns structured `{ error: { code, message, context } }` JSON. — 19b4867
- [x] 2.14 Browser HTML and network responses do not expose `SUPABASE_KEY`, `STRAPI_API_TOKEN`, or private rows belonging to another user. — 19b4867

### Phase 3: Personal History + Dashboard Entry

#### Automated

- [x] 3.1 Astro types regenerate: `npx astro sync` — 8d762b3
- [x] 3.2 Root lint passes: `npm run lint` — 8d762b3
- [x] 3.3 Guardrails pass: `npm run guardrails` — 8d762b3
- [x] 3.4 Production build passes: `npm run build` — 8d762b3
- [x] 3.5 `rg "\"/historia\"" src/middleware.ts src/pages/dashboard.astro` returns the protected route and dashboard link. — 8d762b3
- [x] 3.6 `rg "deleteClimb|removeProject" src/pages/historia.astro src/components/climbs` returns no S-05/S-06 actions. — 8d762b3

#### Manual

- [x] 3.7 Signed-out `/historia` redirects to `/auth/signin?next=/historia`; completing passwordless auth returns to `/historia`. — 8d762b3
- [x] 3.8 Signed-in `/historia` lists climbs newest-first by `climbedOn`, with same-date rows stable by creation order from the helper. — 8d762b3
- [x] 3.9 Each history row shows route name, crag context, grade, date, optional note, and a link back to the crag page. — 8d762b3
- [x] 3.10 Multiple logs for the same route appear as separate history rows. — 8d762b3
- [x] 3.11 Empty history renders a Polish empty state and link back to catalog browsing. — 8d762b3
- [x] 3.12 `/dashboard` links to `/historia` and sign-out still works. — 8d762b3
- [x] 3.13 Mobile viewports 375×667, 390×844, and 412×915 render history with no horizontal scrolling. — 8d762b3
- [x] 3.14 User A cannot see User B's history in a second browser/session. — 8d762b3

### Phase 4: Guardrails + Beta Verification

#### Automated

- [x] 4.1 Astro types regenerate: `npx astro sync`
- [x] 4.2 Root lint passes: `npm run lint`
- [x] 4.3 Guardrails pass with S-04 rows current: `npm run guardrails`
- [x] 4.4 Production build passes: `npm run build`
- [x] 4.5 `docs/verification/progress-feedback-actions.md` marks the climb-log save row as `shipped`.
- [x] 4.6 `docs/verification/beta-flow-checklist.md` includes `/historia` as current and includes a climb-log save progress-feedback row.

#### Manual

- [x] 4.7 The beta-flow checklist passes for `/auth/signin`, `/auth/signup`, `/auth/check-email`, route view with inline climb-log save, and `/historia`.
- [x] 4.8 The route-log save action shows progress feedback within ~300 ms on Slow 4G + 4× CPU and remains visible until success or visible error.
- [x] 4.9 Route view and history pass mobile checks at 375×667, 390×844, and 412×915.
- [x] 4.10 Response-time observations are recorded for the route view and history page, without turning the aspirational 800 ms target into a hard gate.
- [x] 4.11 The newest-first history and route-row saved/count indicator are verified with at least two logs on the same route.

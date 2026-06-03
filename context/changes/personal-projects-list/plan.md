# Personal Projects List Implementation Plan

## Overview

Ship S-06 **add + view** for personal projects: a signed-in climber can add a route to their projects list from the crag route table (FR-012), see a per-route **"W projektach"** indicator once added, and review all projects on a protected `/projekty` page (FR-013).

This slice mirrors the shipped S-04 (`route-climb-log`) structure: private-state helpers and schema already exist from F-02; S-06 adds the JSON API, React island, crag-page wiring, protected list page, nav entry points, and guardrail updates.

**Remove** (FR-014) is explicitly **out of scope** here. It will ship in a separate change (e.g. `remove-personal-project`) that mirrors `delete-climb-log` once that slice lands. FR-015 (auto-remove on log) remains parked per the roadmap.

## Current State Analysis

F-02 (`private-user-state-contract`) already delivered everything below the UI layer:

- `public.projects` with `unique (user_id, route_id)`, FR-013 index, RLS ON, four per-operation policies (`supabase/migrations/20260531172510_private_user_state.sql`).
- `@/lib/private-state` exports `listProjects`, `isRouteOnProjects`, `addProject`, and `removeProject` (`src/lib/private-state/projects.ts`). S-06 consumes the first three; `removeProject` waits for the remove slice.
- S-04 shipped the patterns to mirror: `/api/climbs.ts`, `RouteClimbAction` / `ClimbLogForm`, `RoutesTable.astro` signed-in action cell, `/historia.astro` + `HistoryList.astro`, dashboard CTA, and `CatalogHeader` history link.

Missing for S-06:

1. `POST`-only projects API route (`src/pages/api/projects.ts`).
2. `ProjectAction` React island (add button → success → static badge).
3. Crag page: `listProjects` → `Set<routeId>` passed into `RoutesTable`.
4. Protected `/projekty` page + `ProjectsList.astro` (view-only rows).
5. `/projekty` in `PROTECTED_ROUTES`, dashboard + header nav links, `projects.*` i18n keys, and flipping `planned: S-06` verification rows to `shipped`/`current`.

## Desired End State

After this plan lands:

- Signed-out users still browse crag route pages publicly; no per-row project controls.
- Signed-in users see a per-route **add-to-projects** control beside the existing climb-log action. Adding shows pending feedback, then inline success, then a non-interactive **"W projektach"** badge (no remove affordance in this slice).
- Duplicate add attempts return structured `duplicate_project` JSON (422) without breaking the row.
- `/projekty` is middleware-protected, lists the user's projects ordered `created_at desc` (via `listProjects`), each row showing route name, grade/type, crag context, and a link back to `/regiony/{region}/{crag}` when slugs are available.
- `/dashboard` and authenticated `CatalogHeader` link to `/projekty` beside `/historia`.
- `npm run guardrails`, `npm run lint`, and `npm run build` pass; progress registry and beta checklist mark S-06 paths as shipped/current.

### Key Discoveries:

- `src/components/catalog/RoutesTable.astro` renders a mobile-card route table with one signed-in action column for climb logging; S-06 stacks a second island in that cell without adding a column (preserves no-horizontal-scroll layout).
- `addProject` already maps Postgres `23505` → `PrivateStateError("duplicate_project")` and `STATUS_FOR_CODE` in `/api/climbs.ts` already lists `duplicate_project: 422` as forward-compatible precedent.
- `removeProject(client, id)` takes the **project row id**, not `routeId` — the future remove slice will resolve that; this slice never calls it.
- Verification harness pre-registers `src/pages/projekty.astro` in i18n guard, progress registry (`planned: S-06`), and beta checklist (`planned: S-06`).

## What We're NOT Doing

- **FR-014 remove from projects** — deferred to a separate change mirroring `delete-climb-log` (no DELETE verb, no remove button on `/projekty`, no toggle-off on the route row).
- **FR-015 auto-remove project when logging a climb** — nice-to-have, parked in roadmap.
- Climb-log or history changes beyond coexisting on the same route row.
- Stats, search, filters, or reordering of the projects list.
- Per-route detail pages; routes remain rows on the crag page.
- New Supabase migrations (schema is complete).
- A test runner setup (verify via astro sync, lint, guardrails, build, manual smoke).

## Implementation Approach

Keep the crag route page public and server-rendered. When `Astro.locals.user` is present, extend the existing private-state `try` block to also call `listProjects`, build `projectRouteIds: Set<string>`, and pass a per-route `isOnProjects` boolean into `RoutesTable`. Use `Promise.all([listClimbs(client), listProjects(client)])` so signed-in reads stay one round-trip group.

Mutations are **add-only**: a narrow `POST /api/projects` accepts `{ routeId }`, validates with zod, calls `addProject`, returns `201 { project }`. React `ProjectAction` owns pending/success/error and flips local state to show the badge; it never imports `@/lib/private-state`.

`/projekty` mirrors `/historia`: protected Astro page, `listProjects(client)`, map hydrated rows into a flat DTO for `ProjectsList.astro`, Polish empty/error states, orphan rows dropped by default.

## Critical Implementation Details

### Public Route Page, Private Writes

Do not add `/regiony` to `PROTECTED_ROUTES`. Only `/projekty` and `/api/projects` (JSON `401`, not HTML redirect) are new authenticated surfaces for this slice.

### Server-Only Boundary

`@/lib/private-state` imports only from Astro pages and API routes. `ProjectAction` receives `routeId` and `initialIsOnProjects` (boolean); it POSTs to `/api/projects`. Guardrail: `rg "from \"@/lib/private-state\"" src/components` must stay empty.

### Add-Only Row State

Once a route is on the list, render a static badge — not a disabled remove button — so users are not promised removal before the remove slice ships. Optimistic/local state after a successful `201` should set `isOnProjects: true` without a full page reload.

## Phase 1: Projects-State Preflight

### Overview

Verify F-02 project helpers S-06 relies on before building user-facing UI. No product surface in this phase.

### Changes Required:

#### 1. Review F-02 project helper contracts

**Files**: `src/lib/private-state/projects.ts`, `context/changes/private-user-state-contract/plan.md`

**Intent**: Confirm `addProject`, `listProjects`, and `isRouteOnProjects` match FR-012/FR-013 expectations and that `removeProject` exists but is intentionally unused in this slice.

**Contract**: `addProject` rejects unknown `routeId` with `unknown_route`; duplicate insert yields `duplicate_project`; `listProjects` orders `created_at desc` and drops orphans by default; `isRouteOnProjects` returns boolean for a canonical `routeId`.

#### 2. Exercise project helper failure modes locally

**Files**: `src/lib/private-state/projects.ts`, `src/pages/private-state-smoke.astro` (if applicable)

**Intent**: Prove add/list/membership behavior before wiring islands.

**Contract**: With local Supabase + Strapi env: add a valid route → row exists; add same route again → `duplicate_project`; `listProjects` returns hydrated row; `isRouteOnProjects` is true for that route and false for another.

#### 3. Record preflight outcome

**File**: `context/changes/personal-projects-list/change.md`

**Intent**: Leave a short note that S-06 started with projects preflight complete or blocked.

**Contract**: Under `## Notes`, summarize result and blockers. Stop before Phase 2 if blocked.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass: `npm run guardrails`
- Production build passes: `npm run build`

#### Manual Verification:

- `addProject` succeeds for a valid catalog `routeId`.
- Duplicate add returns `PrivateStateError("duplicate_project")`.
- `listProjects` returns newest-first hydrated rows; orphans dropped by default.
- `isRouteOnProjects` reflects membership after add.
- Preflight recorded in `change.md`.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Add API + Route-Page State

### Overview

Add the authenticated add path and per-route projects UI: JSON API, `ProjectAction` island, `RoutesTable` props, crag-page `listProjects` read, and core `projects.*` i18n keys.

### Changes Required:

#### 1. Projects add API route

**File**: `src/pages/api/projects.ts`

**Intent**: Provide one authenticated JSON mutation for adding a route to projects (FR-012).

**Contract**: Export `const prerender = false` and `POST` only. Accept JSON `{ routeId: string }`; validate with zod. Build `PrivateStateClient` from headers/cookies/`context.locals.user`, call `addProject`, return `201` with `{ project: UserProject }` on success. Map validation and `PrivateStateError` to `{ error: { code, message, context } }` with Polish messages from `errors.projects.*` keys. Status map mirrors `/api/climbs.ts`: `invalid_input` 400, `unauthenticated` 401, `unknown_route`/`duplicate_project` 422, `missing_config` 503, `upstream_error`/`unknown` 500. Do **not** export `DELETE` in this slice.

#### 2. Projects UI types and island

**Files**: `src/components/projects/ProjectAction.tsx`, `src/components/projects/types.ts`, `src/components/projects/index.ts`, `src/components/projects/__tests__/README.md`

**Intent**: Per-route add control without importing server-only private-state code.

**Contract**: `ProjectAction` accepts `routeId: string` and `initialIsOnProjects: boolean`. When false: render add button using `SubmitButton` (progress guard for S-06 add action). POST JSON to `/api/projects`; on `201`, set local state to on-projects and show brief inline success (mirror climb success chip). When true: render non-interactive **"W projektach"** badge only. Handle `duplicate_project` by flipping to badge state (idempotent UX). All strings via `getTranslations()`.

#### 3. Extend route table for projects

**File**: `src/components/catalog/RoutesTable.astro`

**Intent**: Render `ProjectAction` beside `RouteClimbAction` in the signed-in action cell without horizontal scroll regression.

**Contract**: Extend props with optional `projectRouteIds?: Set<string>` (or equivalent `isOnProjectsForRoute(routeId)` helper). When `showActions` is true, wrap both islands in a vertical `flex flex-col gap-2` inside the existing action cell. Pass `initialIsOnProjects={projectRouteIds?.has(route.id) ?? false}`. Add i18n for any new column label if the action header becomes shared (e.g. keep climb column label, projects control is subordinate in same cell).

#### 4. Load project membership on crag page

**File**: `src/pages/regiony/[region]/[crag].astro`

**Intent**: Supply per-route project membership alongside climb summaries for signed-in users.

**Contract**: In the signed-in `try` block, replace single `listClimbs` with `Promise.all([listClimbs(client), listProjects(client)])`. Build `projectRouteIds` from `listProjects` results' `routeId` (skip rows with `route === null`). Pass `projectRouteIds` into `RoutesTable`. On private-state failure, keep existing Polish diagnostic; public catalog stays visible.

#### 5. Core projects i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Polish strings for add button, badge, pending/success/error, API errors, and route-row copy.

**Contract**: Add `projects.action.*`, `projects.form.*` (if needed), `errors.projects.*` mirroring `errors.climbs.*` shape. Register progress-feedback copy for the add action file path in Phase 4.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "from \"@/lib/private-state\"" src/components` returns no matches.
- `rg "DELETE|removeProject" src/pages/api/projects.ts src/components/projects` returns no remove surface in this slice.

#### Manual Verification:

- Signed-out crag page: no project controls; public catalog unchanged.
- Signed-in crag page: add control visible per row; no horizontal scroll at 375×667, 390×844, 412×915.
- Adding a route shows progress feedback, then success, then **"W projektach"** badge without navigation.
- Adding the same route again (e.g. race/double-click) surfaces gracefully (badge state, structured 422 if API hit twice).
- Invalid `routeId` returns structured JSON error.
- Network responses do not leak secrets or another user's project rows.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Projects List Page + Dashboard/Nav Entry

### Overview

Add the protected projects list (FR-013) and discoverability via dashboard + header nav.

### Changes Required:

#### 1. Protect `/projekty`

**File**: `src/middleware.ts`

**Intent**: Gate the projects list behind auth with passwordless `next` return.

**Contract**: Add `"/projekty"` to `PROTECTED_ROUTES`. Keep `/api/projects` **out** of `PROTECTED_ROUTES` (JSON `401` for islands).

#### 2. Projects page

**File**: `src/pages/projekty.astro`

**Intent**: Render the current user's projects list (view-only).

**Contract**: Mirror `src/pages/historia.astro` structure: `CatalogLayout`, defensive `createPrivateStateClient`, `listProjects(client)` (optionally `Promise.all` with `listCrags()` only if needed for extra crag labels — prefer hydrated `route` from `listProjects`). Map to `ProjectsListItem` DTO: `id`, `routeName`, `routeGrade`, `routeType`, `cragName`, `cragHref` (null-safe slugs). Polish empty state pointing to catalog; Polish load error without secret leakage. **No** remove controls per row.

#### 3. Projects list component

**Files**: `src/components/projects/ProjectsList.astro`, `src/components/projects/ProjectsSkeleton.tsx` (only if deferred loading is introduced)

**Intent**: Reusable, mobile-friendly list rows mirroring `HistoryList.astro`.

**Contract**: Semantic list; each row shows route name, grade, type, crag name, and crag back-link when `cragHref` is set; unavailable-link fallback when slugs missing (same discipline as history). No `createdAt` display in v1.

#### 4. Dashboard entry point

**File**: `src/pages/dashboard.astro`

**Intent**: Add primary/secondary CTA to `/projekty` beside `/historia`.

**Contract**: Render a link to `/projekty` with `dashboard.projects_link` i18n key. Keep sign-out and history link. No stats.

#### 5. Header nav link

**File**: `src/components/catalog/CatalogHeader.astro`

**Intent**: Global discoverability for projects (secondary PRD success metric).

**Contract**: Authenticated nav shows `/projekty` link beside `/historia` using `catalog.header.projects` key.

#### 6. Page i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Polish copy for `/projekty`, dashboard/header links, empty/error states, list labels.

**Contract**: All visible strings via `getTranslations()`; satisfy `scripts/check-i18n.mjs` scope for `src/pages/projekty.astro`.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "\"/projekty\"" src/middleware.ts src/pages/dashboard.astro src/components/catalog/CatalogHeader.astro` returns protected route and links.
- `rg "removeProject|DELETE" src/pages/projekty.astro src/components/projects` returns no remove UI.

#### Manual Verification:

- Signed-out `/projekty` redirects to `/auth/signin?next=/projekty`; passwordless return works.
- Signed-in `/projekty` lists projects newest-first (`created_at desc`).
- Rows show route name, grade, type, crag context, and valid crag link when slugs exist.
- Empty projects list shows Polish empty state + catalog link.
- `/dashboard` and header link reach `/projekty`.
- Mobile viewports: no horizontal scroll on list page.
- User A cannot see User B's projects in a second session.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Guardrails + Beta Verification

### Overview

Flip S-06 verification placeholders to shipped/current and record a beta-flow pass.

### Changes Required:

#### 1. Register projects add action in progress registry

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Enforce >2s progress feedback on the projects add control.

**Contract**: Add or update a row for **Projects add** → `src/components/projects/ProjectAction.tsx` → `SubmitButton` → `shipped`. Update **Projects list initial load** from `planned: S-06` to `shipped` (or document server-render-only rationale if no skeleton at runtime, same discipline as history).

#### 2. Update beta-flow checklist

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: Exercise crag add-to-projects and `/projekty` in manual beta verification.

**Contract**: Change `/projekty` from `planned: S-06` to `current`. Add progress-feedback checklist item for projects add. Update latest run with date, commit, branch, Polish/mobile/progress results.

#### 3. Run S-06 verification pass

**Files**: `docs/verification/beta-flow-checklist.md`, `context/changes/personal-projects-list/plan.md`

**Intent**: Record automated + manual verification before considering S-06 complete.

**Contract**: Run `npm run guardrails`, manual checklist on local dev/preview, update `## Progress` with commit SHA when landed.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass with S-06 rows current: `npm run guardrails`
- Production build passes: `npm run build`
- Progress registry marks projects add row `shipped` and projects list row not `planned: S-06`.
- Beta checklist lists `/projekty` as `current`.

#### Manual Verification:

- Beta checklist covers crag route add-to-projects and `/projekty` list view.
- Projects add shows progress feedback within ~300 ms on Slow 4G + 4× CPU until success/error.
- Route table and `/projekty` pass mobile checks at 375×667, 390×844, 412×915.
- At least two routes on projects list appear in correct order after two adds.

**Implementation Note**: Pause for manual confirmation before archiving S-06.

---

## Testing Strategy

### Unit Tests:

- No test runner configured.
- Document future cases in `src/components/projects/__tests__/README.md`: add pending state, duplicate handling, badge vs button states, API error rendering.

### Integration Tests:

- `npx astro sync`, `npm run lint`, `npm run guardrails`, `npm run build` after each phase.
- Manual JSON API exercise: valid add, duplicate add, unknown route, unauthenticated POST.

### Manual Testing Steps:

1. Start local Supabase + Astro with valid env.
2. Open a crag signed out — confirm no project controls.
3. Sign in, add a route to projects from a row — confirm badge without leaving page.
4. Open `/projekty` — confirm row content and crag link.
5. Add a second route — confirm ordering on `/projekty`.
6. Second user/session — confirm no cross-user visibility.
7. Run beta-flow checklist; record latest run.

## Performance Considerations

Signed-in crag pages gain one `listProjects` read alongside existing `listClimbs`, batched via `Promise.all`. At beta scale (tens of projects), in-memory `Set` membership is O(1) per route row. Add path is one insert plus catalog route validation (cached).

`/projekty` is a single `listProjects` read; pagination deferred until histories grow large.

## Migration Notes

No new migration. Rollback is a code revert; project rows created during testing remain in Supabase and can be cleaned manually if needed.

## References

- Roadmap S-06: `context/foundation/roadmap.md`
- PRD FR-012, FR-013: `context/foundation/prd.md`
- Research: `context/changes/personal-projects-list/research.md`
- Sibling plan: `context/changes/route-climb-log/plan.md`
- Private-state: `src/lib/private-state/projects.ts`
- Climb API template: `src/pages/api/climbs.ts`
- History template: `src/pages/historia.astro`
- Progress registry: `docs/verification/progress-feedback-actions.md`
- Beta checklist: `docs/verification/beta-flow-checklist.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Projects-State Preflight

#### Automated

- [ ] 1.1 Astro types regenerate: `npx astro sync`
- [ ] 1.2 Root lint passes: `npm run lint`
- [ ] 1.3 Guardrails pass: `npm run guardrails`
- [ ] 1.4 Production build passes: `npm run build`

#### Manual

- [ ] 1.5 `addProject` succeeds for a valid catalog `routeId`
- [ ] 1.6 Duplicate add returns `PrivateStateError("duplicate_project")`
- [ ] 1.7 `listProjects` returns newest-first hydrated rows; orphans dropped by default
- [ ] 1.8 `isRouteOnProjects` reflects membership after add
- [ ] 1.9 Preflight recorded in `context/changes/personal-projects-list/change.md`

### Phase 2: Add API + Route-Page State

#### Automated

- [ ] 2.1 Astro types regenerate: `npx astro sync`
- [ ] 2.2 Root lint passes: `npm run lint`
- [ ] 2.3 Guardrails pass: `npm run guardrails`
- [ ] 2.4 Production build passes: `npm run build`
- [ ] 2.5 `rg "from \"@/lib/private-state\"" src/components` returns no matches
- [ ] 2.6 `rg "DELETE|removeProject" src/pages/api/projects.ts src/components/projects` returns no remove surface

#### Manual

- [ ] 2.7 Signed-out crag page has no project controls
- [ ] 2.8 Signed-in crag page shows add control without horizontal scroll (375×667, 390×844, 412×915)
- [ ] 2.9 Add flow shows progress, success, then **W projektach** badge without navigation
- [ ] 2.10 Duplicate add handled gracefully (badge + structured 422 if applicable)
- [ ] 2.11 Invalid input returns structured JSON error
- [ ] 2.12 No secret or cross-user leakage in network/HTML responses

### Phase 3: Projects List Page + Dashboard/Nav Entry

#### Automated

- [ ] 3.1 Astro types regenerate: `npx astro sync`
- [ ] 3.2 Root lint passes: `npm run lint`
- [ ] 3.3 Guardrails pass: `npm run guardrails`
- [ ] 3.4 Production build passes: `npm run build`
- [ ] 3.5 `rg "\"/projekty\""` finds middleware protection and dashboard/header links
- [ ] 3.6 `rg "removeProject|DELETE" src/pages/projekty.astro src/components/projects` returns no remove UI

#### Manual

- [ ] 3.7 Signed-out `/projekty` redirects with `next=/projekty`; return after auth works
- [ ] 3.8 Signed-in `/projekty` lists projects newest-first
- [ ] 3.9 Rows show name, grade, type, crag context, and valid crag link
- [ ] 3.10 Empty state renders with catalog link
- [ ] 3.11 Dashboard and header link reach `/projekty`
- [ ] 3.12 Mobile viewports: no horizontal scroll on `/projekty`
- [ ] 3.13 User A cannot see User B's projects

### Phase 4: Guardrails + Beta Verification

#### Automated

- [ ] 4.1 Astro types regenerate: `npx astro sync`
- [ ] 4.2 Root lint passes: `npm run lint`
- [ ] 4.3 Guardrails pass with S-06 rows current: `npm run guardrails`
- [ ] 4.4 Production build passes: `npm run build`
- [ ] 4.5 Progress registry: projects add `shipped`; list row not `planned: S-06`
- [ ] 4.6 Beta checklist: `/projekty` is `current`

#### Manual

- [ ] 4.7 Beta checklist passes for add-to-projects and `/projekty`
- [ ] 4.8 Projects add progress feedback within ~300 ms on throttled mobile
- [ ] 4.9 Route table and `/projekty` pass mobile viewport checks
- [ ] 4.10 Two projects appear in correct order after two adds

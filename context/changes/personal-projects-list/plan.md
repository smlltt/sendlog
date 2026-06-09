# Personal Projects List (S-06) Implementation Plan

## Overview

Ship S-06 in full: a signed-in climber can **add** a route to, **view**, and **remove** a route from their personal projects list (FR-012, FR-013, FR-014). The data and privacy layer already exists from F-02 (`public.projects` table, RLS, and the `listProjects` / `isRouteOnProjects` / `addProject` / `removeProject` helpers). This change builds the API surface, the crag-row toggle, the protected `/projekty` page, navigation, i18n, and verification on top of that finished contract. It mirrors the shipped S-04 (add/view) and S-05 (two-step remove) climb flows almost field-for-field. **No new migration.**

## Current State Analysis

What exists today (verified against the codebase at planning time):

- **Data + privacy (DONE, F-02).** `supabase/migrations/20260531172510_private_user_state.sql` created `public.projects` (`id`, `user_id`, `route_id` text = Strapi `documentId`, `created_at`) with `unique (user_id, route_id)`, a `(user_id, created_at desc)` index for FR-013, RLS ON, and four per-operation `authenticated` policies scoped to `auth.uid() = user_id`. No `anon` policy → unauthenticated denied.
- **Server helpers (DONE, F-02).** `src/lib/private-state/projects.ts` exports `listProjects` (ordered `created_at desc`, catalog-hydrated, orphans dropped by default), `isRouteOnProjects`, `addProject` (validates route id, translates Postgres `23505` → `PrivateStateError("duplicate_project")`), and `removeProject` (deletes scoped by `id` AND `user_id`; zero rows → `not_found`). All re-exported from `src/lib/private-state/index.ts`.
- **Mutation API precedent (DONE, S-04 + S-05).** `src/pages/api/climbs.ts` is now POST **and** DELETE. Its `STATUS_FOR_CODE` already maps `duplicate_project: 422` and `not_found: 404`; DELETE takes `{ id }` (zod `z.uuid()`), echoes `{ deleted: { id } }`, and treats `not_found` as idempotent. `/api/climbs` is intentionally NOT in `PROTECTED_ROUTES` so islands get a JSON `401`, not an HTML redirect.
- **Crag-row island precedent (DONE, S-04).** `src/components/climbs/RouteClimbAction.tsx` is the per-route island; `src/components/catalog/RoutesTable.astro` renders it in a signed-in-only "Twoje przejścia" action cell; `src/pages/regiony/[region]/[crag].astro` builds the private-state client only when `Astro.locals.user` is set, reads `listClimbs`, groups per route, and threads primitives into the table.
- **List + remove precedent (DONE, S-05).** `src/pages/historia.astro` loads `Promise.all([listClimbs, listCrags])`, projects rows into the client-safe `HistoryClimbItem` DTO, and renders `HistoryList.astro` → `HistoryClimbCard.tsx`, a **list-level** island doing per-row two-step confirm, `Pending` feedback, `not_found`-as-idempotent, and last-row-falls-through-to-empty-state.
- **Nav + protection (DONE).** `src/middleware.ts` `PROTECTED_ROUTES = ["/dashboard", "/historia", "/private-state-smoke"]`; dashboard CTA group in `src/pages/dashboard.astro`; authenticated header links in `src/components/catalog/CatalogHeader.astro`.
- **Forward-compat harness (DONE).** `scripts/check-i18n.mjs` already lists `src/pages/projekty.astro` in its scope; `docs/verification/progress-feedback-actions.md` and `docs/verification/beta-flow-checklist.md` carry `planned: S-06` rows to flip.

What is missing (this plan builds it): the projects API route, the projects UI module + crag-row toggle island, crag-page project-membership wiring, the `/projekty` page + list/remove island, `/projekty` protection, dashboard + header links, `projects.*` / `errors.projects.*` i18n keys, and the verification flips.

## Desired End State

A signed-in climber on a crag page sees, in the same per-route action cell as the climb log, a projects toggle: "Dodaj do projektów" when the route is not on their list, or a "W projektach" state with an inline two-step remove when it is. Adding/removing updates the row in place without navigation. `/projekty` (protected) lists their projects newest-first with route name, grade, type, an "added on" date, and a crag back-link, each row removable via the same two-step confirm. `/projekty` is reachable from both the dashboard CTA and the header nav. `npm run guardrails`, lint, and build pass; the S-06 verification rows are flipped from `planned` to current.

Verify by: signing in, toggling a route on/off from a crag page, opening `/projekty` and confirming the route appears/disappears, removing from `/projekty`, and checking that a signed-out hit on `/projekty` redirects to sign-in.

### Key Discoveries:

- `addProject` already translates the duplicate case to `duplicate_project` and `removeProject` already enforces `not_found` discipline (`src/lib/private-state/projects.ts:91-140`) — the API route is pure plumbing.
- `STATUS_FOR_CODE` in `src/pages/api/climbs.ts:82-91` already contains every code the projects API needs (`duplicate_project`, `not_found`, etc.); the projects route copies this map verbatim.
- `removeProject(client, id)` takes the **project row id**, not the route id (`src/lib/private-state/projects.ts:123`). The crag page therefore must thread a `routeId → projectId` map (not just a boolean) so the toggle island can issue a DELETE without a server round-trip to resolve the id.
- `listProjects` returns `UserProjectWithRoute[]` already carrying `id` per row and `route` (with `regionSlug`/`cragSlug`), so both the crag-page membership map and the `/projekty` rows derive from one read each (`src/lib/private-state/projects.ts:33-61`).
- The S-05 list-level island pattern (`HistoryClimbCard.tsx`) is the exact template for `/projekty` removal, including last-row empty-state fall-through.
- Client-safe boundary is strict: islands must NOT import `@/lib/private-state`; they receive primitive props and call the JSON API (`src/components/climbs/types.ts:1-10`, `index.ts:1-14`).

## What We're NOT Doing

- **FR-015 (auto-remove a project when its route is logged)** — parked in the roadmap; spans climbs + projects and is out of scope.
- **No new migration, schema, index, or RLS change** — F-02 delivered all of it.
- **No edit of a project** — projects are a binary membership (on the list or not); there is nothing to edit.
- **No stats, counts, search, filtering, or manual reordering** on `/projekty` — newest-first only.
- **No changes to the climb-log flow** — S-04/S-05 stay as-is; projects is an additive sibling.
- **No second locale** — Polish-only, consistent with the rest of the app.

## Implementation Approach

Build bottom-up, mirroring the climb flow so each layer has a known-good template:

1. **API + client-safe types first** (Phase 1) so the UI layers have a contract to call and DTOs to import.
2. **Crag-row toggle** (Phase 2) — the FR-012 add + FR-014 remove entry point, where most users will act.
3. **`/projekty` page + remove + nav** (Phase 3) — the FR-013 view plus a second remove surface and discoverability.
4. **Guardrails + beta verification** (Phase 4) — flip the pre-registered S-06 rows and prove the flow against the committed checklists.

The projects UI lives in a new `src/components/projects/` module (`index.ts`, `types.ts`, `__tests__/`) mirroring `src/components/climbs/` to satisfy the repo module-structure rule. The DELETE contract is by **project row id** (exact mirror of `/api/climbs`); the crag page supplies the id via a membership map, and `/projekty` rows carry it natively.

## Critical Implementation Details

- **Membership must be a `routeId → projectId` map, not a boolean.** The crag-row toggle issues `DELETE { id }`, so a plain "on list?" flag is insufficient — the island needs the project row id to remove without an extra lookup. Build `Map<string, string>` (routeId → project id) from one `listProjects(client)` call in the crag page's existing signed-in `try` block, alongside the climbs read in the same `Promise.all`.
- **Add returns the new project id; the island stores it.** After a successful `POST { routeId }`, the island reads `{ project: { id } }` from the response and transitions to the on-list state holding that id, so an immediate remove works without a refresh (same no-re-render-during-session assumption as `RouteClimbAction`).
- **Mobile no-horizontal-scroll constraint.** The toggle stacks *inside* the existing action cell (no new column); on 375px viewports the cell already renders block-level (`RoutesTable.astro` `CELL_BASE_CLASSES`). Keep the toggle as a single wrapping flex row to avoid overflow.

## Phase 1: Projects Mutation API + Client-Safe Module

### Overview

Stand up `POST`/`DELETE /api/projects` and the `src/components/projects/` module scaffold with client-safe DTOs and the projects error i18n keys. After this phase the contract exists and is callable, even though no UI consumes it yet.

### Changes Required:

#### 1. Projects API route

**File**: `src/pages/api/projects.ts`

**Intent**: Single authenticated JSON mutation surface for projects, mirroring `src/pages/api/climbs.ts`: `POST` adds a route to the list, `DELETE` removes a project by row id. Keep it out of `PROTECTED_ROUTES` so signed-out islands get a structured `401` JSON instead of an HTML redirect.

**Contract**:
- `export const prerender = false`.
- `POST` body `{ routeId: string }` (zod: trimmed, 1–200 chars) → `addProject(client, { routeId })` → `201 { project: UserProject }`.
- `DELETE` body `{ id: string }` (zod `z.uuid()`) → `removeProject(client, id)` → `200 { deleted: { id } }`.
- Error shape `{ error: { code, message, context } }` via an `errorBody` helper; reuse the `STATUS_FOR_CODE` map from `climbs.ts` (already includes `duplicate_project: 422`, `not_found: 404`, `unauthenticated: 401`, `unknown_route: 422`, `missing_config: 503`, `upstream_error`/`unknown: 500`, `invalid_input: 400`).
- Messages resolved from `errors.projects.*` i18n keys (new) via `getTranslations()`; raw Supabase/Strapi text stays in `context` only.

#### 2. Projects UI module scaffold + client-safe types

**File**: `src/components/projects/types.ts`, `src/components/projects/index.ts`, `src/components/projects/__tests__/` (mirror `src/components/climbs/`)

**Intent**: Define the primitive DTOs that cross the server→client island boundary so no island imports `@/lib/private-state`. Provide the module's public entrypoint and the `__tests__/` directory required by the repo module-structure rule.

**Contract**: In `types.ts` —
- `ProjectResponse` (mirror of `UserProject`: `id`, `routeId`, `createdAt`).
- `AddProjectResponse { project: ProjectResponse }`, `DeleteProjectResponse { deleted: { id } }`.
- `ProjectApiErrorCode` (mirror the climbs union: `invalid_input | unauthenticated | unknown_route | duplicate_project | not_found | missing_config | upstream_error | unknown`) and `ProjectApiErrorBody`.
- `ProjectListItem` (pre-shaped `/projekty` row): `id`, `addedOn` (date string), `routeName`, `routeGrade`, `routeType`, `cragName`, `cragHref` — all nullable where the underlying route/crag may be missing, mirroring `HistoryClimbItem`.

`index.ts` re-exports the types and the two islands added in Phases 2–3. `__tests__/` carries a README mapping mirroring `src/lib/private-state/__tests__/README.md` (no test runner is configured).

#### 3. Projects error i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Add the `errors.projects.*` Polish messages keyed by API error code so the API route resolves user-facing copy, mirroring `errors.climbs.*`.

**Contract**: New keys `errors.projects.{missing_config,unauthenticated,unknown_route,duplicate_project,upstream_error,invalid_input,not_found,unknown}`. `duplicate_project` gets a real "already on your list" message (unlike climbs, where it's a fallback). Adding keys to the single dictionary updates the `UiKey` union automatically.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- i18n guardrail passes (no missing/orphaned keys): `npm run guardrails`
- Build passes: `npm run build`

#### Manual Verification:

- `POST /api/projects` with a valid `routeId` while signed in returns `201 { project }`; a second identical POST returns `422 duplicate_project`.
- `DELETE /api/projects` with that project `id` returns `200 { deleted }`; repeating returns `404 not_found`.
- Both verbs return `401 unauthenticated` (JSON, not a redirect) when signed out.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Crag-Row Add/Remove Toggle

### Overview

Add the per-route projects toggle island, wire project membership into the crag page, and render the island stacked inside the existing climb action cell. After this phase a signed-in user can add and remove a route's project status directly from the crag table.

### Changes Required:

#### 1. ProjectAction island

**File**: `src/components/projects/ProjectAction.tsx`

**Intent**: Per-route toggle that mirrors `RouteClimbAction` for state ownership but combines add + two-step remove. Off-list: a "Dodaj do projektów" button (`POST { routeId }`). On-list: a "W projektach" indicator with an inline remove that uses the S-05 two-step confirm (`DELETE { id }`, `Pending` feedback, `not_found`-as-idempotent). Holds the project id in local state so a fresh add can be removed without a refresh.

**Contract**: Props `{ routeId: string; initialProjectId: string | null }` (`null` = not on list). Calls `getTranslations()` directly. Imports `Pending` from `@/components/ui/Pending` (so `guardrails:progress` can see the >2 s mutation feedback). Must NOT import `@/lib/private-state`. Re-exported from `src/components/projects/index.ts`.

#### 2. Crag-page project membership read

**File**: `src/pages/regiony/[region]/[crag].astro`

**Intent**: In the existing signed-in `try` block, also read the user's projects and build a `routeId → projectId` map, then pass it to `RoutesTable`. Fold the projects read into the same `Promise.all` as `listClimbs` so it stays one round-trip group; on failure, reuse the existing Polish private-state diagnostic without breaking the public catalog.

**Contract**: Add `listProjects` to the `@/lib/private-state` import. Build `projectMembershipByRouteId: Map<string, string>` (routeId → project row id) from `listProjects(client)` rows whose `route` is non-null. Pass it into `RoutesTable` as a new prop. Existing climbs grouping is unchanged.

#### 3. RoutesTable wiring

**File**: `src/components/catalog/RoutesTable.astro`

**Intent**: Accept the membership map and render `ProjectAction` stacked below `RouteClimbAction` inside the same signed-in action cell (no new column, per the mobile constraint).

**Contract**: New optional prop `projectMembershipByRouteId?: Map<string, string>`. Inside the `showActions` cell, render `<ProjectAction client:load routeId={route.id} initialProjectId={projectMembershipByRouteId?.get(route.id) ?? null} />` beneath the existing `<RouteClimbAction>`. Action-column visibility logic (`showActions`) is unchanged.

#### 4. Crag-row + toggle i18n

**File**: `src/i18n/ui.ts`

**Intent**: Add `projects.*` keys for the toggle states and inline remove, mirroring the `climbs.action.*` / `history.delete.*` families.

**Contract**: New keys e.g. `projects.action.add_button` ("Dodaj do projektów"), `projects.action.on_list` ("W projektach"), `projects.action.add_pending`, `projects.action.added`, `projects.remove.button`, `projects.remove.confirm_prompt` ("Usunąć z projektów?"), `projects.remove.confirm`, `projects.remove.cancel`, `projects.remove.pending`, `projects.remove.success`, `projects.remove.already_gone`, `projects.remove.error`, `projects.action.error_network`.

### Success Criteria:

#### Automated Verification:

- Lint + type check passes: `npm run lint`
- Server-only boundary holds (island does not import private-state): `rg "from \"@/lib/private-state\"" src/components` returns no matches
- i18n + progress guardrails pass: `npm run guardrails`
- Build passes: `npm run build`

#### Manual Verification:

- Signed in on a crag page: a not-on-list route shows "Dodaj do projektów"; clicking adds it and the row switches to "W projektach" without navigation.
- Clicking remove on an on-list route shows the two-step confirm, then removes it back to "Dodaj do projektów".
- No horizontal scroll at 375px with both the climb and projects controls in one cell.
- Signed out: no toggle renders; the existing sign-in CTA still shows.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Protected /projekty Page + Removal + Navigation

### Overview

Build the protected `/projekty` view mirroring `/historia`, with a list-level remove island, then add protection and discoverability (dashboard CTA + header link). After this phase the full FR-012/013/014 loop is reachable end to end.

### Changes Required:

#### 1. Projects list island

**File**: `src/components/projects/ProjectsListCard.tsx`

**Intent**: List-level island mirroring `HistoryClimbCard`: owns the `ProjectListItem[]`, renders each row (name + grade + type + crag link + "added on" date), provides per-row two-step remove (`DELETE { id }`, `Pending`, `not_found`-as-idempotent), shows shared success/neutral notice, and falls through to the Polish empty-state when the last row is removed.

**Contract**: Props `{ projects: ProjectListItem[] }`. Same `not_found` idempotency and notice model as `HistoryClimbCard`. Imports `Pending`; must NOT import `@/lib/private-state`. Re-exported from `index.ts`. A thin `ProjectsList.astro` server wrapper (mirror of `HistoryList.astro`) renders it `client:load`.

#### 2. /projekty page

**File**: `src/pages/projekty.astro`

**Intent**: Protected page mirroring `historia.astro`: defensive `Astro.locals.user` check, `createPrivateStateClient`, `Promise.all([listProjects(client), listCrags()])`, project each row into `ProjectListItem` (with `addedOn` from `createdAt` via `formatDate`, crag name + `/regiony/<region>/<crag>` href), render heading/lead + load-error + empty + `ProjectsList`. Note this path is referenced by the progress registry (Phase 4).

**Contract**: New page at `/projekty`. Uses `formatDate` from `@/lib/date` for `addedOn`. `cragHref` is `null` when `regionSlug`/`cragSlug` are missing (same fallback as history). Error surface reuses the Polish "couldn't load" pattern without leaking upstream text.

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Gate `/projekty` for signed-out users with the same redirect-to-sign-in + `next` behavior as `/historia`.

**Contract**: Add `"/projekty"` to `PROTECTED_ROUTES`.

#### 4. Discoverability — dashboard CTA + header link

**File**: `src/pages/dashboard.astro`, `src/components/catalog/CatalogHeader.astro`

**Intent**: Add a `/projekty` entry next to the existing `/historia` ones in both the dashboard CTA group and the authenticated header nav.

**Contract**: Dashboard: a second CTA link to `/projekty` using a new `dashboard.projects_link` key. Header: a `/projekty` link beside the history link using a new `catalog.header.projects` key. Update the stale dashboard scope comment that says projects is a "next slice".

#### 5. Page/list i18n

**File**: `src/i18n/ui.ts`

**Intent**: Add the `/projekty` page + row + nav keys mirroring the `history.*` families.

**Contract**: New keys e.g. `projects.page_title`, `projects.heading`, `projects.lead`, `projects.empty_heading`, `projects.empty_body`, `projects.empty_cta`, `projects.load_error`, `projects.row.{grade_label,type_label,added_label,crag_label,open_crag,crag_unavailable}`, `dashboard.projects_link`, `catalog.header.projects`.

### Success Criteria:

#### Automated Verification:

- Lint + type check passes: `npm run lint`
- i18n + progress guardrails pass: `npm run guardrails`
- Build passes: `npm run build`
- Server-only boundary holds: `rg "from \"@/lib/private-state\"" src/components` returns no matches

#### Manual Verification:

- Signed-out hit on `/projekty` redirects to `/auth/signin?next=/projekty`.
- `/projekty` lists the signed-in user's projects newest-first with correct grade/type/date and working crag links.
- Removing a project on `/projekty` uses the two-step confirm and removes the row; removing the last row shows the empty-state without a refresh.
- A route added from a crag page appears on `/projekty`, and one removed there disappears; reaching the page via both the dashboard CTA and header link works.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Guardrails + Beta Verification

### Overview

Flip the pre-registered S-06 verification placeholders to current and run the full guardrail/lint/build suite plus the manual beta checklist pass.

### Changes Required:

#### 1. Progress-feedback registry

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Flip the `planned: S-06` "Projects list initial load" row to current (pointing at `src/pages/projekty.astro`) and add the >2 s projects mutation rows (add toggle + remove) pointing at the `Pending` usage in the projects islands.

**Contract**: Update the affected row(s) from `planned: S-06` to the shipped/current status used by S-04/S-05 rows; ensure every >2 s projects action has a registry entry matching what `scripts/check-progress.mjs` enforces.

#### 2. Beta-flow checklist

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: Flip the `planned: S-06` "Projects list" / `/projekty` rows to current and remove `/projekty` from the "pages skipped this cycle" note.

**Contract**: Update the `/projekty` row status and the skipped-pages line so no stale `planned: S-06` remains.

### Success Criteria:

#### Automated Verification:

- Full guardrails pass: `npm run guardrails`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- No stale S-06 placeholders remain: `rg "planned: S-06" docs` returns no matches

#### Manual Verification:

- The beta-flow checklist is walked end-to-end for the projects flow (mobile, Polish copy, >2 s progress feedback, response time) and passes.

**Implementation Note**: After automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

No automated test runner is configured in this repo; verification is the guardrail scripts + manual checklist.

### Static / guardrail checks:

- `npm run lint` (type-checked ESLint)
- `npm run guardrails` (i18n coverage + >2 s progress-feedback registry)
- `npm run build`
- `rg "from \"@/lib/private-state\"" src/components` stays empty (server-only boundary)

### Manual testing steps:

1. Sign in; on a crag page add a route to projects and confirm the row flips to "W projektach".
2. Remove it via the crag-row two-step confirm; confirm it flips back.
3. Add two routes; open `/projekty`; confirm both appear newest-first with grade/type/date/crag link.
4. Remove one on `/projekty` (two-step); confirm the row leaves; remove the last and confirm empty-state.
5. Sign out; hit `/projekty`; confirm redirect to sign-in with `next=/projekty`.
6. Re-add the same route twice quickly; confirm the duplicate path is handled gracefully (no error UI for an already-on-list route).
7. Check 375px viewport: no horizontal scroll on crag rows with both controls.

## Performance Considerations

The crag page adds one `listProjects` read inside the existing signed-in `Promise.all`, so there is no extra round-trip group. Both reads hydrate against the already-cached catalog. The `(user_id, created_at desc)` index serves the `/projekty` query directly.

## Migration Notes

None — F-02's `20260531172510_private_user_state.sql` already provides the table, constraints, index, RLS, and policies.

## References

- Related research: `context/changes/personal-projects-list/research.md`
- F-02 contract: `supabase/migrations/20260531172510_private_user_state.sql`, `src/lib/private-state/projects.ts`
- Add/view sibling (S-04): `src/components/climbs/RouteClimbAction.tsx`, `src/components/catalog/RoutesTable.astro`, `src/pages/regiony/[region]/[crag].astro:57-131`
- Remove sibling (S-05): `src/pages/api/climbs.ts:190-240`, `src/components/climbs/HistoryClimbCard.tsx`, `src/pages/historia.astro`
- Nav/protection: `src/middleware.ts:5`, `src/pages/dashboard.astro:37-53`, `src/components/catalog/CatalogHeader.astro:25-35`
- Verification: `docs/verification/progress-feedback-actions.md:47`, `docs/verification/beta-flow-checklist.md:63`, `scripts/check-i18n.mjs:72`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Projects Mutation API + Client-Safe Module

#### Automated

- [x] 1.1 Type checking passes: `npm run lint`
- [x] 1.2 i18n guardrail passes: `npm run guardrails`
- [x] 1.3 Build passes: `npm run build`

#### Manual

- [x] 1.4 POST add returns 201; duplicate POST returns 422 `duplicate_project`
- [x] 1.5 DELETE returns 200; repeat returns 404 `not_found`
- [x] 1.6 Both verbs return JSON 401 `unauthenticated` when signed out

### Phase 2: Crag-Row Add/Remove Toggle

#### Automated

- [ ] 2.1 Lint + type check passes: `npm run lint`
- [ ] 2.2 Server-only boundary holds: `rg "from \"@/lib/private-state\"" src/components` empty
- [ ] 2.3 i18n + progress guardrails pass: `npm run guardrails`
- [ ] 2.4 Build passes: `npm run build`

#### Manual

- [ ] 2.5 Add from crag row flips to "W projektach" without navigation
- [ ] 2.6 Two-step remove flips back to "Dodaj do projektów"
- [ ] 2.7 No horizontal scroll at 375px with both controls in one cell
- [ ] 2.8 Signed-out renders no toggle; sign-in CTA still shows

### Phase 3: Protected /projekty Page + Removal + Navigation

#### Automated

- [ ] 3.1 Lint + type check passes: `npm run lint`
- [ ] 3.2 i18n + progress guardrails pass: `npm run guardrails`
- [ ] 3.3 Build passes: `npm run build`
- [ ] 3.4 Server-only boundary holds: `rg "from \"@/lib/private-state\"" src/components` empty

#### Manual

- [ ] 3.5 Signed-out `/projekty` redirects to `/auth/signin?next=/projekty`
- [ ] 3.6 `/projekty` lists projects newest-first with grade/type/date + working crag links
- [ ] 3.7 Two-step remove on `/projekty` removes the row; last row → empty-state, no refresh
- [ ] 3.8 Crag-page add/remove reflects on `/projekty`; dashboard CTA + header link both reach it

### Phase 4: Guardrails + Beta Verification

#### Automated

- [ ] 4.1 Full guardrails pass: `npm run guardrails`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`
- [ ] 4.4 No stale placeholders: `rg "planned: S-06" docs` empty

#### Manual

- [ ] 4.5 Beta-flow checklist walked end-to-end for the projects flow and passes

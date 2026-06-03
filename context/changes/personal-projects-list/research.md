---
date: 2026-06-03T12:50:00+02:00
researcher: Samuel Liotta
git_commit: d5157280c82d103ce195549a80b584d0e164e975
branch: feature/S-05-delete-climb-log
repository: sendlog
topic: "Personal projects list (S-06 / FR-012–FR-014) — how to add, view, and remove routes from a per-user projects list"
tags: [research, codebase, personal-projects-list, private-state, projects, supabase, astro-islands]
status: complete
last_updated: 2026-06-03
last_updated_by: Samuel Liotta
---

# Research: Personal projects list (S-06)

**Date**: 2026-06-03T12:50:00+02:00
**Researcher**: Samuel Liotta
**Git Commit**: d5157280c82d103ce195549a80b584d0e164e975
**Branch**: feature/S-05-delete-climb-log
**Repository**: sendlog

## Research Question

What is already in place, and what is missing, to ship S-06 `personal-projects-list`:
a signed-in climber can **add a route to**, **view**, and **remove a route from** their
personal projects list (FR-012, FR-013, FR-014). Map the existing patterns the feature
should mirror so the change can go straight to planning.

## Summary

S-06 is the projects-side twin of the already-shipped S-04 (`route-climb-log`). The
hardest layers — the privacy boundary, the data model, and the server-only typed module —
**already exist and are tested end-to-end** from the F-02 (`private-user-state-contract`)
foundation:

- `public.projects` table exists with RLS ON, four per-operation policies scoped to
  `auth.uid() = user_id`, a `unique (user_id, route_id)` constraint, and a
  `(user_id, created_at desc)` index purpose-built for FR-013.
- `@/lib/private-state` already exports the four helpers S-06 needs:
  `listProjects`, `isRouteOnProjects`, `addProject`, `removeProject` — each with route-id
  validation, duplicate translation (Postgres `23505` → `duplicate_project`), and
  not-found-on-remove discipline.
- The verification harness already carries forward-compatible **placeholders for S-06**:
  `src/pages/projekty.astro` is named in the i18n guard scope, the progress-feedback
  registry (`planned: S-06`), and the beta-flow checklist (`planned: S-06`).

What does **not** yet exist and must be built by S-06:

1. A projects write/remove **API route** (e.g. `src/pages/api/projects.ts`) — only
   `src/pages/api/climbs.ts` exists today. Note `/api/climbs` is `POST`-only; S-06 needs an
   add **and** a remove verb (POST + DELETE, or POST with an intent field).
2. A **projects React island** analogous to `RouteClimbAction` / `ClimbLogForm` for the
   add/remove toggle on the route row.
3. Wiring on the crag page to read `listProjects` / per-route project membership and pass a
   per-route "on projects?" flag into `RoutesTable` (today the page only loads climb
   summaries).
4. The protected **`/projekty` page** (mirror of `/historia`) + `HistoryList`-style render
   component, plus the dashboard CTA and (optionally) the header nav link.
5. Adding `/projekty` to `PROTECTED_ROUTES`, the Polish `projects.*` i18n keys, and flipping
   the two `planned: S-06` verification rows to `shipped`.

There is **no new migration** required; the schema landed in F-02.

## Detailed Findings

### Data model + privacy (DONE — F-02)

The projects table, its uniqueness rule, index, RLS, and policies all already exist in the
single F-02 migration `supabase/migrations/20260531172510_private_user_state.sql`:

- Table + unique constraint (`supabase/migrations/20260531172510_private_user_state.sql:47-53`):
  `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade`,
  `route_id text not null` (Strapi `documentId`, **no FK**), `created_at timestamptz`, and
  `unique (user_id, route_id)` — a route is either on the list or not; no duplicates.
- FR-013 index (`:60-62`): `projects_user_id_created_at_idx on public.projects (user_id, created_at desc)`.
- RLS enabled (`:72-73`) and four per-operation policies for `authenticated` scoped to
  `auth.uid() = user_id` (`:101-125`). No `anon` policy → unauthenticated access denied by default.

Cross-source identity invariant: `route_id` stores the Strapi `documentId`
(`CatalogRoute.id`); integrity is enforced at the app boundary, not by a Postgres FK
(`supabase/migrations/20260531172510_private_user_state.sql:57-58`).

### Server-only module (DONE — F-02)

`@/lib/private-state` already exports everything S-06's pages/API need
(`src/lib/private-state/index.ts:31-44`). Project helpers in
`src/lib/private-state/projects.ts`:

- `listProjects(client, options?)` → `UserProjectWithRoute[]`, ordered `created_at desc`,
  hydrated against `@/lib/catalog`, drops orphans unless `{ includeOrphans: true }`
  (`src/lib/private-state/projects.ts:33-60`). This is the FR-013 read.
- `isRouteOnProjects(client, routeId)` → `boolean` for the per-route membership indicator
  (`src/lib/private-state/projects.ts:67-81`).
- `addProject(client, { routeId })` → validates the route id first, inserts, and translates
  Postgres `23505` → `PrivateStateError("duplicate_project")`
  (`src/lib/private-state/projects.ts:91-115`). This is the FR-012 write.
- `removeProject(client, id)` → deletes scoped by `id` **and** `user_id`; zero rows affected
  → `PrivateStateError("not_found")` (`src/lib/private-state/projects.ts:123-139`). This is
  the FR-014 write.

Supporting pieces, all reusable as-is:

- Route validation: `validateRouteId(routeId)` throws `unknown_route` (or `missing_config` /
  `upstream_error`) — `src/lib/private-state/validate-route.ts:17-38`.
- DTOs + error codes: `UserProject`, `UserProjectWithRoute`, `CreateProjectInput`,
  `PrivateStateReadOptions`, and the `PrivateStateErrorCode` union
  (`src/lib/private-state/types.ts:28-65`, `:67-73`). The union already includes
  `duplicate_project`.
- Authenticated client: `createPrivateStateClient(headers, cookies, user)` throws
  `unauthenticated` when `user` is null, `missing_config` when Supabase env is unset
  (`src/lib/private-state/client.ts:30-44`).
- Server-only / orphan boundary documented in `src/lib/private-state/index.ts:1-26` — React
  islands must NOT import this module.

### Write path / API (MISSING — needs new route)

The climb-log template is `src/pages/api/climbs.ts`:

- `export const prerender = false`, a local zod schema, and a centralized
  `STATUS_FOR_CODE` map that already lists `duplicate_project: 422`
  (`src/pages/api/climbs.ts:45-83`).
- `POST` reads JSON → zod `safeParse` → `createPrivateStateClient(...)` →
  `createClimb(...)` → `201 { climb }`; every `PrivateStateError` maps to
  `{ error: { code, message, context } }` via `errorBody(...)`
  (`src/pages/api/climbs.ts:120-172`).

S-06 must add an equivalent `src/pages/api/projects.ts`. Difference vs climbs: projects need
**both** add and remove. Climbs only has `POST` (delete-climb-log is a separate in-flight
slice). Decide: POST `/api/projects` to add + DELETE (or POST with `id`) to remove. The
`duplicate_project` and `not_found` codes are already wired into `STATUS_FOR_CODE`-style
mapping precedent, so reuse the same `errorBody` shape.

`/api/climbs` is intentionally **not** in `PROTECTED_ROUTES` so the island gets a JSON `401`
rather than an HTML redirect (`src/middleware.ts:5`); the projects API should do the same.

### Route-row UI (MISSING — needs new island)

Climb-log islands to mirror:

- `ClimbLogForm.tsx` — owns local state, posts JSON to `/api/climbs`, pending state via
  `SubmitButton`, success/error rendering, `onSaved` callback
  (`src/components/climbs/ClimbLogForm.tsx:43-115`, `:183-197`).
- `RouteClimbAction.tsx` — owns the per-route summary, expand/collapse, optimistic update
  after save (`src/components/climbs/RouteClimbAction.tsx:65-121`).
- Client-safe types/exports duplicate the DTOs so islands never import server-only code
  (`src/components/climbs/index.ts:16-24`, `src/components/climbs/types.ts:17-35`).

For projects the island is simpler than the climb form: a toggle button (Add to / Remove
from projects) with pending + success/error state. The initial per-route prop is a boolean
("on projects?") rather than a `{ count, latestClimbedOn }` summary.

### Crag page wiring (PARTIAL — climbs only today)

`RoutesTable.astro` already accepts `climbSummariesByRouteId`, `isSignedIn`,
`defaultClimbedOn` and conditionally renders the action cell only when signed in
(`src/components/catalog/RoutesTable.astro:7-40`, `:71-96`). The crag page builds the
private-state client only when `Astro.locals.user` exists, calls `listClimbs`, groups by
`routeId`, and renders a signed-out CTA via `buildSignInRedirect({ next })`
(`src/pages/regiony/[region]/[crag].astro:57-113`, `:126-131`).

S-06 extends this exact path: also read project membership (e.g. one `listProjects` call,
build a `Set<routeId>`), thread an `isSignedIn`-gated `projectRouteIds`/per-route boolean
prop into `RoutesTable`, and render a projects toggle island in (or beside) the existing
action cell. Read both climbs and projects in the single signed-in `try` block to keep it to
one private-state round-trip group.

### Protected list page (MISSING — mirror /historia)

`/historia` is the precise template (`src/pages/historia.astro:38-115`): defensive
`Astro.locals.user` check, `createPrivateStateClient`, `Promise.all([listClimbs(client),
listCrags()])`, map hydrated rows into a flat page DTO with crag back-links
(`/regiony/${regionSlug}/${cragSlug}`), Polish load-error / empty / list states, pure-render
`HistoryList.astro` (`src/components/climbs/HistoryList.astro:41-68`).

S-06 builds `src/pages/projekty.astro` the same way but calls `listProjects(client)`
(already ordered `created_at desc`, `src/lib/private-state/projects.ts:28-36`) and renders a
projects list component. Add a remove control per row (calls the projects API). Empty/error
states mirror history.

### Navigation + protection (MISSING — small edits)

- `PROTECTED_ROUTES = ["/dashboard", "/historia", "/private-state-smoke"]`
  (`src/middleware.ts:5`) — add `"/projekty"`.
- Dashboard CTA group (`src/pages/dashboard.astro:31-52`) — add a `/projekty` link beside
  the `/historia` anchor.
- Authenticated header nav (`src/components/catalog/CatalogHeader.astro:25-35`) — optionally
  add a `/projekty` link beside `/historia` for global discoverability.

### i18n + date + guardrails (PARTIAL — placeholders already exist)

- i18n: flat, single-locale Polish dictionary, dot-namespaced typed keys via
  `getTranslations()` (`src/i18n/ui.ts:1-8`, `src/i18n/utils.ts:27-31`). Mirror the
  `climbs.*` / `history.*` / `dashboard.*` / `catalog.header.*` groups with a new
  `projects.*` group (`src/i18n/ui.ts:123-198`). The i18n guard **already** scopes
  `src/pages/projekty.astro` (`scripts/check-i18n.mjs:54-73`), so the page must use only
  dictionary keys.
- Date helper: `formatDate(input)` → UTC `YYYY-MM-DD`, passes through conforming strings
  (`src/lib/date/index.ts:34-50`). Projects has no user-entered date (only `created_at`),
  so this is mostly for displaying `createdAt` if shown.
- Guardrails: `npm run guardrails` = i18n + progress checks (`package.json:13-15`). The
  progress registry already has a `planned: S-06` row for `src/pages/projekty.astro`
  (`docs/verification/progress-feedback-actions.md:45-46`), parsed/skipped until shipped
  (`scripts/check-progress.mjs:6-18`). The beta-flow checklist also lists `/projekty` as
  `planned: S-06` (`docs/verification/beta-flow-checklist.md:53-67`). S-06 flips both to
  `shipped`/`current`.

## Code References

- `supabase/migrations/20260531172510_private_user_state.sql:47-53` — `public.projects` table + `unique (user_id, route_id)`.
- `supabase/migrations/20260531172510_private_user_state.sql:60-62` — FR-013 index.
- `supabase/migrations/20260531172510_private_user_state.sql:72-73`, `:101-125` — RLS + projects policies.
- `src/lib/private-state/projects.ts:33-60` — `listProjects` (FR-013).
- `src/lib/private-state/projects.ts:67-81` — `isRouteOnProjects` (per-route indicator).
- `src/lib/private-state/projects.ts:91-115` — `addProject` (FR-012) + `23505` → `duplicate_project`.
- `src/lib/private-state/projects.ts:123-139` — `removeProject` (FR-014) + `not_found`.
- `src/lib/private-state/validate-route.ts:17-38` — `validateRouteId` → `unknown_route`.
- `src/lib/private-state/types.ts:28-73` — project DTOs, read options, error codes.
- `src/lib/private-state/client.ts:30-44` — `createPrivateStateClient` auth gate.
- `src/lib/private-state/index.ts:31-44` — public exports (project helpers included).
- `src/pages/api/climbs.ts:45-83`, `:120-172` — write-API template (zod, status map, error shape).
- `src/components/climbs/RouteClimbAction.tsx:65-121` — per-route island template.
- `src/components/climbs/ClimbLogForm.tsx:43-115` — POST + pending/error island template.
- `src/components/catalog/RoutesTable.astro:7-40`, `:71-96` — signed-in action cell + props.
- `src/pages/regiony/[region]/[crag].astro:57-131` — signed-in private-state read + signed-out CTA.
- `src/pages/historia.astro:38-115` — protected list page template.
- `src/components/climbs/HistoryList.astro:41-68` — pure-render list rows + crag back-link.
- `src/pages/dashboard.astro:31-52` — dashboard CTA group.
- `src/components/catalog/CatalogHeader.astro:25-35` — authenticated nav links.
- `src/middleware.ts:5` — `PROTECTED_ROUTES`.
- `src/lib/auth/redirect.ts:24-45` — `buildSignInRedirect` / `sanitizeNextPath`.
- `src/i18n/ui.ts:123-198`, `src/i18n/utils.ts:27-31` — dictionary + `getTranslations()`.
- `src/lib/date/index.ts:34-50` — `formatDate`.
- `package.json:13-15`, `scripts/check-progress.mjs:6-18`, `scripts/check-i18n.mjs:54-73` — guardrails.
- `docs/verification/progress-feedback-actions.md:45-46`, `docs/verification/beta-flow-checklist.md:53-67` — `planned: S-06` rows.

## Architecture Insights

- **Layered privacy**: middleware redirect (HTML pages) → `createPrivateStateClient` auth
  gate → RLS `auth.uid() = user_id`. API routes deliberately stay out of `PROTECTED_ROUTES`
  to return JSON `401` instead of an HTML redirect.
- **Server-only boundary is strict**: only Astro pages + API routes import
  `@/lib/private-state`; React islands receive serializable primitive props and POST to a
  JSON API. Guardrail precedent: `rg "from \"@/lib/private-state\"" src/components` must stay
  empty (S-04 plan §2.5).
- **Canonical identity**: every private row references a Strapi `documentId`
  (`CatalogRoute.id`); slugs are routing metadata only. Writes validate the route id against
  the cached catalog (~free at steady state).
- **Orphan tolerance**: read helpers drop rows whose route was unpublished/deleted unless
  `{ includeOrphans: true }`. S-06 should drop by default like `/historia` does.
- **Structured errors only**: API responses use `{ error: { code, message, context } }`;
  user-facing messages are Polish; secrets/raw Supabase errors never leak into `message`.
- **Forward-compatible verification**: the team pre-registered the S-06 page path in the
  i18n guard, the progress registry, and the beta checklist — the feature flips placeholders,
  it does not invent the harness.

## Historical Context (from prior changes)

- `context/changes/private-user-state-contract/plan.md` (F-02) — defined and shipped the
  `public.projects` table, RLS, and the `addProject`/`listProjects`/`isRouteOnProjects`/
  `removeProject` helpers; explicitly lists "S-06 personal projects list UI" under *What
  We're NOT Doing* (`:48`), confirming S-06 is the UI/API layer on top of the finished
  contract. Note: F-02 is still labeled `proposed` in the roadmap, but its progress section
  and the live code show it landed (commits `f756ccf`, `8bf7a58`, `1748378`).
- `context/archive/2026-06-01-route-climb-log/plan.md` (S-04) — the closest sibling; its
  4-phase structure (preflight → API + route-page state → protected list page + dashboard →
  guardrails/beta verification) is the natural template for the S-06 plan. It also defined
  the `RoutesTable` props contract, the `formatDate` helper, and the i18n discipline S-06
  reuses.
- `context/changes/delete-climb-log/change.md` (S-05) — in-flight sibling on the same branch
  (`feature/S-05-delete-climb-log`); it introduces the delete-an-owned-row pattern that
  `removeProject` will echo (FR-014). Worth coordinating: S-05's delete-API/island shape is a
  useful precedent for the projects remove verb.

## Related Research

- `context/archive/2026-06-01-passwordless-auth-flow/research.md` — auth/session context
  feeding the signed-in gate S-06 relies on.
- No prior `research.md` exists for `personal-projects-list`; this is the first.

## Open Questions

1. **API verb shape**: one `src/pages/api/projects.ts` with `POST` (add) + `DELETE`
   (remove), or POST-with-intent? S-05's emerging delete-climb API is the precedent to match.
2. **Remove-by what id**: `removeProject(client, id)` takes the **project row id**, not the
   route id. The route-row toggle only knows `routeId`, so either (a) the crag page passes
   the project row `id` into the island when a route is already on the list, or (b) the
   remove API accepts `routeId` and resolves the row server-side. Decide before planning the
   island props.
3. **FR-015 (auto-remove on log)**: nice-to-have, parked in the roadmap. Confirm it stays
   out of S-06 scope (it spans climbs + projects).
4. **Discoverability**: does `/projekty` get a global header nav link
   (`CatalogHeader.astro`), or only a dashboard CTA like the initial `/historia` rollout?
5. **Route-row affordance**: a single combined action cell (log climb + projects toggle) vs.
   two separate controls — affects `RoutesTable` layout and the no-horizontal-scroll mobile
   constraint.

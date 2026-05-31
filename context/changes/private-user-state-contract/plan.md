# Private User State Contract Implementation Plan

## Overview

Define the first stable contract for SendLog's authenticated climber state: a Supabase home for per-user climb logs and projects that references canonical Strapi catalog routes by `documentId`, a server-only typed module that owns I/O and validates against `@/lib/catalog` on write, and a small smoke surface that proves the full create → read → delete round-trip end-to-end against real catalog content.

This is the foundation F-02 calls for in `context/foundation/roadmap.md` — kept before auth-dependent slices because privacy is a guardrail, not polish, and the roadmap's named risk is "discovering too late that personal state cannot cleanly attach to catalog routes." The plan deliberately ships the contract (schema + RLS + typed module + smoke) without touching S-03 (passwordless auth flow) or S-04/S-05/S-06 (climb-log / delete / projects UI).

## Current State Analysis

SendLog is an Astro 6 SSR app deployed on Cloudflare Workers, with Supabase auth scaffolding wired through `src/lib/supabase.ts` and `src/middleware.ts`. F-01 (catalog content contract) and S-01 / S-02 (public catalog browse + crag map) are shipped, so the canonical catalog identity contract — `CatalogRoute.id` is Strapi `documentId`, a string — is already locked in (see `src/lib/catalog/types.ts:11`).

Per-user private state is currently absent:

- `supabase/migrations/` is empty (only `supabase/config.toml` and `.gitignore` exist).
- There is no `climbs`, `projects`, or `user_profiles` table.
- There is no server-only Supabase data module under `src/lib/`; `src/lib/supabase.ts` only constructs the auth client.
- The existing auth path is email+password (`src/pages/api/auth/signin.ts:13` uses `signInWithPassword`); S-03 will later swap it to passwordless without changing the contract this plan defines.
- `src/middleware.ts:4` gates `PROTECTED_ROUTES = ["/dashboard"]`; the verification page added in this plan extends that list.
- `astro.config.mjs:19-22` already declares `SUPABASE_URL`, `SUPABASE_KEY`, `STRAPI_API_URL`, `STRAPI_API_TOKEN` as server-only secrets. Phase 3 adds one new optional flag, `SMOKE_WRITES_ENABLED`, to gate write-effects of the smoke page in deployed environments — see "Smoke route protection" and Phase 3.
- `src/lib/config-status.ts:11` already exposes Supabase configuration status alongside Strapi; the smoke page reuses it for diagnostics.

## Desired End State

After this plan is complete, the repository carries a concrete private user state contract:

- Supabase has `public.climbs` and `public.projects` tables with row-level security ON, per-operation policies for `authenticated` scoped to `auth.uid() = user_id`, and supporting indexes.
- Each row references a Strapi catalog route via `route_id text NOT NULL` (the canonical `documentId`); there is no Postgres FK to the external store.
- A server-only TypeScript module at `src/lib/private-state/` wraps Supabase reads/writes with typed DTOs, demands an authenticated user, validates `route_id` against `@/lib/catalog` on writes, throws typed errors internally, and documents future I/O test coverage.
- A verification-only `/private-state-smoke` page (added to `PROTECTED_ROUTES`) picks one published Strapi route, writes one climb and one project for the signed-in user, reads them back, optionally cleans up, and renders inline Polish diagnostics when Supabase or Strapi is misconfigured.
- A separate user signed in on another browser cannot see the first user's climbs or projects — proven manually via the smoke page.

### Key Discoveries:

- The `CatalogRoute.id` invariant from F-01 is the canonical reference contract for everything private state writes (`src/lib/catalog/types.ts:8-11`).
- The catalog cache is one-Cache-API-entry-per-resource with a 1-hour TTL (see F-01 archive: `context/archive/2026-05-26-catalog-content-contract/plan.md:206`). Validating `route_id` on every write therefore costs zero extra Strapi requests at steady state.
- `src/lib/supabase.ts:9` constructs a `createServerClient` whose cookies adapter carries the user's session — the same client supports authenticated CRUD with RLS, so the private-state module reuses it.
- AGENTS.md (`/Users/samuelliotta/WebstormProjects/sendlog/AGENTS.md`) requires migration filenames matching `YYYYMMDDHHmmss_short_description.sql` under `supabase/migrations/`, RLS enabled with granular per-operation, per-role policies, structured error format `{ error: { code, message, context } }` (API-route shape only — typed throws inside libs), and the `feature.handler.ts` dot-separated file naming pattern.
- The existing `src/lib/catalog/` layout (`index.ts`, `types.ts`, `strapi.client.ts`, `cache.ts`, `__tests__/README.md`) is the template the new `src/lib/private-state/` follows — same import surface, same error-throwing discipline, same module-test-README treatment.
- `src/lib/config-status.ts:11-23` already produces Polish-language diagnostics for both Supabase and Strapi; the smoke page consumes this directly instead of inventing parallel checks.
- The current Supabase auth config (`supabase/config.toml:209`) has `enable_confirmations = false`, so a fresh email+password signup is immediately usable for smoke testing.

## What We're NOT Doing

- S-03 passwordless auth flow — F-02 keeps the current email+password sign-in untouched; the smoke page reuses it.
- S-04 climb-log UI (form, history page, route-row "log climb" affordances).
- S-05 delete climb log UI.
- S-06 personal projects list UI.
- FR-015 (auto-removal of project when a route is logged as climbed) — nice-to-have polish, not part of F-02.
- A `user_profiles` table or any per-user display-name / preference surface — PRD has no profile concept; `auth.users.id` is the only identity F-02 needs.
- API route handlers under `src/pages/api/climbs/` or `src/pages/api/projects/` — S-04 / S-05 / S-06 add these on top of the module.
- Soft-delete or `removed_at` columns on climbs/projects — PRD FR-011 specifies hard delete; the schema mirrors that.
- A length cap on the climb `note` column — PRD says "free text"; deferred until usage data justifies it.
- A Postgres FK or CHECK constraint linking `route_id` to a Strapi mirror — Strapi is external; no mirror table is introduced.
- A Strapi → Supabase webhook for catalog deletions — out of scope; orphan reads are tolerated by design.
- An orphan-reconciliation job or `route_deleted` flag.
- A test runner — none is configured in this repo; future coverage is documented in `__tests__/README.md`.

## Implementation Approach

Use Supabase as the canonical store for per-user private state. Anchor every climb / project row to a Strapi catalog route by `documentId` only, never by a copied catalog field — F-01's identity contract stays the single source of truth for "what route is this?".

The privacy boundary is row-level security. Per-operation policies for the `authenticated` role, all scoped to `auth.uid() = user_id`, mean the only key the runtime ever uses (the Supabase anon key already declared as `SUPABASE_KEY`) is enough to read and write private state safely. Unauthenticated visitors are denied by absence — no `anon` policy is granted, so RLS rejects them by default once it is ON.

The typed module enforces an additional "no anonymous writes" invariant inside the app: every climb / project write helper requires an authenticated `user.id` from the caller and refuses to proceed otherwise. Writes additionally call into `@/lib/catalog` to confirm `route_id` resolves to a published route — turning the catalog cache into a cheap integrity check at the boundary.

The smoke surface is verification-only, modeled on F-01's `/catalog-smoke/regions`. It picks the first published Strapi route via the same catalog module any S-04/S-06 page would use, exercises the write/read/delete path for the signed-in user, and renders inline Polish diagnostics — the same vocabulary the catalog smoke page uses — when Supabase or Strapi is misconfigured.

## Critical Implementation Details

### Cross-source identity (load-bearing)

`route_id` is `text NOT NULL` storing the Strapi `documentId`. There is no Postgres foreign key, no CHECK constraint, and no Strapi-mirror table. Integrity is enforced at the app boundary by `validateRouteId(route_id)` in the typed module, which calls `@/lib/catalog`'s `listRoutes()` and rejects unknown ids with a typed `unknown_route` error. The Strapi cache TTL (1 h) means this validation is effectively free at steady state.

This contract leans on a hard assumption: `listRoutes()` returns the **entire** published catalog in a single page. `src/lib/catalog/strapi.client.ts:13` currently sets `DEFAULT_PAGE_SIZE = 100`, which silently truncates any catalog larger than 100 routes — `validateRouteId` would then reject perfectly valid `documentId`s on page 2+ as `unknown_route`, blocking writes. Phase 2 lifts the ceiling to 1000, which comfortably covers v1 (Poland: no single crag exceeds ~1000 routes; the route list is always scoped to one crag in the UI). Proper Strapi pagination is recorded as a v2 follow-up in `Performance Considerations`.

### RLS ordering (load-bearing)

The migration must `enable row level security` on each table **before** any later step (or seed) writes data through a non-superuser role. The migration creates tables, enables RLS, then creates per-operation policies — in that order. No data is inserted in the migration itself; the smoke page is the first writer and runs through the user's authenticated session.

### Server-only boundary

`@/lib/private-state` imports the Supabase server client and the catalog module — both of which are server-only and carry secrets. React components rendered as islands MUST NOT import `@/lib/private-state` directly; pages and (future) API routes are the boundary. The module is exported from `src/lib/private-state/index.ts` only; deep imports into `client.ts`, `climbs.ts`, or `projects.ts` from outside the module are discouraged the same way `@/lib/catalog`'s `strapi.client.ts` is.

### Smoke route protection

`/private-state-smoke` is added to `PROTECTED_ROUTES` in `src/middleware.ts`. The smoke page therefore cannot render at all without an authenticated session — the middleware redirect to `/auth/signin` is the first line of defense, RLS the second.

### Production write-pollution guard (load-bearing)

The smoke page WRITES real rows into `public.climbs` and `public.projects` for the signed-in user. Once S-04 (history) and S-06 (projects) ship, those rows show up in the user's real, user-visible UI. To prevent any signed-in user who discovers `/private-state-smoke` in a deployed environment from polluting their own real climb log, the write path is gated by a new optional server-only env flag, `SMOKE_WRITES_ENABLED`, declared in `astro.config.mjs`'s `env.schema`. The page reads it once at request time:

- `SMOKE_WRITES_ENABLED !== "true"` (the default, including production where the secret is never set): the page renders its diagnostic shell, prints a Polish "smoke is disabled in this environment" message, and skips every Supabase write/read; no rows are inserted, no cleanup is performed.
- `SMOKE_WRITES_ENABLED === "true"` (set in `.dev.vars` for `npx wrangler dev`, or temporarily on a staging Worker): the page runs the full round-trip described below.

This is a fail-closed default: forgetting to set the flag means the page does nothing, never the other way around.

### Orphan tolerance (load-bearing)

Read helpers MUST hydrate the route reference against `@/lib/catalog` before returning DTOs to callers. When a private row points at a `route_id` not present in the catalog (admin deletion / unpublish), the helper either drops the row (default) or attaches a `routeMissing: true` flag — the choice is exposed as a read option so S-04 / S-06 can pick the UX later. The module documents this explicitly in `index.ts` so the foundation risk is visible to the next implementer.

## Phase 1: Supabase schema + RLS migration

### Overview

Create the two private-state tables, enable RLS, and install per-operation policies in a single migration under `supabase/migrations/`. No application code changes in this phase — the verification target is "the migration applies cleanly and a user cannot read another user's rows."

### Changes Required:

#### 1. Migration: climbs and projects tables with RLS

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_private_user_state.sql`

**Intent**: Create the canonical Supabase home for per-user climb log entries and projects, anchored to Strapi catalog routes by `documentId`, with strict per-user privacy enforced by row-level security.

**Contract**: Two tables in the `public` schema:

- `public.climbs`
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `route_id text not null` — Strapi `documentId`; no FK, no CHECK
  - `climbed_on date not null` — the date of the ascent (PRD: "today's date but can be changed")
  - `note text null` — optional free-text; no DB-level length cap in v1
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` (refreshed by a row-level `before update` trigger that sets `now()`)
  - Multiple rows per `(user_id, route_id)` are allowed; the same route can be climbed many times.

- `public.projects`
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `route_id text not null` — Strapi `documentId`
  - `created_at timestamptz not null default now()`
  - `unique (user_id, route_id)` — a route is either on a climber's projects list or not; no duplicates.

Indexes:

- `climbs (user_id, climbed_on desc, created_at desc)` — supports FR-010 "personal history ordered by date (most recent first)" with a stable secondary sort.
- `climbs (route_id)` — supports per-route "have I climbed this?" lookups added later by S-04.
- `projects (user_id, created_at desc)` — supports FR-013 "view personal projects list".

RLS:

- `alter table public.climbs enable row level security;`
- `alter table public.projects enable row level security;`
- Per-operation policies for the `authenticated` role on each table, every one scoped to `auth.uid() = user_id`:
  - `select` — `using (auth.uid() = user_id)`
  - `insert` — `with check (auth.uid() = user_id)`
  - `update` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`
  - `delete` — `using (auth.uid() = user_id)`
- No policies are granted to the `anon` role; RLS denies it by default.

Trigger: a single `set_updated_at()` trigger function in `public` that updates `updated_at = now()` before each `update` on `climbs`. (Not added to `projects` — that table has no `updated_at` column.)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly to a fresh local Supabase: `npx supabase db reset`
- Root lint still passes (no TS changes, but safety check): `npm run lint`
- Root production build still passes: `npm run build`

#### Manual Verification:

- After `npx supabase db reset`, both `public.climbs` and `public.projects` exist with the columns, indexes, and `unique (user_id, route_id)` constraint listed above.
- Both tables show `rls = on` in Supabase Studio's table editor.
- All eight per-operation policies (4 per table) appear in Studio with `auth.uid() = user_id` expressions and the `authenticated` role.
- Inserting a row into `public.climbs` while signed in as user A (via Studio's "Authenticate" panel or psql with the user's JWT), then signing in as user B and running `select * from public.climbs`, returns zero rows for user B.
- User A can `delete` their own row; attempting to `delete` user A's row while signed in as user B returns zero rows affected.
- Cascading delete works: deleting the user from `auth.users` (Studio's user management) removes all their `climbs` and `projects` rows.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Private state module

### Overview

Add the server-only TypeScript module at `src/lib/private-state/` that owns climb/project I/O, validates against the catalog on every write, demands an authenticated user, and throws typed errors internally. No UI is built in this phase — only the contract that S-03 / S-04 / S-05 / S-06 will later consume.

### Changes Required:

#### Prerequisite: Lift the catalog pagination ceiling from 100 to 1000

**File**: `src/lib/catalog/strapi.client.ts`

**Intent**: Make `listRoutes()` cover the realistic v1 catalog in a single page so `validateRouteId` is a sound integrity check, not a silent truncator. See "Cross-source identity (load-bearing)" above for why this is load-bearing for F-02.

**Contract**: Change `const DEFAULT_PAGE_SIZE = 100` (`src/lib/catalog/strapi.client.ts:13`) to `1000`. Single-line edit; the rest of the catalog module is unchanged. No new env entry, no schema change. The Cloudflare Cache API entry per resource grows in size but stays within Worker limits at v1 scale. Update the corresponding line in `src/lib/catalog/__tests__/README.md` if it cites the old value.

#### 1. Module entrypoint

**File**: `src/lib/private-state/index.ts`

**Intent**: Define the public surface of the private-state module so pages and (future) API routes have a single import location and the module's server-only nature is documented at the top.

**Contract**: Re-export typed DTOs and error types from `./types`, the `createPrivateStateClient` constructor from `./client`, and the climb/project helper sets from `./climbs` and `./projects`. The file header documents the server-only invariant (the same way `src/lib/catalog/index.ts:1-10` does), names the orphan-handling rule, and forbids deep imports from outside the module.

#### 2. Module types

**File**: `src/lib/private-state/types.ts`

**Intent**: Define the app-facing private-state contract — the DTOs, error codes, and read/write options — independently from Supabase's raw row shape.

**Contract**: Export interfaces:

- `UserClimb` — `{ id: string; routeId: string; climbedOn: string; note: string | null; createdAt: string; updatedAt: string }`. Field names use camelCase even though the DB stores snake_case; the module's mapper translates between the two.
- `UserProject` — `{ id: string; routeId: string; createdAt: string }`.
- `UserClimbWithRoute` / `UserProjectWithRoute` — same as above plus a `route: CatalogRoute | null` field, returned by hydrated read helpers. `route` is `null` iff the row is an orphan.
- `CreateClimbInput` — `{ routeId: string; climbedOn: string; note?: string | null }`.
- `CreateProjectInput` — `{ routeId: string }`.
- `PrivateStateReadOptions` — `{ includeOrphans?: boolean }` (default `false`; orphans are dropped).

Plus a typed error class:

- `PrivateStateError extends Error` with `code: "missing_config" | "unauthenticated" | "unknown_route" | "duplicate_project" | "not_found" | "upstream_error"` and a `context: Record<string, unknown>` field. Mirrors `CatalogError` (`src/lib/catalog/types.ts:67-77`). Note: there is no `forbidden` variant — RLS makes "row owned by another user" and "row does not exist" produce the same zero-rows-affected Supabase result, so the helpers throw `not_found` in both cases. If a future feature needs to distinguish them, it must add a separate ownership pre-check before introducing a new code.

The file documents the canonical-identity invariant in its header — Strapi `documentId` is the only acceptable value for `routeId`.

#### 3. Authenticated client wrapper

**File**: `src/lib/private-state/client.ts`

**Intent**: Wrap the existing `createClient` from `@/lib/supabase` with a private-state-flavored constructor that demands an authenticated user up-front and exposes a narrow surface to the rest of the module.

**Contract**: Export `createPrivateStateClient(headers, cookies, user)` returning an object that carries `{ supabase, userId }`. If `user` is `null`, throw `PrivateStateError({ code: "unauthenticated" })`. If `createClient(...)` returns `null` (Supabase env unset), throw `PrivateStateError({ code: "missing_config" })`. The wrapper does not query Supabase itself — middleware has already resolved `Astro.locals.user` — but it guarantees every downstream helper receives a non-null `userId` typed as `string`.

#### 4. Climb helpers

**File**: `src/lib/private-state/climbs.ts`

**Intent**: Provide the typed climb I/O surface S-04 / S-05 will graft onto: list a user's climbs ordered by date, list climbs for one route (per-route "have I climbed this?"), create a climb (with route validation), and delete a climb by id.

**Contract**: Export four functions, all taking a `PrivateStateClient` from `./client`:

- `listClimbs(client, options?)` → `Promise<UserClimbWithRoute[]>` — `select * from public.climbs where user_id = $1 order by climbed_on desc, created_at desc`. Hydrates each row's `routeId` against `@/lib/catalog`'s route list; honors `options.includeOrphans` (default drops rows with no matching route).
- `listClimbsByRoute(client, routeId)` → `Promise<UserClimb[]>` — for per-route indicators; no hydration needed.
- `createClimb(client, input)` → `Promise<UserClimb>` — calls `validateRouteId(input.routeId)` first; throws `PrivateStateError({ code: "unknown_route", context: { routeId } })` if the catalog has no matching route. Inserts a row with `user_id = client.userId`, `route_id = input.routeId`, `climbed_on = input.climbedOn`, `note = input.note ?? null`. Returns the inserted row mapped into `UserClimb`.
- `deleteClimb(client, id)` → `Promise<void>` — deletes `where id = $1 and user_id = client.userId`. RLS already enforces user scoping; the extra `user_id` filter makes the intent explicit and lets the helper distinguish "row not found" from "RLS denied" (both produce the same Supabase result; the helper throws `PrivateStateError({ code: "not_found" })` when zero rows are affected).

Internal helper `validateRouteId(routeId)`: imports `listRoutes` from `@/lib/catalog`, returns the matching `CatalogRoute` or throws `unknown_route`. The catalog cache absorbs the cost.

#### 5. Project helpers

**File**: `src/lib/private-state/projects.ts`

**Intent**: Provide the typed projects I/O surface S-06 will graft onto: list a user's projects, check whether a route is on the projects list, add a project (with route validation and duplicate guarding), and remove a project by id.

**Contract**: Export four functions mirroring the climb set:

- `listProjects(client, options?)` → `Promise<UserProjectWithRoute[]>` — order by `created_at desc`; same orphan-handling as climbs.
- `isRouteOnProjects(client, routeId)` → `Promise<boolean>` — for the per-route "on projects list?" indicator.
- `addProject(client, input)` → `Promise<UserProject>` — validate route id, then insert; if Supabase returns a unique-violation (`23505`), translate into `PrivateStateError({ code: "duplicate_project", context: { routeId } })` rather than leaking the Postgres error.
- `removeProject(client, id)` → `Promise<void>` — same not-found discipline as `deleteClimb`.

#### 6. Module test README

**File**: `src/lib/private-state/__tests__/README.md`

**Intent**: Satisfy the AGENTS.md module-structure rule (every module has `__tests__/`) while acknowledging no test runner is configured.

**Contract**: Document the intended future coverage — RLS round-trip (user A cannot read user B), unknown-route rejection on writes, duplicate-project translation, orphan hydration with and without `includeOrphans`, not-found vs forbidden distinction for deletes, and the unauthenticated client rejection. Cross-reference `src/lib/catalog/__tests__/README.md` as the precedent.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate cleanly: `npx astro sync`
- Root lint (type-checked) passes: `npm run lint`
- Production build passes without requiring any new env entries: `npm run build`

#### Manual Verification:

- `src/lib/catalog/strapi.client.ts` declares `DEFAULT_PAGE_SIZE = 1000`; an existing catalog smoke read (`/catalog-smoke/regions`) still renders the full region list without truncation diagnostics.
- Importing `@/lib/private-state` from a React island raises a server-only import error during build or at dev-time (or is otherwise visibly forbidden — e.g. the developer is reminded by the module header comment).
- Calling `createPrivateStateClient(headers, cookies, null)` throws `PrivateStateError({ code: "unauthenticated" })`.
- Calling `createClimb({ routeId: "definitely-not-a-real-document-id", climbedOn: "2026-05-31" })` throws `PrivateStateError({ code: "unknown_route" })`.
- Calling `addProject` twice with the same `routeId` for the same user produces `PrivateStateError({ code: "duplicate_project" })` on the second call (translated from Postgres `23505`).
- `listClimbs` with `includeOrphans: false` (default) excludes any rows whose `route_id` is not in `listRoutes()`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Smoke verification surface

### Overview

Add the verification-only `/private-state-smoke` page that round-trips create → read → delete for one climb and one project for the signed-in user, against a real Strapi route id picked from `@/lib/catalog`. The smoke page is the first integration test for the contract end-to-end, and it doubles as the documentation S-04 / S-06 will read when grafting real UI onto the module.

### Changes Required:

#### 1. Protect the smoke route in middleware

**File**: `src/middleware.ts`

**Intent**: Ensure unauthenticated visitors are redirected to `/auth/signin` before the smoke page renders — the middleware redirect is the first line of defense, RLS the second.

**Contract**: Add `"/private-state-smoke"` to the `PROTECTED_ROUTES` array (`src/middleware.ts:4`). No other middleware change is needed; `Astro.locals.user` is already attached for every request.

#### 2. Declare the write-gate env flag

**File**: `astro.config.mjs`

**Intent**: Wire the production write-pollution guard (`SMOKE_WRITES_ENABLED`) into Astro's typed env so the smoke page reads it via `astro:env/server` like every other secret.

**Contract**: Extend the existing `env.schema` block (`astro.config.mjs:17-24`) with:

```js
SMOKE_WRITES_ENABLED: envField.string({ context: "server", access: "secret", optional: true }),
```

No other config change. The flag is intentionally a `string` (not `boolean`) to match the existing schema style and avoid a special-cased adapter. Smoke page logic treats the literal value `"true"` as enabled; anything else (including `undefined`) is disabled.

#### 3. Smoke page

**File**: `src/pages/private-state-smoke.astro`

**Intent**: Provide a small visual verification page that proves the F-02 contract works end-to-end — write a climb, write a project, read them back hydrated against the catalog, optionally clean up — without becoming any part of the eventual climber UX.

**Contract**: Server-rendered Astro page. On `GET` with no query params:

1. Resolve `Astro.locals.user` (guaranteed non-null by middleware).
2. Read `SMOKE_WRITES_ENABLED` from `astro:env/server`. If the value is not the literal string `"true"`, render a Polish diagnostic ("Smoke jest wyłączony w tym środowisku — ustaw `SMOKE_WRITES_ENABLED=true` w `.dev.vars`, aby uruchomić test") and return immediately — no Supabase or Strapi calls.
3. Check `configStatuses` from `@/lib/config-status`; if Supabase or Strapi is unconfigured, render the same Polish diagnostic shape `/catalog-smoke/regions` uses and return without writing anything.
4. Construct a `PrivateStateClient` via `createPrivateStateClient(...)`.
5. Read `listRoutes()` and `listCrags()` from `@/lib/catalog` in parallel. If `listRoutes()` returns zero, render a Polish diagnostic "No published routes available to test against" and return. The crag list is used for name hydration in step 8 — a missing crag for the smoke route is non-fatal (fall back to `cragSlug`).
6. Pick the first published route (`routes[0]`) as the smoke target. Build a `Map<cragId, CatalogCrag>` from `listCrags()` once for the render step.
7. Inside a `try`, call `createClimb({ routeId, climbedOn: today (UTC, ISO date) })` and `addProject({ routeId })`. Tolerate the `duplicate_project` error (the operator may already have one) — the existing project is still proof.
8. Read `listClimbs(client)` and `listProjects(client)`, then render a Polish summary table: the smoke route's `name`, `grade`, and crag name (`cragsById.get(route.cragId)?.name ?? route.cragSlug ?? "—"`), the inserted climb's id/date, the inserted project's id/created_at, plus the full hydrated list lengths.
9. Render a cleanup link (`?cleanup=1`) and a "what this proves" Polish paragraph.

On `GET ?cleanup=1`, the same write-gate check runs first; with the gate disabled, the page renders the same disabled-environment diagnostic and performs no deletes. With the gate enabled, the page enumerates every row belonging to the current user — explicitly via `listClimbs(client, { includeOrphans: true })` and `listProjects(client, { includeOrphans: true })` so that **orphan rows are not silently skipped** — and iterates `deleteClimb(client, row.id)` / `removeProject(client, row.id)`. Cleanup is scoped to `client.userId`; RLS prevents collateral. A confirmation message reports the counts of deleted climbs and projects (orphans included).

Errors thrown from the module surface as inline Polish diagnostics keyed by `PrivateStateError.code` (same vocabulary as `CatalogErrorAlert`): `unauthenticated` → 401-flavored message; `missing_config` → reuses `configStatuses`; `unknown_route` → "Strapi nie zwrócił żadnej drogi pod tym `documentId`" with the offending id; `upstream_error` → generic Polish error with context. The smoke page itself never throws — uncaught errors are wrapped and rendered.

#### 4. Update private-state index header

**File**: `src/lib/private-state/index.ts`

**Intent**: Once the smoke page exists, the module header should point readers at it as the canonical demo of the contract.

**Contract**: Add a one-line "Verified end-to-end via `src/pages/private-state-smoke.astro`" reference in the existing module header comment. No code change.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate after the new page: `npx astro sync`
- Root lint passes: `npm run lint`
- Production build passes: `npm run build`
- Pre-commit hook (`lint-staged`) accepts all new files unchanged.

#### Manual Verification:

- A signed-out visitor opening `/private-state-smoke` is redirected to `/auth/signin` by middleware (no server-side leak of private data).
- A signed-in user with valid Supabase + Strapi config and at least one published route opens `/private-state-smoke` and sees: the smoke route's name / grade / crag name (hydrated from `listCrags()`; falls back to `cragSlug` if the crag is unavailable), an inserted-climb summary, an inserted-project summary, the total climb count, the total project count, and a cleanup link.
- Clicking the cleanup link removes all climb and project rows for that user; reloading the smoke page re-creates them, proving the write path is idempotent in spirit.
- Orphan-cleanup proof: after running the smoke once, manually flip a climb row's `route_id` to a nonexistent value via Supabase Studio's SQL editor, then click the cleanup link — the orphan row is removed (the smoke page uses `includeOrphans: true` for cleanup so nothing is silently skipped).
- Opening `/private-state-smoke` in a second browser as a different signed-in user shows that user's own rows only — never user A's. Confirmed by user A's row counts being unchanged after user B's smoke run.
- If `SUPABASE_URL` / `SUPABASE_KEY` are unset locally, the page renders the existing Supabase Polish missing-config message instead of crashing.
- If `STRAPI_API_URL` / `STRAPI_API_TOKEN` are unset locally, the page renders the existing Strapi Polish missing-config message and writes nothing.
- If the Strapi catalog has zero published routes, the page renders the Polish "no published routes" diagnostic and writes nothing.
- With `SMOKE_WRITES_ENABLED` unset (deployed default), visiting `/private-state-smoke` as a signed-in user renders the Polish "smoke is disabled in this environment" diagnostic and performs zero Supabase reads or writes (verified by row counts in Studio being unchanged before and after the visit). The same is true for `?cleanup=1`.
- With `SMOKE_WRITES_ENABLED=true` in `.dev.vars`, the smoke page runs the full round-trip described above.
- Browser devtools and rendered HTML do not expose `SUPABASE_KEY`, `STRAPI_API_TOKEN`, or `SMOKE_WRITES_ENABLED`.
- The smoke page is clearly treated as verification-only — no link from public catalog navigation or the dashboard.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering F-02 complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No automated test runner is configured (matches F-01).
- Future unit coverage is recorded in `src/lib/private-state/__tests__/README.md`:
  - Row-level mapping (snake_case → camelCase) for `climbs` and `projects`.
  - Validation: `createClimb` / `addProject` reject unknown `routeId` with `PrivateStateError({ code: "unknown_route" })`.
  - Duplicate-project translation: Postgres `23505` → `PrivateStateError({ code: "duplicate_project" })`.
  - Orphan hydration: `listClimbs` drops vs flags orphans depending on `includeOrphans`.
  - Authenticated client gate: `createPrivateStateClient(_, _, null)` throws `unauthenticated`.
  - Not-found path on zero-rows-affected delete for `deleteClimb` / `removeProject` (RLS makes "row owned by another user" indistinguishable from "row does not exist"; both throw `not_found`).

### Integration Tests:

- `npx supabase db reset` to verify migration applies cleanly to a fresh DB.
- `npx astro sync`, `npm run lint`, `npm run build` to verify the module contract holds.
- Smoke page round-trip (Phase 3 manual steps) verifies the end-to-end RLS + cross-source identity + module wiring path.

### Manual Testing Steps:

1. Run `npx supabase start` (Docker required) and `npx supabase db reset` against the local Supabase project; confirm the migration applies cleanly.
2. In Supabase Studio, confirm `public.climbs` and `public.projects` exist with the documented columns, indexes, RLS = ON, and eight per-operation policies for `authenticated`.
3. Create user A and user B via the existing `/auth/signup` form (email+password); for each, copy the access token from devtools (Cookie: `sb-...-auth-token`) or sign in in two browsers.
4. As user A, insert a climb into `public.climbs` via Studio's authenticated SQL editor; as user B, run `select * from public.climbs` and confirm zero rows.
5. As user A, sign in in the running Astro app and visit `/private-state-smoke`; confirm the page renders inserted climb + project against a real Strapi route, with hydrated route name / grade / crag.
6. As user B in a second browser, visit `/private-state-smoke`; confirm only user B's rows appear, and user A's row counts (in Studio) are unchanged.
7. Click the cleanup link as each user; confirm only their own rows are removed.
8. Visit `/private-state-smoke` while signed out; confirm the middleware redirect to `/auth/signin`.
9. Unset `SUPABASE_KEY` (or `STRAPI_API_TOKEN`) locally; confirm the smoke page renders the appropriate Polish missing-config diagnostic and writes nothing.

## Performance Considerations

The private-state read path is per-user and bounded by the size of that user's history (small at v1: ~tens of rows per user). The `climbs (user_id, climbed_on desc, created_at desc)` index covers the dominant FR-010 query (history page) and the `projects (user_id, created_at desc)` index covers the FR-013 query.

The write path adds one `@/lib/catalog` `listRoutes()` call for `route_id` validation. The Cache API entry from F-01 (1 h TTL, single shared key per resource) absorbs this — at steady state, validation costs zero extra Strapi requests beyond the existing catalog page traffic.

`listRoutes()`'s `DEFAULT_PAGE_SIZE` is bumped from 100 to 1000 in Phase 2 (see "Cross-source identity (load-bearing)"). This covers v1 (Poland: no crag exceeds ~1000 routes). The 1000-row ceiling is itself a known limit: once total published routes approach 1000 (i.e. catalog coverage broadens beyond the current single-country scope, or Strapi server config refuses pageSize above 1000), the catalog client must switch to a paginating loop. Recorded as a v2 follow-up in `src/lib/private-state/__tests__/README.md` and `src/lib/catalog/__tests__/README.md`, not solved now.

Hydration on the read path (`listClimbs` joining against the in-memory catalog) is O(climbs × routes) at the v1 scale; both sides are small (tens of climbs per user, tens to low hundreds of catalog routes). If the catalog grows past a few thousand routes, the hydration step should be reworked to a Map lookup; recorded as a v2 follow-up in `src/lib/private-state/__tests__/README.md`, not solved now.

## Migration Notes

This is a forward-only migration on a greenfield Supabase project. Rollback is `npx supabase db reset` followed by removing the migration file; no data needs to be preserved.

Once production Supabase carries real climb / project rows, schema changes follow the same `YYYYMMDDHHmmss_short_description.sql` discipline AGENTS.md requires; future plans must run `npx supabase db push` against the production project after the migration is reviewed.

The cross-source identity contract is the lasting invariant: any future change that moves catalog ownership out of Strapi must include a route-id rewrite step for both `public.climbs.route_id` and `public.projects.route_id`. No such migration is in scope here.

## References

- Roadmap entry: `context/foundation/roadmap.md` (F-02, lines 77–88).
- PRD: `context/foundation/prd.md` (Access Control, NFR privacy, FR-006, FR-009 – FR-014).
- F-01 archive (canonical identity contract precedent): `context/archive/2026-05-26-catalog-content-contract/plan.md`.
- Repo rules: `AGENTS.md`, `context/AGENTS.md`.
- Existing Supabase client: `src/lib/supabase.ts`.
- Existing middleware (route protection): `src/middleware.ts`.
- Existing catalog module (server-only library precedent): `src/lib/catalog/index.ts`, `src/lib/catalog/types.ts`, `src/lib/catalog/strapi.client.ts`.
- Existing config-status helper: `src/lib/config-status.ts`.
- Astro env schema: `astro.config.mjs:17-24`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Supabase schema + RLS migration

#### Automated

- [x] 1.1 Migration applies cleanly to a fresh local Supabase: `npx supabase db reset` — f756ccf
- [x] 1.2 Root lint still passes (no TS changes, but safety check): `npm run lint` — f756ccf
- [x] 1.3 Root production build still passes: `npm run build` — f756ccf

#### Manual

- [x] 1.4 After `npx supabase db reset`, both `public.climbs` and `public.projects` exist with the columns, indexes, and `unique (user_id, route_id)` constraint listed above. — f756ccf
- [x] 1.5 Both tables show `rls = on` in Supabase Studio's table editor. — f756ccf
- [x] 1.6 All eight per-operation policies (4 per table) appear in Studio with `auth.uid() = user_id` expressions and the `authenticated` role. — f756ccf
- [ ] 1.7 Inserting a row into `public.climbs` while signed in as user A, then signing in as user B and running `select * from public.climbs`, returns zero rows for user B.
- [ ] 1.8 User A can `delete` their own row; attempting to `delete` user A's row while signed in as user B returns zero rows affected.
- [ ] 1.9 Cascading delete works: deleting the user from `auth.users` removes all their `climbs` and `projects` rows.

### Phase 2: Private state module

#### Automated

- [x] 2.1 Astro types regenerate cleanly: `npx astro sync`
- [x] 2.2 Root lint (type-checked) passes: `npm run lint`
- [x] 2.3 Production build passes without requiring any new env entries: `npm run build`

#### Manual

- [x] 2.4 `src/lib/catalog/strapi.client.ts` declares `DEFAULT_PAGE_SIZE = 1000`; `/catalog-smoke/regions` still renders the full region list without truncation diagnostics.
- [x] 2.5 Importing `@/lib/private-state` from a React island is visibly forbidden (server-only import error at build / dev-time, or developer is reminded by the module header comment).
- [ ] 2.6 Calling `createPrivateStateClient(headers, cookies, null)` throws `PrivateStateError({ code: "unauthenticated" })`.
- [ ] 2.7 Calling `createClimb({ routeId: "definitely-not-a-real-document-id", climbedOn: "2026-05-31" })` throws `PrivateStateError({ code: "unknown_route" })`.
- [ ] 2.8 Calling `addProject` twice with the same `routeId` for the same user produces `PrivateStateError({ code: "duplicate_project" })` on the second call.
- [ ] 2.9 `listClimbs` with `includeOrphans: false` excludes any rows whose `route_id` is not in `listRoutes()`.

### Phase 3: Smoke verification surface

#### Automated

- [ ] 3.1 Astro types regenerate after the new page: `npx astro sync`
- [ ] 3.2 Root lint passes: `npm run lint`
- [ ] 3.3 Production build passes: `npm run build`
- [ ] 3.4 Pre-commit hook (`lint-staged`) accepts all new files unchanged.

#### Manual

- [ ] 3.5 A signed-out visitor opening `/private-state-smoke` is redirected to `/auth/signin` by middleware.
- [ ] 3.6 A signed-in user with valid Supabase + Strapi config and at least one published route sees the route name / grade / crag, inserted-climb summary, inserted-project summary, totals, and a cleanup link.
- [ ] 3.7 Clicking the cleanup link removes all climb and project rows for that user; reloading the smoke page re-creates them.
- [ ] 3.8 Orphan-cleanup proof: after running the smoke once, manually flip a climb row's `route_id` to a nonexistent value via Studio's SQL editor, then click the cleanup link — the orphan row is removed (cleanup uses `includeOrphans: true`).
- [ ] 3.9 Opening `/private-state-smoke` as a different signed-in user shows only that user's rows; user A's row counts in Studio are unchanged.
- [ ] 3.10 With Supabase env unset locally, the smoke page renders the Polish Supabase missing-config diagnostic and writes nothing.
- [ ] 3.11 With Strapi env unset locally, the smoke page renders the Polish Strapi missing-config diagnostic and writes nothing.
- [ ] 3.12 With zero published Strapi routes, the smoke page renders the Polish "no published routes" diagnostic and writes nothing.
- [ ] 3.13 With `SMOKE_WRITES_ENABLED` unset (deployed default), `/private-state-smoke` renders the disabled-environment diagnostic and performs zero Supabase reads or writes — including for `?cleanup=1`; row counts in Studio are unchanged across the visit.
- [ ] 3.14 With `SMOKE_WRITES_ENABLED=true` in `.dev.vars`, the smoke page runs the full round-trip.
- [ ] 3.15 Browser devtools and rendered HTML do not expose `SUPABASE_KEY`, `STRAPI_API_TOKEN`, or `SMOKE_WRITES_ENABLED`.
- [ ] 3.16 The smoke page is treated as verification-only — no link from public catalog navigation or the dashboard.

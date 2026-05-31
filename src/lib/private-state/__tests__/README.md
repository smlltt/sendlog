# Private-state module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to
satisfy the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`)
and to record the test surface that should be covered once a runner is added —
Vitest is the likely candidate given the Vite/Astro toolchain. See
`src/lib/catalog/__tests__/README.md` for the matching precedent.

End-to-end verification of the contract today is the smoke page added in
Phase 3 of the F-02 plan (`src/pages/private-state-smoke.astro`).

## Mapping (`climbs.ts`, `projects.ts`)

- `public.climbs` row → `UserClimb`: snake_case → camelCase round-trip for
  `routeId`, `climbedOn`, `note`, `createdAt`, `updatedAt`. `note` round-trips
  `null` and arbitrary free-text without a length cap.
- `public.projects` row → `UserProject`: snake_case → camelCase round-trip for
  `routeId`, `createdAt`.
- Hydrated read helpers (`listClimbs`, `listProjects`) attach a
  `route: CatalogRoute | null` field; the non-hydrated `listClimbsByRoute`
  returns `UserClimb[]` with no `route` field.

## Authentication gate (`client.ts`)

- `createPrivateStateClient(headers, cookies, null)` →
  `PrivateStateError("unauthenticated")` synchronously. No Supabase call
  happens.
- Supabase env unset (`createClient` returns `null`) →
  `PrivateStateError("missing_config")`. Verified by clearing
  `SUPABASE_URL` / `SUPABASE_KEY` in `.dev.vars` and re-running the smoke
  page.
- A populated `user` with valid Supabase env returns
  `{ supabase, userId: user.id }`; `userId` is typed as `string`, never
  `null`, by construction.

## Route validation (`validate-route.ts`)

- `validateRouteId("definitely-not-a-real-document-id")` →
  `PrivateStateError("unknown_route", { routeId })`. Asserts that
  `createClimb` and `addProject` reject unknown ids before any Supabase write
  happens.
- `validateRouteId(routeId)` for a published route returns the matching
  `CatalogRoute` (used by callers that want to display name/grade after
  validation).
- Catalog `CatalogError("missing_config")` → `PrivateStateError("missing_config")`;
  any other `CatalogError` (network / 5xx / parse) → `PrivateStateError("upstream_error")`.
- The Cloudflare Cache API entry from F-01 absorbs the cost — at steady state
  this is a zero-extra-Strapi-request integrity check.

## Orphan handling (`listClimbs`, `listProjects`)

- Manually flip a row's `route_id` to a nonexistent value via Supabase Studio
  SQL editor → `listClimbs(client)` (default `includeOrphans: false`) excludes
  the row.
- Same row → `listClimbs(client, { includeOrphans: true })` includes the row
  with `route: null`.
- Same expectations apply to `listProjects`.
- Cleanup callers (e.g. the F-02 smoke page) MUST pass
  `includeOrphans: true` to avoid silently skipping orphan rows.

## Duplicate translation (`projects.ts`)

- Calling `addProject({ routeId })` twice for the same `(user_id, route_id)`
  produces `PrivateStateError("duplicate_project", { routeId })` on the second
  call — translated from Postgres `23505` (`unique_violation`) inside
  `addProject`. Callers never see the raw pg code.

## Not-found vs forbidden (`deleteClimb`, `removeProject`)

- Deleting a row owned by the current user returns void.
- Deleting a row owned by a different user returns
  `PrivateStateError("not_found")`. RLS makes this indistinguishable from
  "row does not exist" — both produce zero rows affected; both throw
  `not_found`. There is no `forbidden` variant. Future code that needs to
  distinguish them must add an explicit ownership pre-check (see
  `types.ts` header comment).
- Deleting a non-existent id returns `PrivateStateError("not_found")` for the
  same reason.

## RLS round-trip (cross-user)

- User A creates a climb via `createClimb(clientA, ...)`.
- `listClimbs(clientB)` returns zero rows for user B (RLS scopes `select`).
- `deleteClimb(clientB, userAClimbId)` throws `PrivateStateError("not_found")`.
- Verified manually via the F-02 smoke page in two browsers.

## Cascading delete (`auth.users.delete`)

- Deleting the user from `auth.users` cascades through both `climbs` and
  `projects` (FK `on delete cascade`); no orphan rows remain.

## Known follow-ups (out of scope for v1)

- The catalog `DEFAULT_PAGE_SIZE = 1000` (bumped in Phase 2 of F-02) is itself
  a known limit. Once total published Strapi routes approach 1000 (catalog
  coverage broadens beyond the current single-country scope, or Strapi server
  config refuses pageSize above 1000), the catalog client must switch to a
  paginating loop and `validateRouteId` must follow the same path.
- Hydration on the read path is O(climbs × routes) at the v1 scale (already
  implemented as a `Map` lookup, but documented here for future scale checks).
- Soft-delete columns / `removed_at` are intentionally absent — PRD FR-011
  specifies hard delete. A future v2 feature that needs undo must introduce a
  separate `climbs_deleted` audit shape rather than retrofit the column.

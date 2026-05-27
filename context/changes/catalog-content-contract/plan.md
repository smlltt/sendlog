# Catalog Content Contract Implementation Plan

## Overview

Define the first stable contract for SendLog catalog content: regions, crags, routes, and the canonical route identity that later public browsing, climb logs, projects, and admin curation will all reference.

The plan keeps Strapi Cloud as the source of truth for curated catalog content and adds only the minimum Astro-side read contract needed to prove the app can read published catalog data safely.

## Current State Analysis

SendLog is an Astro 6 SSR app deployed on Cloudflare Workers, with Supabase auth scaffolding already present. Catalog implementation is absent: there are no region, crag, route, climb, project, or catalog modules in `src/`; no Strapi content types exist under `admin/src/api/`; and no Supabase migrations exist.

The Strapi admin sidecar already exists in `admin/` and is live on Strapi Cloud. Production Strapi runs in `start` mode, so Content-Type Builder is disabled there; schema changes must be created locally in `admin/`, committed, and deployed through the connected Strapi Cloud project.

## Desired End State

After this plan is complete, the repository has a concrete catalog content contract:

- Strapi contains collection types for `region`, `crag`, and `route`.
- A route's canonical app identity is Strapi's stable `documentId`, carried through the Astro mapping layer together with region/crag/route slugs for URLs.
- Crags support name, coordinates, region relation, and an optional photo.
- Routes support name, grade, type, year set, slug, and crag relation.
- Astro has a server-only catalog module that fetches published Strapi data with a secret token, maps it into shared TypeScript types, applies a short TTL cache, and exposes a lightweight regions smoke page for visual verification.

### Key Discoveries:

- Catalog domain code is not present in `src/`; only auth and starter pages exist.
- Strapi is installed under `admin/` at version `5.46.1`, with production deployment already completed through Strapi Cloud.
- `admin/src/api/**` is empty, so all catalog content types are new.
- `SUPABASE_URL` and `SUPABASE_KEY` are the only current root env schema entries; Strapi env entries must be added server-side only.
- `wrangler.jsonc` already has a `SESSION` KV binding and Worker observability, but no Strapi token, catalog cache binding, or catalog env vars.
- The repo requires `@/` imports, structured API errors, zod validation for API routes, `const prerender = false` on API routes, and module folders with `index.ts`, `types.ts`, and `__tests__/`.

## What We're NOT Doing

- Building the full public catalog browsing UI from S-01.
- Building admin curation workflows beyond Strapi's native admin UI.
- Adding Supabase catalog tables or catalog migrations.
- Creating climb logs, project lists, or private user state.
- Adding topo sectors, walls, route ordering, or full source/provenance records.
- Adding webhook-based cache invalidation.
- Exposing Strapi directly to anonymous browser clients.
- Adding a test runner.

## Implementation Approach

Use Strapi as the canonical catalog source of truth. Keep catalog reads server-side in Astro so the Strapi API token never reaches the browser. Map Strapi response shapes into local TypeScript contracts before any UI or later feature consumes them.

Route identity is the most important invariant: private app state added later must reference the Strapi route `documentId`, not a copied route record or mutable slug-only identity. Slugs still exist for human-readable URLs, but slugs are routing metadata, not canonical identity.

## Critical Implementation Details

### Timing & Lifecycle

Strapi Cloud production disables schema editing through Content-Type Builder. Create or update content types locally with `cd admin && npm run develop`, commit the generated files under `admin/src/api/**`, and let Strapi Cloud rebuild from Git.

### Catalog Locales

Enable Strapi i18n in this foundation slice. Polish (`pl`) is the default catalog locale; English (`en`) exists as a secondary locale for future expansion. Catalog `name` fields are localized, while `slug` fields stay shared/non-localized so URLs and route references remain stable across locales.

### State Sequencing

Create the Strapi schema before wiring Astro reads. The Astro catalog module should map published Strapi responses into local types rather than allowing Strapi's raw response shape to leak into pages or future route-log code.

### User Experience Spec

The visual proof for F-01 is intentionally small: a regions smoke page that lists published region names from Strapi. It is not the final catalog browse experience.

### Operator Notes

- Issue a Strapi API token in Strapi Cloud (read-only access to published catalog content types).
- Store production secrets on the Worker: `npx wrangler secret put STRAPI_API_URL` and `npx wrangler secret put STRAPI_API_TOKEN`. Never expose the token in browser code or committed config.
- Local dev uses the same variable names in `.dev.vars` (gitignored).

## Phase 1: Strapi Catalog Schema

### Overview

Define the curated catalog model in Strapi so the admin side has a real source of truth for regions, crags, and routes.

### Changes Required:

#### 1. Region Collection Type

**File**: `admin/src/api/region/content-types/region/schema.json`

**Intent**: Add the top-level public catalog grouping that S-01 will later browse. Regions are intentionally lightweight for v1 because the PRD launches with one Polish region.

**Contract**: Collection type with localized `name` and shared/non-localized globally unique `slug`; `slug` is required. Region has a one-to-many relation to crags.

#### 2. Crag Collection Type

**File**: `admin/src/api/crag/content-types/crag/schema.json`

**Intent**: Add the canonical crag entity that holds location and optional visual context for route lists and map navigation.

**Contract**: Collection type with localized required `name`, shared/non-localized globally unique required `slug`, numeric latitude/longitude fields, optional `photo` media field, required many-to-one relation to region, and one-to-many relation to routes.

#### 3. Route Collection Type

**File**: `admin/src/api/route/content-types/route/schema.json`

**Intent**: Add canonical route records that later private climb logs and projects can reference without duplicating route identity per user.

**Contract**: Collection type with localized required `name`, shared/non-localized globally unique required `slug`, required `grade`, required `type`, optional or nullable `yearSet`, and required many-to-one relation to crag. Strapi `documentId` is the canonical route identity consumed by Astro and later Supabase private state; slugs are routing metadata only.

#### 4. Strapi Locale Configuration

**File**: `admin/config/plugins.ts`

**Intent**: Configure the catalog schema for Polish-first content while keeping an English locale available before production catalog entries exist.

**Contract**: Enable/configure Strapi i18n with Polish (`pl`) as the default locale and English (`en`) as a secondary locale. Schema fields follow the locale contract above: `name` is localized; `slug` is shared/non-localized.

#### 5. Strapi Permissions & Publication Workflow

**File**: `admin/src/api/{region,crag,route}/**`

**Intent**: Keep catalog content admin-curated while making published content readable by the Astro Worker through a server-side token.

**Contract**: Published catalog records are readable through Strapi's Content API when the request carries the configured API token. Draft/unpublished entries must not appear in Astro catalog reads.

### Success Criteria:

#### Automated Verification:

- Strapi admin builds successfully: `cd admin && npm run build`
- Strapi local development starts without schema errors: `cd admin && npm run develop`
- Root lint still passes after generated schema files are present: `npm run lint`

#### Manual Verification:

- Local Strapi admin shows Region, Crag, and Route collection types.
- A region can be created and published.
- A crag can be created with coordinates, optional photo, and a region relation.
- A route can be created with name, grade, type, year set, and a crag relation.
- Polish is the default Strapi catalog locale, English is available as a secondary locale, and slugs remain shared across locales.
- Production Strapi deploy completes after committing schema files.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Astro Catalog Read Contract

### Overview

Add the server-only Astro contract that reads published Strapi catalog data, maps it into local app types, and caches reads with a short TTL.

### Changes Required:

#### 1. Server Env Schema

**File**: `astro.config.mjs`

**Intent**: Add server-only Strapi configuration so the Worker can read published catalog data without exposing secrets to client code.

**Contract**: Add optional server env fields `STRAPI_API_URL` and `STRAPI_API_TOKEN` via `envField.string({ context: "server", access: "secret", optional: true })`, matching the existing Supabase env pattern.

#### 2. Local Env Examples

**File**: `.env.example`

**Intent**: Document the Strapi values required for catalog smoke testing while keeping real secrets out of the repository.

**Contract**: Add placeholder entries for `STRAPI_API_URL` and `STRAPI_API_TOKEN`. The API token is server-only and must not be read from client code.

#### 3. Config Status

**File**: `src/lib/config-status.ts`

**Intent**: Surface missing Strapi configuration consistently with the existing Supabase status pattern.

**Contract**: Add Strapi to the `configStatuses` array so local/dev smoke pages can tell the operator when catalog configuration is missing.

#### 4. Catalog Module Structure

**File**: `src/lib/catalog/index.ts`

**Intent**: Create the module entrypoint for catalog reads that future pages and API routes can import.

**Contract**: Export typed catalog read functions and public catalog types from the module root. Use absolute imports from `@/` when importing this module elsewhere.

#### 5. Catalog Types

**File**: `src/lib/catalog/types.ts`

**Intent**: Define the app-facing catalog contract independently from raw Strapi response shapes.

**Contract**: Include `CatalogRegion`, `CatalogCrag`, and `CatalogRoute`. `CatalogRoute` must include canonical `id` sourced from Strapi `documentId`, plus route `slug`, `name`, `grade`, `type`, `yearSet`, and parent crag/region identifiers needed by later slices. `CatalogCrag.photo` is `{ url: string; width?: number; height?: number } | null` (absolute Strapi Cloud CDN URL; no transforms in v1).

#### 6. Strapi Client and Mapper

**File**: `src/lib/catalog/strapi.client.ts`

**Intent**: Keep Strapi fetch, auth header construction, response checking, and raw-to-app mapping in one server-only place.

**Contract**: Use Strapi v5 REST (not GraphQL) for published catalog reads. Request `locale=pl` by default for localized `name` fields. Consume Strapi v5's flat response shape directly (no v4 `.attributes` wrapper). Provide functions for at least listing published regions; document explicit `populate` query strings when nested reads are needed. The client throws typed errors internally; only API routes map failures to `{ error: { code, message, context } }`. The smoke page renders inline diagnostics instead of JSON errors.

#### 7. Catalog Cache

**File**: `src/lib/catalog/cache.ts`

**Intent**: Protect Strapi Cloud Free quota (~2,500 req/month) and improve mobile perceived latency by caching public catalog reads. Match the cache window to actual content cadence (rare edits) rather than near-real-time freshness.

**Contract**: Use Cloudflare's native Cache API (`caches.default`) as the v1 backend, keyed by the upstream Strapi request URL. Apply a 1-hour TTL (3600s) as the default — catalog content changes rarely and the PRD already accepts "a few minutes of staleness after admin edits." Expose a cache-bypass mechanism for local verification: when `STRAPI_API_URL` points at a localhost Strapi or when the catalog read is called with an explicit `{ bypassCache: true }` option, skip the Cache API lookup. Do not introduce a new wrangler KV binding in this phase and do not add webhook invalidation. Module-level memoization may sit in front of the Cache API as a per-isolate optimization but is not the durable cache. Stale-while-revalidate is a known follow-up; record it in `__tests__/README.md` but do not build it now.

#### 8. Module Test Directory

**File**: `src/lib/catalog/__tests__/README.md`

**Intent**: Satisfy the repo module-structure rule while acknowledging that no test runner is configured yet.

**Contract**: Document the expected future test coverage for mapping, missing config, failed Strapi responses, and cache behavior.

### Success Criteria:

#### Automated Verification:

- Astro types are regenerated: `npx astro sync`
- Root lint passes: `npm run lint`
- Production build passes without requiring Strapi secrets in CI: `npm run build`

#### Manual Verification:

- Missing Strapi env values produce a clear local configuration warning rather than a crash.
- With valid Strapi URL and API token set locally, the catalog read helper returns published regions.
- Draft/unpublished Strapi content is not returned by the Astro catalog helper.
- Strapi API token is not referenced from client-side React or browser code.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Smoke Route & Verification

### Overview

Add a lightweight visual route to prove the Astro Worker can read published Strapi regions through the new catalog contract.

### Changes Required:

#### 1. Regions Smoke Page

**File**: `src/pages/catalog-smoke/regions.astro`

**Intent**: Provide a small visual verification page that lists published regions from Strapi without becoming the final catalog browsing UI.

**Contract**: Server-render a list of published region names and slugs using the catalog module. If Strapi config is missing or the fetch fails, show a clear diagnostic state suitable for local verification.

#### 2. Optional Wrangler Env Documentation

**File**: `wrangler.jsonc`

**Intent**: Add only non-secret Strapi configuration if the implementation needs Worker-visible static values.

**Contract**: Secret values stay out of `wrangler.jsonc`. If a Strapi base URL is added there, it must not include credentials.

### Success Criteria:

#### Automated Verification:

- Astro types are regenerated after page additions: `npx astro sync`
- Root lint passes: `npm run lint`
- Root production build passes: `npm run build`
- Strapi admin build still passes: `cd admin && npm run build`

#### Manual Verification:

- A published region created in Strapi appears on `/catalog-smoke/regions`.
- Editing a region in Strapi appears on the smoke page when cache is bypassed (local Strapi URL or `bypassCache` option); without bypass, edits land after the 1-hour TTL expires.
- Unpublished regions do not appear on the smoke page.
- Browser devtools and rendered HTML do not expose the Strapi API token.
- The smoke route is clearly treated as verification-only, not final public navigation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering F-01 complete. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No automated test runner is configured.
- Record intended future tests in `src/lib/catalog/__tests__/README.md`.
- Future test coverage should focus on Strapi response mapping, canonical route ID mapping, missing config behavior, error response normalization, and cache TTL behavior.

### Integration Tests:

- Use `cd admin && npm run build` to verify Strapi schema integrity.
- Use `npx astro sync`, `npm run lint`, and `npm run build` to verify the Astro contract.
- Use local Strapi with published sample content plus `/catalog-smoke/regions` to verify the end-to-end read path.

### Manual Testing Steps:

1. Start local Strapi from `admin/` and confirm Region, Crag, and Route content types exist.
2. Create and publish one region, one crag with coordinates and optional photo, and one route attached to that crag.
3. Configure local Astro Strapi URL and API token.
4. Start the Astro app and open `/catalog-smoke/regions`.
5. Confirm the published region appears.
6. Change the region name in Strapi and confirm the smoke page updates (cache is bypassed against a localhost Strapi, or use the `bypassCache` option). Without bypass, edits become visible after the 1-hour TTL.
7. Unpublish a region and confirm it disappears from the smoke page under the same bypass conditions.

## Performance Considerations

The catalog read path should assume Strapi Cloud is an external service with a small Free-plan request quota (~2,500 req/month). Public catalog reads use a 1-hour Cache API TTL from the first implementation, sized for actual content cadence (rare admin edits) rather than near-real-time freshness, with webhook invalidation explicitly out of scope. Worst-case Strapi traffic per endpoint at this TTL stays comfortably under the Free quota. The smoke route can tolerate up to an hour of stale content; manual edit-visibility checks rely on the cache-bypass option in Phase 2 #7.

## Migration Notes

No Supabase migration is part of F-01. Later private state tables should store the Strapi route `documentId` as the canonical route reference unless a future migration intentionally changes catalog ownership.

Strapi schema changes must be committed under `admin/src/api/**` and deployed through the connected Strapi Cloud project. Existing Strapi content, once entered in production, is not rolled back automatically by code rollback.

## References

- Roadmap item: `context/foundation/roadmap.md`
- PRD catalog and route identity requirements: `context/foundation/prd.md`
- Main app infrastructure: `context/foundation/infrastructure.md`
- Admin CMS infrastructure: `context/foundation/infrastructure-admin.md`
- Strapi deployment status: `context/changes/deployment/admin-deployment-plan.md`
- Repo rules: `AGENTS.md`
- Existing Supabase client: `src/lib/supabase.ts`
- Existing middleware: `src/middleware.ts`
- Strapi admin package: `admin/package.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `- <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strapi Catalog Schema

#### Automated

- [x] 1.1 Strapi admin builds successfully: `cd admin && npm run build` — 976a346
- [x] 1.2 Strapi local development starts without schema errors: `cd admin && npm run develop` — 976a346
- [x] 1.3 Root lint still passes after generated schema files are present: `npm run lint` — 976a346

#### Manual

- [x] 1.4 Local Strapi admin shows Region, Crag, and Route collection types. — 976a346
- [x] 1.5 A region can be created and published. — 976a346
- [x] 1.6 A crag can be created with coordinates, optional photo, and a region relation. — 976a346
- [x] 1.7 A route can be created with name, grade, type, year set, and a crag relation. — 976a346
- [x] 1.8 Polish is the default Strapi catalog locale, English is available as a secondary locale, and slugs remain shared across locales. — 976a346
- [x] 1.9 Production Strapi deploy completes after committing schema files. — 976a346

### Phase 2: Astro Catalog Read Contract

#### Automated

- [x] 2.1 Astro types are regenerated: `npx astro sync` — 4d167bd
- [x] 2.2 Root lint passes: `npm run lint` — 4d167bd
- [x] 2.3 Production build passes without requiring Strapi secrets in CI: `npm run build` — 4d167bd

#### Manual

- [x] 2.4 Missing Strapi env values produce a clear local configuration warning rather than a crash. — 4d167bd
- [x] 2.5 With valid Strapi URL and API token set locally, the catalog read helper returns published regions. — 4d167bd
- [x] 2.6 Draft/unpublished Strapi content is not returned by the Astro catalog helper. — 4d167bd
- [x] 2.7 Strapi API token is not referenced from client-side React or browser code. — 4d167bd

### Phase 3: Smoke Route & Verification

#### Automated

- [x] 3.1 Astro types are regenerated after page additions: `npx astro sync` — bcb5ada
- [x] 3.2 Root lint passes: `npm run lint` — bcb5ada
- [x] 3.3 Root production build passes: `npm run build` — bcb5ada
- [x] 3.4 Strapi admin build still passes: `cd admin && npm run build` — bcb5ada

#### Manual

- [x] 3.5 A published region created in Strapi appears on `/catalog-smoke/regions`. — bcb5ada
- [x] 3.6 Editing a region in Strapi appears on the smoke page when cache is bypassed (local Strapi or `bypassCache` option); without bypass, edits land after the 1-hour TTL. — bcb5ada
- [x] 3.7 Unpublished regions do not appear on the smoke page. — bcb5ada
- [x] 3.8 Browser devtools and rendered HTML do not expose the Strapi API token. — bcb5ada
- [x] 3.9 The smoke route is clearly treated as verification-only, not final public navigation. — bcb5ada

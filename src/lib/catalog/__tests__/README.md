# Catalog module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to satisfy
the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`) and to
record the test surface that should be covered once a runner is added — Vitest
is the likely candidate given the Vite/Astro toolchain.

## Mapping (`strapi.client.ts`)

- Strapi v5 region record → `CatalogRegion`, including `id === documentId`.
- Strapi v5 crag record → `CatalogCrag`:
  - `photos` array populated → `CatalogCrag.photos` mirrors entries in upstream order, each with `url`, optional numeric `width`/`height`, and `alt` sourced from `alternativeText` (`null` when absent or blank).
  - `photos` absent / `null` / `[]` upstream → `CatalogCrag.photos === []` (always an array, never `null`).
  - Entries missing a `url` are filtered out by the mapper.
  - Photo `url` is always absolute: upstream `http(s)://...` URLs (Strapi Cloud / Cloudinary) pass through; upstream relative `/uploads/...` URLs (default local disk provider) are prefixed with `STRAPI_API_URL` so consumers can render images regardless of environment.
  - `region` populated → `regionId` / `regionSlug` non-null.
  - `region` absent → both `regionId` and `regionSlug` are `null`.
- Strapi v5 route record → `CatalogRoute`:
  - Canonical `id` is sourced from `documentId`, never from the numeric `id`.
  - `yearSet` round-trips an integer, but `undefined`/`null` upstream → `null`.
  - Nested `crag.region` populates both crag and region identifiers.
- Polish (`pl`) locale is requested by default; overriding `options.locale`
  reaches the upstream request.
- `populate` query string is built from the explicit `populate` array argument
  (no implicit deep populate).

### Slug helpers

- `getRegionBySlug("<region-slug>")` → returns the matching region or `null`; does NOT fetch upstream beyond the single shared `listRegions()` call.
- `listCragsByRegion("<region-slug>")` → returns all crags whose `regionSlug` matches; preserves upstream `name:asc` order; returns `[]` when the region has no published crags.
- `getCragBySlug("<region-slug>", "<crag-slug>")` → matches both region and crag slug; mismatched region returns `null` even if the crag slug exists under another region.
- `listRoutesByCrag(cragId)` → filters by `cragId` (Strapi `documentId`), preserves upstream `name:asc` order.
- All four forward `bypassCache` and `locale` to the underlying list call; cache key is identical to the list call's.

## Map mapper (`map.ts`)

- `toCragMapPins([], [])` → `[]`.
- Crag with `regionSlug === null` → filtered out; emits `console.warn({ slug, reason: "missing_region_slug" })`.
- Crag with `latitude === NaN` or non-finite latitude → filtered out; emits `console.warn({ slug, reason: "invalid_latitude" })`.
- Crag with `longitude === NaN` or non-finite longitude → filtered out; emits `console.warn({ slug, reason: "invalid_longitude" })`.
- Crag with latitude outside `[-90, 90]` (e.g. `91`, `-91`) → filtered out as `invalid_latitude`.
- Crag with longitude outside `[-180, 180]` (e.g. `181`, `-181`) → filtered out as `invalid_longitude`.
- Region-name resolution: a crag whose `regionSlug` matches an entry in the `regions` argument resolves `regionName` to that region's `name`.
- Region-name fallback: a crag whose `regionSlug` has no matching region falls back to using the slug itself as `regionName`.
- `href` is constructed as `/regiony/${regionSlug}/${slug}` exactly (no URL-encoding; admins enter URL-safe slugs in Strapi).
- Upstream order is preserved across the filter: valid pins appear in the same relative order as their source crags.
- Pure function: no I/O, no mutation of inputs; the only side effect is the diagnostic `console.warn` on dropped records.

## Errors / config (`strapi.client.ts`)

- Missing `STRAPI_API_URL` or `STRAPI_API_TOKEN` → `CatalogError("missing_config", ...)`.
- 401 / 403 upstream → `CatalogError("unauthorized", ...)`.
- 5xx or other non-OK status → `CatalogError("upstream_error", ...)`.
- Non-JSON response → `CatalogError("upstream_error", ...)`.
- `fetch` rejection (DNS, TCP, etc.) → `CatalogError("network_error", ...)`.
- `CatalogError.context` carries `status` and the upstream URL when applicable.

## Cache (`cache.ts`)

- Default TTL is `CATALOG_CACHE_TTL_SECONDS` (3600s).
- `caches.default` unavailable (Node, build-time prerender) → live fetch, no
  cache write.
- `options.bypassCache === true` skips both cache lookup AND cache write.
- `isLocalStrapi("http://localhost:1337")` is `true`; `.local` and
  `127.0.0.1` / `0.0.0.0` are also treated as local.
- Localhost `STRAPI_API_URL` bypasses cache.
- Cache key is the upstream request URL (including query string), wrapped in
  a `GET Request`.
- Cache write failures (size limit, runtime issue) do not propagate to the
  caller — best-effort only.

## Known follow-ups (out of scope for v1)

- Stale-while-revalidate: serve the cached payload immediately while
  revalidating in `ctx.waitUntil`. Requires plumbing the request `ctx` through
  the catalog read API.
- Webhook-based cache invalidation from Strapi → Cloudflare on publish/update.
- KV-backed durable cache shared across isolates (Cache API is per-colocation).
- Memoization in front of the Cache API per isolate (mentioned in the plan as
  "may sit in front" but intentionally deferred).

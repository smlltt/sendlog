# Catalog module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to satisfy
the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`) and to
record the test surface that should be covered once a runner is added — Vitest
is the likely candidate given the Vite/Astro toolchain.

## Mapping (`strapi.client.ts`)

- Strapi v5 region record → `CatalogRegion`, including `id === documentId`.
- Strapi v5 crag record → `CatalogCrag`:
  - `photo` present (full media object with `url`/`width`/`height`).
  - `photo` absent / `null` → `CatalogCrag.photo === null`.
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

# Public Catalog Browse — Plan Brief

> Full plan: `context/changes/public-catalog-browse/plan.md`
> Roadmap entry: `context/foundation/roadmap.md` (S-01)
> Upstream contract: `context/archive/2026-05-26-catalog-content-contract/` (F-01) + `context/changes/catalog-crag-photos-multi/`

## What & Why

Ship the first user-visible catalog flow for SendLog: a Polish landing → region → crag (with photo hero + routes table), browsable without an account. This is the roadmap's S-01 slice and the foundation the climb-log (S-04) and projects (S-06) slices will graft onto, so the URL shape and read patterns chosen here will be locked in for everything that follows.

## Starting Point

The Astro app is starter-shaped on the public face: `src/pages/index.astro` renders the cosmic English `Welcome.astro`; `Layout.astro` declares `<html lang="en">`. The only existing catalog page is the verification-only `/catalog-smoke/regions`. The catalog read contract (`@/lib/catalog`) is fully built — `listRegions`, `listCrags`, `listRoutes` work, are typed, are server-only, are Cloudflare-cached (1 h TTL, 1 entry per resource), and `CatalogCrag.photos` is an always-present array thanks to the recent `catalog-crag-photos-multi` change. The auth middleware exposes `Astro.locals.user`. The sample region's content is loaded by the owner via Strapi admin.

## Desired End State

A visitor lands on the new Polish `/` (brand + tagline + intro + inline regions list + "Przeglądaj rejony" CTA), clicks the sample region entry, sees the crags in that region, and opens a crag to view its hero photo + thumbnail strip + coordinates + routes table — fully Polish, fully mobile-friendly, fully public, zero JS islands. Unknown slugs render a branded Polish 404; Strapi outages render a Polish error alert with HTTP 500 inside the catalog chrome.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| URL shape | Nested Polish slugs: `/regiony/[region]/[crag]` | Polish-first per PRD, nested expresses the natural region→crag hierarchy without adding a route-level URL. | Plan |
| Route-detail scope | Routes are rows inside the crag page; no per-route URL | One fewer page to build; routes naturally read as a table at v1 scale; S-04 will graft per-route actions onto the existing row. | Plan |
| Single-region UX (v1) | Show the regions list with one entry | Honest with the data; one extra click; trivial to scale when a second region lands. | Plan |
| Home page positioning | Replace `/` with a SendLog landing whose primary CTA is the catalog | Retires the starter "10x Astro Starter" cosmic chrome from the public face; catalog is the headline. | Plan |
| Landing composition | Polish intro + regions list rendered inline + in-page CTA | Zero extra clicks to start browsing; keeps the landing scannable on phones. | Plan |
| Per-id catalog API | Add `getRegionBySlug` / `listCragsByRegion` / `getCragBySlug` / `listRoutesByCrag` as pure filters over existing list calls | Cleanest page-side code, same cache key per resource, no extra Strapi requests. | Plan |
| Crag photo display | Hero (first photo) + horizontally scrollable thumbnail strip for the rest | Mobile-friendly, no JS island, uses admin-set order and `alt` text. | Plan |
| Empty / error UX | True HTTP statuses + Polish friendly messages — 404 for unknown slugs (`Astro.rewrite('/404')`), 500 + inline `CatalogErrorAlert` for Strapi failures | Correct for crawlers and Cloudflare logs; preserves smoke page's diagnostic vocabulary. | Plan |
| Climb-log seam (S-04 future-proofing) | Read-only now — no per-route "log climb" / "sign in to log" UI on the route row | Nothing to migrate when S-04 lands; no dead clicks if S-04 slips. | Plan |
| Auth-page / dashboard chrome | Left untouched (keep starter cosmic look) | S-03 owns auth restyle, S-04 owns dashboard; out of scope here. | Plan |

## Scope

**In scope:**

- New Polish landing on `/` with brand, tagline, intro, "Przeglądaj rejony" CTA, and inline regions list.
- New region detail page `/regiony/[region]` with crag list.
- New crag detail page `/regiony/[region]/[crag]` with photo hero + thumbnail strip, coordinates as text, and routes table.
- New Polish 404 page (`src/pages/404.astro`).
- New catalog chrome: `CatalogLayout`, `CatalogHeader` (auth-aware), `CatalogFooter`, plus reusable `CatalogErrorAlert`, `RegionsList`, `CragCard`, `CragPhotos`, `RoutesTable` components.
- Extend `@/lib/catalog` with `getRegionBySlug`, `listCragsByRegion`, `getCragBySlug`, `listRoutesByCrag` (filters over existing list calls; re-exported from `index.ts`; documented in `__tests__/README.md`).
- Update `Layout.astro` to `<html lang="pl">` + Polish default title.
- Delete orphaned `src/components/Welcome.astro` and `src/components/Topbar.astro`.

**Out of scope:**

- Climb-log or projects UI on the route row (S-04 / S-06).
- Interactive map / map pins (S-02).
- Per-route URL / route detail page.
- Search and filters (PRD Non-Goals).
- Auth-page / dashboard restyle.
- Per-id Strapi reads with `?filters[slug][$eq]=...`.
- New shadcn primitives, JS islands, i18n library, sitemap entries.
- Tests (no test runner is configured; future coverage documented in `__tests__/README.md`).
- Performance instrumentation, analytics, error tracking.

## Architecture / Approach

Three new Astro pages compose against four new slug-based catalog helpers, sharing a single Polish light-theme chrome (`CatalogLayout` → `CatalogHeader` + `<main>` + `CatalogFooter`). The catalog module stays server-only; pages are SSR with no client islands. Errors are handled uniformly: `null` from the slug helper → `Astro.rewrite('/404')`; `CatalogError` → inline `CatalogErrorAlert` + `Astro.response.status = 500`. The chrome itself never throws. Cache locality is identical to F-01 — every page reads the same one-entry-per-resource Cloudflare Cache API entries; the new helpers add zero new cache keys and zero new Strapi requests.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Catalog chrome, slug helpers, landing, and 404 | Polish `Layout` (`lang="pl"`), `CatalogLayout`/header/footer, `CatalogErrorAlert`, `RegionsList`, four slug helpers in `@/lib/catalog`, new `/` landing, `404.astro`, deletion of orphaned starter components. | Single-commit rewrite of `index.astro` + deletion of `Welcome.astro`/`Topbar.astro` must land atomically to avoid a mid-edit broken build. |
| 2. Region detail page (`/regiony/[region]`) | `CragCard.astro` + page that resolves region slug, lists scoped crags, 404s on unknown slug. | None significant — same fetch/error pattern as the landing, just slug-resolved. |
| 3. Crag detail page (`/regiony/[region]/[crag]`) | `CragPhotos.astro` (hero + thumbnail strip), `RoutesTable.astro` (mobile-stacked, desktop-table), page that resolves the crag, validates the region, fetches routes. | Mobile responsive layout of the routes table is the most design-sensitive surface; needs manual check on 375 × 667. |

**Prerequisites:** F-01 (`catalog-content-contract`) and `catalog-crag-photos-multi` are shipped and deployed. Sample-region content (≥1 region, ≥1 crag with ≥2 photos and ≥2 routes) is published in Strapi Cloud for end-to-end manual verification.

**Estimated effort:** About 2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Strapi `slug` values are URL-safe (lowercase, hyphens, no diacritics). Admin discipline is assumed; no slug normalization happens client-side.
- The catalog cache at v1 scale fits comfortably in one Cache API entry per resource. If the catalog grows beyond a few hundred routes, per-id helpers may need to push filters upstream (deferred — see plan "What We're NOT Doing").
- `Astro.rewrite('/404')` preserves the URL the visitor typed and renders `404.astro`'s body, but the 404 status must be set explicitly via `Astro.response.status = 404` inside `404.astro`. Verified via Astro docs (Context7).
- The catalog chrome retirement deletes `Welcome.astro` and `Topbar.astro` — both have zero non-`index.astro` consumers. Rollback is `git revert` the deletion commit alongside the landing rewrite.
- The auth page chrome stays cosmic / English in this slice. S-03 will revisit it; visitors clicking "Zaloguj się" from the new catalog header land on the existing starter-styled signin page. Acceptable seam for now.

## Success Criteria (Summary)

- A visitor with no account can land on `/`, browse to a crag, and see the crag's photos + coordinates + routes — fully Polish, on a phone, in under 800 ms p95 perceived (per PRD NFR), with no login wall and no JS island load.
- Unknown slugs render the Polish 404 with HTTP 404; Strapi outages render the Polish error alert with HTTP 500; both inside the same branded catalog chrome.
- `@/lib/catalog` gains four slug-based helpers that share the F-01 cache contract — no new Strapi requests, no new cache keys, no schema change.

# Public Catalog Browse Implementation Plan

## Overview

Ship the first user-visible catalog flow for SendLog: a Polish landing on `/` (regions list inline + "Przeglądaj rejony" CTA) → region detail at `/regiony/[region]` (list of crags) → crag detail at `/regiony/[region]/[crag]` (hero photo + thumbnail strip + routes table). The flow is fully public, mobile-first, and Polish-first per PRD FR-001/002/003 and the NFR guardrails (mobile usable, Polish primary, 800 ms p95 perceived response).

Built on the existing `@/lib/catalog` server-only read contract (F-01 + `catalog-crag-photos-multi`): the slice extends the module with four slug-based helpers (`getRegionBySlug`, `listCragsByRegion`, `getCragBySlug`, `listRoutesByCrag`) and consumes them from three new Astro pages. No Strapi schema changes; no Supabase migration; no new dependencies; no JS islands.

The starter cosmic landing (`Welcome.astro`, `Topbar.astro`) is retired from `/`. The auth pages and `/dashboard` keep their starter cosmic look — they belong to S-03 (passwordless auth) and S-04 (climb log) respectively and stay out of scope here.

## Current State Analysis

The Astro app today is starter-shaped on the public face: `src/pages/index.astro` renders `Welcome.astro` (cosmic-themed English "10x Astro Starter" landing); `Layout.astro` declares `<html lang="en">` and defaults to title "10x Astro Starter". The only catalog code path in the public tree is the verification-only `src/pages/catalog-smoke/regions.astro`, deliberately unlinked from navigation.

The catalog read contract is fully shipped and stable:

- `src/lib/catalog/index.ts:1-23` — public surface: `listRegions`, `listCrags`, `listRoutes`, `CATALOG_CACHE_TTL_SECONDS`, `isLocalStrapi`, and the `Catalog*` types + `CatalogError`. Doc comment says "Import from `@/lib/catalog`; never reach into `strapi.client.ts` or `cache.ts` directly from outside this folder."
- `src/lib/catalog/strapi.client.ts:210-240` — `listRegions`, `listCrags` (populates `["photos", "region"]`), `listRoutes` (populates `["crag", "crag.region"]`). All three default to `pl` locale, `sort=name:asc`, `status=published`, page size 100. Every call goes through `withCache`.
- `src/lib/catalog/cache.ts:55-86` — Cloudflare Cache API wrapper, 1-hour TTL, cache key = upstream URL. Local Strapi (`localhost`, `127.0.0.1`, `0.0.0.0`, `.local`) and `bypassCache: true` skip both read and write; `caches.default` unavailable (Node build) also skips.
- `src/lib/catalog/types.ts:13-77` — `CatalogPhoto` carries `url`, optional `width`/`height`, `alt: string | null`. `CatalogCrag.photos: CatalogPhoto[]` (always an array). `CatalogRoute` carries `cragId`, `cragSlug`, `regionId`, `regionSlug`. Canonical identity is Strapi `documentId` (typed as `id`) — slugs are routing metadata only.
- `src/lib/catalog/__tests__/README.md` — documented test surface for the future runner; needs updating whenever the module's public API changes.

The Astro chrome and middleware:

- `src/layouts/Layout.astro:1-50` — minimal HTML shell, English `lang`, default English title, renders `Banner` for missing-config diagnostics, then `<slot />`.
- `src/middleware.ts:1-28` — resolves `Astro.locals.user` on every request via Supabase SSR cookies. `PROTECTED_ROUTES = ["/dashboard"]`. All catalog pages in this slice are public, so middleware just populates `Astro.locals.user` for the header's auth widget.
- `src/components/Topbar.astro:1-37` — current auth-aware header, dark cosmic styling, English copy. Used only by `Welcome.astro`. Becomes orphaned after this slice retires `Welcome.astro`.
- `src/components/Welcome.astro:1-127` — the cosmic English landing. Used only by `src/pages/index.astro`. Becomes orphaned when the landing is replaced.
- `src/pages/auth/{signin,signup,confirm-email}.astro` and `src/pages/dashboard.astro` — embed their own cosmic-themed inner shells, NOT `Topbar`. They are independent of this slice; do not touch them.

The sample region's content (single region, ~handful of crags, ~tens of routes) is loaded manually by the project owner via Strapi Cloud admin per the S-07 roadmap note. No content seeding happens in this slice.

`tsconfig.json` path alias `@/*` → `./src/*` is in place. shadcn/ui is configured in "new-york" style but only `button.tsx` is installed; this slice does not need additional shadcn primitives — semantic HTML + Tailwind 4 + `cn()` from `@/lib/utils` is enough for a list/table/photo UI without islands.

## Desired End State

- A visitor landing on `/` sees a Polish SendLog landing: brand, one-line tagline, short intro paragraph, a "Przeglądaj rejony" CTA, and the regions list (single sample-region entry in v1) rendered inline below.
- A visitor opening `/regiony/<region-slug>` sees the region name, a breadcrumb "SendLog / <Region Name>", and a list of crags published under that region with the first photo as a thumbnail (when present).
- A visitor opening `/regiony/<region-slug>/<crag-slug>` sees the crag name, breadcrumb "SendLog / <Region Name> / <Crag Name>", a hero photo + thumbnail strip for the rest (with admin-set `alt` text), location coordinates as text (lat/long), and the routes table (name | grade | type | year set), all in Polish.
- All catalog pages use the same Polish light-theme chrome (`CatalogLayout`): brand link to `/`, auth-aware widget ("Zaloguj się" or `user.email` + "Wyloguj" POST to `/api/auth/signout`).
- Unknown region or crag slug → `Astro.rewrite('/404')` renders the Polish 404 page with `Astro.response.status = 404`.
- Strapi outage or other `CatalogError` on a catalog page → inline Polish `CatalogErrorAlert` is rendered, `Astro.response.status = 500`, page chrome still loads.
- The `@/lib/catalog` module exports four new slug-based helpers (`getRegionBySlug`, `listCragsByRegion`, `getCragBySlug`, `listRoutesByCrag`) that are pure filters over the existing list calls, so they reuse the same Cloudflare Cache API entries as today.
- `src/components/Welcome.astro` and `src/components/Topbar.astro` are deleted; their starter cosmic styling no longer appears anywhere in the public tree (the auth pages and dashboard keep their cosmic look — out of scope).
- `Layout.astro` declares `<html lang="pl">` and defaults the title to "SendLog — katalog polskich rejonów wspinaczkowych".
- `npm run lint`, `npx astro sync`, `npm run build` all pass. No JS island is added (no new client-load).

### Key Discoveries

- Astro 6's clean pattern for "matched route, slug doesn't resolve" is `return Astro.rewrite('/404')`: the URL the visitor typed is preserved, the 404 page UI renders, and the status is whatever `404.astro` sets via `Astro.response.status = 404` (Astro docs: "Rendering live content in Astro pages"). `return Astro.redirect('/404')` would change the URL (302), and bare `return new Response(null, { status: 404 })` renders no body. We use `Astro.rewrite`.
- `listCrags()` already populates both `photos` and `region`, so `CatalogCrag.photos` and `CatalogCrag.regionSlug`/`regionId` are immediately filterable by the new `getCragBySlug` helper — no upstream changes required.
- `listRoutes()` already populates `crag.region`, so each `CatalogRoute` carries `cragId`, `cragSlug`, `regionId`, `regionSlug`. Filtering by `cragId` for `listRoutesByCrag` is correct and stable (canonical identity per `types.ts:9-10`).
- The catalog cache key is the upstream URL including query string. All four new helpers wrap the existing `listRegions`/`listCrags`/`listRoutes` calls — they reuse the same single cache entry per resource, so per-page cache locality across `/`, `/regiony/[region]`, `/regiony/[region]/[crag]` is shared. At v1 scale (1 region, ~5–10 crags, ~tens of routes per crag) the entire catalog fits comfortably in one cached response per resource.
- `Topbar.astro` is imported only by `Welcome.astro` (`rg "Topbar"` returns one hit). Deleting both is safe — no other consumer.
- The smoke page at `src/pages/catalog-smoke/regions.astro:84-100` already inlines a Polish diagnostic for `CatalogError` (missing config + generic error variants). The new `CatalogErrorAlert.astro` component lifts that pattern verbatim into a reusable component and the smoke page can adopt it later (not required for this slice).
- `src/components/Banner.astro` (used in `Layout.astro`) is independent of the catalog chrome and stays as-is — it's the missing-config bar at the very top of the body.
- `Astro.locals.user.email` is the auth-aware string the new header renders; the sign-out POST endpoint `/api/auth/signout` already exists.
- shadcn/ui's "new-york" style is set up but only `button.tsx` is installed. No new shadcn primitives needed — semantic `<nav>`, `<ul>`, `<table>`, and `<img>` with Tailwind classes are enough.

## What We're NOT Doing

- **Climb-log seam on the route row.** No per-route "log climb" or "sign in to log" CTA in this slice. S-04 (route-climb-log) will add a per-route action against the canonical `route.id` against an already-shipped slug URL space.
- **Project-list seam on the route row.** Same reasoning; S-06 owns this.
- **Interactive map / map pins.** S-02 (crag-map-navigation) owns FR-004/005. This slice renders coordinates as text only.
- **Route detail page (per-route URL).** Per user decision, routes are rendered as rows inside the crag page; there is no `/regiony/[region]/[crag]/[route]` URL in v1.
- **Search / filters.** PRD Non-Goals explicitly exclude grade/type/name search in v1; visual browsing only.
- **`/regiony` index page.** The home page IS the regions landing in v1; a direct visit to `/regiony` 404s. When a second region lands and an in-roadmap region picker becomes useful, that page can be added.
- **Auth-page or dashboard restyle.** They keep their existing cosmic look. S-03 will restyle auth; S-04 will restyle the dashboard / climb-log surface.
- **Per-id Strapi reads (`?filters[slug][$eq]=...`).** Per user decision, the new helpers are pure filters over `list*()` — same cache key per resource, no extra Strapi request count.
- **shadcn primitives beyond what's installed.** No `Card`, `Table`, `Avatar` install in this slice.
- **JS islands.** No `client:load`/`client:visible` anywhere — the photo strip and route table are static HTML.
- **i18n library / translation files.** Polish strings are inline (matches existing pattern in `src/pages/catalog-smoke/regions.astro` and the auth UI). A real i18n setup is deferred.
- **Sitemap entries for the new pages.** `@astrojs/sitemap` is installed but not configured for this slice — sitemap generation is a separate concern.
- **Tests.** No test runner is configured (`AGENTS.md`); intended coverage is documented in `src/lib/catalog/__tests__/README.md` only.
- **Performance instrumentation, analytics, error tracking.** Out of scope (per roadmap baseline observability is "partial" and not part of S-01).

## Implementation Approach

Build the slice bottom-up across three phases that each leave the app shippable and verifiable:

1. **Phase 1** installs the foundations — chrome (`CatalogLayout` + header + footer), the four slug-based catalog helpers, the reusable `CatalogErrorAlert`, the Polish landing page, the 404 page, and the deletion of the orphaned starter components. After this phase, `/` is the new Polish landing with the regions list; the regions list link goes to `/regiony/<region-slug>` which 404s (no page yet). Lint/build pass.
2. **Phase 2** adds the region detail page (`/regiony/[region]`). After this phase, the visitor can navigate from `/` → region → and clicks on the crag links 404. Lint/build pass.
3. **Phase 3** adds the crag detail page (`/regiony/[region]/[crag]`) with photos and routes table. After this phase, the full happy path works end-to-end on production-equivalent data.

Each page follows the same fetch/error pattern: try → `getRegionBySlug`/`getCragBySlug`; on `null`, `return Astro.rewrite('/404')`; on `CatalogError`, set `Astro.response.status = 500` and render `<CatalogErrorAlert>` inside the chrome. The chrome itself never throws — even on Strapi outage the brand + auth widget render so the visitor never lands on an unbranded blank page.

The page hierarchy uses Astro's filesystem routing without any custom rewrites; URL slugs match Strapi-supplied slugs verbatim. Admins are responsible for entering URL-safe slugs in Strapi (lowercase, hyphens, no diacritics) — Strapi's slug field UI enforces this by convention.

## Critical Implementation Details

### Astro 404 rendering

In Astro 6 SSR, when a *matched* dynamic route resolves to a missing record, the right pattern is `return Astro.rewrite('/404')`. This preserves the URL the visitor typed, renders `src/pages/404.astro` as the response body, and the status code comes from whatever `404.astro` sets via `Astro.response.status = 404` (must be set explicitly inside the 404 page's frontmatter; the rewrite alone does NOT carry the 404 status). Using `Astro.redirect('/404')` would 302 the visitor to `/404` (changes URL, wrong for "page not found"). Using bare `return new Response(null, { status: 404 })` returns the right status but no body — visitor sees a blank page or Cloudflare's generic HTML.

### State sequencing

Phase 1 must land before Phase 2/3 because Phase 1 introduces both the `CatalogLayout`/header/footer components and the slug-based helpers Phase 2 and Phase 3 consume. Within Phase 1, the helpers must be added (and re-exported from `@/lib/catalog/index.ts`) before they are imported from the landing page — otherwise `npm run build` fails on the missing exports during the same edit cycle.

### Deletion sequencing inside Phase 1

`src/components/Welcome.astro` and `src/components/Topbar.astro` must be deleted in the same commit that rewrites `src/pages/index.astro`. Deleting them earlier breaks `index.astro` mid-edit (build fails on the unresolved import). Deleting them later leaves orphaned components that lint may not flag but which will confuse future readers. The single-commit rule keeps the tree consistent.

## Phase 1: Catalog chrome, slug helpers, landing, and 404

### Overview

Lay the foundations of the public catalog surface: Polish HTML shell, light-theme catalog chrome (header + footer), reusable error alert, four slug-based catalog helpers, a new `/` landing page, and a Polish `404.astro`. Retire the starter cosmic landing (`Welcome.astro`, `Topbar.astro`) — they are only used by `/` and become orphaned after this rewrite.

### Changes Required

#### 1. Update HTML shell to Polish

**File**: `src/layouts/Layout.astro`

**Intent**: Match the PRD's Polish-primary requirement at the HTML root so screen readers, browser translation hints, and the default page title all default to Polish.

**Contract**: `<html lang="en">` → `<html lang="pl">`. The `title` prop default changes from `"10x Astro Starter"` to `"SendLog — katalog polskich rejonów wspinaczkowych"`. The `Banner`/missing-config rendering, the `<head>` boilerplate, the `<slot />`, and the global CSS import all stay unchanged. `Props` interface stays as `{ title?: string }`.

#### 2. New catalog chrome layout

**File**: `src/layouts/CatalogLayout.astro` (new)

**Intent**: Provide one consistent Polish, light-theme shell for every public catalog page (landing, region, crag, 404) so they share brand, navigation, and the auth-aware widget without duplicating header markup across files.

**Contract**: An Astro layout that wraps `Layout.astro` and renders, in order: `<CatalogHeader />` (see below), a `<main>` container with `class="mx-auto max-w-5xl px-4 py-8 sm:py-12"`, a default `<slot />` for page content, and `<CatalogFooter />` at the bottom. Accepts `Props = { title?: string; breadcrumbs?: { label: string; href?: string }[] }`. Forwards `title` to `Layout`'s `title` prop. Passes `breadcrumbs` into `CatalogHeader` so each page provides its own trail. Reads `Astro.locals.user` and passes it to the header.

#### 3. New catalog header

**File**: `src/components/catalog/CatalogHeader.astro` (new)

**Intent**: A single Polish, light-theme, auth-aware header used on every public catalog page. Replaces the cosmic `Topbar` semantically; preserves the auth widget the future S-03 flow will rely on.

**Contract**: Renders a `<header>` with two visual rows: top row holds an `<a href="/">SendLog</a>` brand link (Tailwind: bold, sized for mobile) on the left and the auth widget on the right; the auth widget mirrors the current `Topbar` logic (signed-in → `<span>{user.email}</span>` + form-POST sign-out button labeled "Wyloguj"; signed-out → `<a href="/auth/signin">Zaloguj się</a>`). When `breadcrumbs?.length > 0`, render a second row with an accessible `<nav aria-label="Okruszki">` containing an `<ol>` whose items render `<a href={item.href}>{item.label}</a>` (or plain `<span>` for the last/current item without an `href`), separated visually by `/`. Light-theme Tailwind (white background, slate text), no JS. Accepts `Props = { user: import('@supabase/supabase-js').User | null; breadcrumbs?: { label: string; href?: string }[] }`. The sign-out form posts to `/api/auth/signout`.

#### 4. New catalog footer

**File**: `src/components/catalog/CatalogFooter.astro` (new)

**Intent**: A minimal footer that anchors the page on long lists and provides one obvious link back to the landing.

**Contract**: A `<footer>` with a small Polish line ("SendLog — katalog wspinaczkowy. Treść zarządzana przez administratora.") and a "Powrót na stronę główną" link to `/`. Light-theme, single line on mobile, no auth dependency, no JS. Centered, muted text.

#### 5. Reusable catalog error alert

**File**: `src/components/catalog/CatalogErrorAlert.astro` (new)

**Intent**: Lift the inline `CatalogError` rendering pattern from `src/pages/catalog-smoke/regions.astro:84-100` into a reusable component so every catalog page renders Strapi failures the same way.

**Contract**: Accepts `Props = { error: unknown }`. Detects `CatalogError` via `instanceof`; missing config renders the existing Polish "Brak konfiguracji Strapi" message (amber styling); other `CatalogError` codes render "Błąd odczytu katalogu" + `{code}: {message}` (red styling); anything else renders "Wystąpił nieoczekiwany błąd." + `error.message`/String(error) (red styling). Uses `role="alert"` and the same Tailwind classes as the smoke page. The smoke page can be migrated to use this component later (out of scope here).

#### 6. New regions list component

**File**: `src/components/catalog/RegionsList.astro` (new)

**Intent**: Render a reusable Polish list of regions, used inline on the landing page (and by future region-index pages if/when a second region lands).

**Contract**: Accepts `Props = { regions: CatalogRegion[] }`. Renders a semantic `<ul>` where each `<li>` is an `<a href="/regiony/{region.slug}">{region.name}</a>` styled as a card/row (Tailwind: border, padding, hover state). When `regions.length === 0`, renders a Polish "Brak opublikowanych rejonów." `<p>` (mirrors the smoke page empty-state copy). No JS island. Imports `CatalogRegion` type from `@/lib/catalog`.

#### 7. Extend catalog module with slug-based helpers

**File**: `src/lib/catalog/strapi.client.ts`

**Intent**: Add four slug-based read helpers that callers (region and crag pages) need, implemented as pure filters over the existing list calls so they reuse the same Cloudflare Cache API entries.

**Contract**: Four new exported async functions added at the bottom of the file, after `listRoutes`:

- `getRegionBySlug(slug: string, options?: CatalogReadOptions): Promise<CatalogRegion | null>` — calls `listRegions(options)`, returns the first region whose `slug === slug` (case-sensitive, exact match), or `null` if not found.
- `listCragsByRegion(regionSlug: string, options?: CatalogReadOptions): Promise<CatalogCrag[]>` — calls `listCrags(options)`, returns all crags whose `regionSlug === regionSlug` (case-sensitive, exact match), in upstream sort order (which is `name:asc` from `buildListPath`). Returns `[]` when no crag matches (e.g., known region but no published crags yet).
- `getCragBySlug(regionSlug: string, cragSlug: string, options?: CatalogReadOptions): Promise<CatalogCrag | null>` — calls `listCrags(options)`, returns the first crag where `slug === cragSlug` AND `regionSlug === regionSlug`, or `null` if not found. Both arguments are required; matching is case-sensitive.
- `listRoutesByCrag(cragId: string, options?: CatalogReadOptions): Promise<CatalogRoute[]>` — calls `listRoutes(options)`, returns all routes whose `cragId === cragId` (canonical Strapi `documentId` match), in upstream sort order (which is `name:asc` from `buildListPath`).

All four forward `options` unchanged to the underlying list call, so `bypassCache` and `locale` propagate. JSDoc on each helper explains that it is a filter over the cached list call and shares the same cache key. No new Strapi request paths, no new cache keys.

#### 8. Re-export the new helpers

**File**: `src/lib/catalog/index.ts`

**Intent**: Surface the new helpers from the module entrypoint so callers use `@/lib/catalog` imports consistently per the existing doc comment.

**Contract**: Add `getRegionBySlug`, `listCragsByRegion`, `getCragBySlug`, `listRoutesByCrag` to the existing `export { ... } from "@/lib/catalog/strapi.client"` line. Type re-exports and the `CATALOG_CACHE_TTL_SECONDS`/`isLocalStrapi` re-exports stay unchanged. Module doc comment stays unchanged.

#### 9. Update catalog test README

**File**: `src/lib/catalog/__tests__/README.md`

**Intent**: Document the future test surface for the four new helpers so the next runner-adoption pass has an accurate target.

**Contract**: Under the existing `## Mapping (\`strapi.client.ts\`)` section, add a new sub-section `### Slug helpers` listing one bullet per helper:
- `getRegionBySlug("<region-slug>")` → returns the matching region or `null`; does NOT fetch upstream beyond the single shared `listRegions()` call.
- `listCragsByRegion("<region-slug>")` → returns all crags whose `regionSlug` matches; preserves upstream `name:asc` order; returns `[]` when the region has no published crags.
- `getCragBySlug("<region-slug>", "<crag-slug>")` → matches both region and crag slug; mismatched region returns `null` even if the crag slug exists under another region.
- `listRoutesByCrag(cragId)` → filters by `cragId` (Strapi `documentId`), preserves upstream `name:asc` order.
- All four forward `bypassCache` and `locale` to the underlying list call; cache key is identical to the list call's.

Other sections (Errors, Cache, Known follow-ups) are untouched.

#### 10. Polish landing page

**File**: `src/pages/index.astro` (rewrite — current file is the cosmic `<Welcome />` shell)

**Intent**: Replace the starter landing with a Polish SendLog landing whose primary content is the regions list, scrollable via a `#regiony` anchor for the "Przeglądaj rejony" CTA.

**Contract**: Astro frontmatter imports `CatalogLayout`, `RegionsList`, `CatalogErrorAlert`, and `{ CatalogError, listRegions, type CatalogRegion } from "@/lib/catalog"`. Try `listRegions()`; on error, set `Astro.response.status = 500` and pass the error to `<CatalogErrorAlert>` in place of the regions list. Page body renders:

- A hero block: `<h1>SendLog</h1>` (Polish brand, large), a one-line Polish tagline ("Polski katalog wspinaczkowych rejonów."), a short intro paragraph (~1–2 sentences explaining the catalog is browsable without an account), and an in-page `<a href="#regiony">Przeglądaj rejony</a>` CTA styled as a button.
- An `<section id="regiony">` heading "Rejony" followed by `<RegionsList regions={regions} />`.

The page uses `<CatalogLayout title="SendLog">`. No breadcrumbs prop (landing is root). `export const prerender = false` is NOT set — page-level prerender flag is unnecessary in `output: "server"` mode for non-API routes; matches the smoke page convention.

#### 11. Custom 404 page

**File**: `src/pages/404.astro` (new)

**Intent**: Polish-styled, branded 404 page rendered both for unmatched routes (Astro's default 404 behavior) and for `Astro.rewrite('/404')` calls from inside the region/crag pages.

**Contract**: Sets `Astro.response.status = 404` in the frontmatter (otherwise rewrites resolve with status 200). Renders inside `<CatalogLayout title="Nie znaleziono strony">` with no breadcrumbs. Body shows a centered `<h1>Nie znaleziono</h1>`, a Polish paragraph ("Wygląda na to, że ta strona nie istnieje albo została przeniesiona."), and two links: "Wróć na stronę główną" (`/`) and "Przejdź do rejonów" (`/#regiony`). No JS, no auth dependency. The page does NOT hardcode any specific region slug.

#### 12. Delete orphaned starter components

**Files**: `src/components/Welcome.astro` (delete), `src/components/Topbar.astro` (delete)

**Intent**: Remove the cosmic English starter chrome from the codebase once it has no consumer. `Topbar` is imported only by `Welcome`; `Welcome` is imported only by the old `src/pages/index.astro`. Both become unreachable after the landing rewrite.

**Contract**: Both files are deleted in the same commit that rewrites `src/pages/index.astro`. No other file imports either component (verify with `rg "Welcome|Topbar" src/` returning only documentation hits, if any). `bg-cosmic` class usage in `src/pages/dashboard.astro` and the auth pages is untouched — those pages keep their cosmic look (out of scope).

### Success Criteria

#### Automated Verification

- Astro types are regenerated: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `rg "Welcome|Topbar" src/` returns no import or reference results.
- `rg "getRegionBySlug|listCragsByRegion|getCragBySlug|listRoutesByCrag" src/lib/catalog/index.ts` returns the four new re-exports.

#### Manual Verification

- `npm run dev` loads `/` and shows the Polish SendLog landing: brand "SendLog", tagline, intro paragraph, "Przeglądaj rejony" CTA, and the regions list with the sample region entry below.
- The header shows "Zaloguj się" when signed out and `{user.email}` + a "Wyloguj" button when signed in (sign-out POST to `/api/auth/signout` still works).
- The "Przeglądaj rejony" CTA scrolls to the `#regiony` anchor on the same page.
- `<html lang="pl">` is set on the rendered HTML; the document `<title>` defaults to "SendLog — katalog polskich rejonów wspinaczkowych" or the page-supplied "SendLog".
- Visiting `/some-route-that-does-not-exist` renders the Polish 404 page with HTTP status 404 (verify via browser devtools network panel).
- With Strapi unreachable (e.g., temporarily blanking `STRAPI_API_TOKEN` in `.dev.vars`), the landing still renders chrome and shows the Polish "Brak konfiguracji Strapi" or "Błąd odczytu katalogu" alert. The HTTP status is 500.
- The page renders correctly on a mobile viewport (375 × 667 emulation in devtools): no horizontal scrolling, header and regions list legible without zoom.
- No client-side JavaScript bundle is added for the landing (verify in the network panel — only the framework's minimal runtime, no per-page island chunk).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Region detail page (`/regiony/[region]`)

### Overview

Add the region detail page: a visitor opening `/regiony/<region-slug>` sees the region name, breadcrumb back to the landing, and the list of crags published under that region. Each crag links to `/regiony/[region]/[crag]` (page added in Phase 3).

### Changes Required

#### 1. New crag card component

**File**: `src/components/catalog/CragCard.astro` (new)

**Intent**: Render a single crag in a list — name, optional first photo thumbnail, optional micro-stats (e.g., route count if we have it cheaply) — as a clickable row.

**Contract**: Accepts `Props = { crag: CatalogCrag; href: string }`. Renders a semantic `<a href={href}>` styled as a horizontal card on desktop and a stacked card on mobile (Tailwind `flex flex-col sm:flex-row`). If `crag.photos.length > 0`, render the first photo as `<img src={crag.photos[0].url} alt={crag.photos[0].alt ?? crag.name} loading="lazy"{...width/height when present}>` sized to ~96×96 mobile / ~120×120 desktop with `object-cover` and `rounded`. To the right of the thumbnail (or below it on mobile), render `<h3>{crag.name}</h3>` and a muted line with the slug (small text). Hover state changes background. No JS island. Imports `CatalogCrag` type from `@/lib/catalog`.

#### 2. New region detail page

**File**: `src/pages/regiony/[region]/index.astro` (new)

**Intent**: Resolve the `region` slug to a `CatalogRegion`, fetch crags scoped to that region, and render them via `CragCard`.

**Contract**: Astro frontmatter imports `CatalogLayout`, `CragCard`, `CatalogErrorAlert`, and `{ CatalogError, getRegionBySlug, listCragsByRegion, type CatalogCrag, type CatalogRegion } from "@/lib/catalog"`.

Frontmatter (data flow):

```astro
---
let region: CatalogRegion | null = null;
let crags: CatalogCrag[] = [];
let error: unknown = null;

try {
  region = await getRegionBySlug(Astro.params.region!);
  if (region === null) return Astro.rewrite("/404");
  crags = await listCragsByRegion(region.slug);
} catch (err) {
  Astro.response.status = 500;
  error = err;
}
---
```

Notes on the catch block: if step 1 (`getRegionBySlug`) threw, `region` stays `null` and `crags` stays `[]` — the error fallback below renders. If step 3 (`listCragsByRegion`) threw, `region` is set but `crags` is still `[]` — the happy-path layout renders with `<CatalogErrorAlert>` in place of the crag list.

Body (two explicit branches, mutually exclusive):

```astro
{region ? (
  <CatalogLayout
    title={region.name}
    breadcrumbs={[{ label: "SendLog", href: "/" }, { label: region.name }]}
  >
    <h1>{region.name}</h1>
    <h2>Crągi w tym rejonie</h2>
    {error ? (
      <CatalogErrorAlert error={error} />
    ) : crags.length === 0 ? (
      <p>Brak opublikowanych crągów w tym rejonie.</p>
    ) : (
      <ul>
        {crags.map((c) => (
          <li>
            <CragCard crag={c} href={`/regiony/${region.slug}/${c.slug}`} />
          </li>
        ))}
      </ul>
    )}
  </CatalogLayout>
) : (
  <CatalogLayout
    title="Błąd"
    breadcrumbs={[{ label: "SendLog", href: "/" }]}
  >
    <h1>Nie udało się załadować rejonu</h1>
    <CatalogErrorAlert error={error} />
  </CatalogLayout>
)}
```

The error-path branch (lower) only renders when `region` is `null` AND we caught an error on step 1 — in practice the only way to reach it is a Strapi outage during the initial `getRegionBySlug` call. Breadcrumbs omit the region label since we don't know it.

### Success Criteria

#### Automated Verification

- Lint passes: `npm run lint`
- `npx astro sync` succeeds.
- Production build passes: `npm run build`
- `rg "getRegionBySlug" src/pages` returns the new region page.

#### Manual Verification

- `npm run dev` and clicking the sample region entry from `/` navigates to `/regiony/<region-slug>` and shows the region heading and the list of published crags.
- Breadcrumbs show "SendLog / <Region Name>", with "SendLog" linking to `/`.
- Each crag card shows the crag name; cards for crags with at least one photo show the first photo as a thumbnail with admin-set `alt` (or the crag name as a fallback `alt`); cards for crags with no photos render cleanly without a broken image.
- Clicking a crag card navigates to `/regiony/<region-slug>/<crag-slug>` (404 expected at this phase since Phase 3 hasn't shipped).
- Visiting `/regiony/nieistniejacy-rejon` renders the Polish 404 page with HTTP status 404 (URL preserved).
- With Strapi unreachable, the page renders chrome and the Polish `CatalogErrorAlert` with HTTP status 500.
- A region that has zero published crags renders the Polish "Brak opublikowanych crągów w tym rejonie." copy.
- Mobile (375×667) layout: crag cards stack vertically with thumbnail above text; no horizontal scrolling.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Crag detail page (`/regiony/[region]/[crag]`)

### Overview

Add the crag detail page — the deepest catalog level and the surface S-04 (climb log) will later extend per route. Renders the crag's photo hero + thumbnail strip, coordinates as text, and a routes table (name | grade | type | year set). Routes appear inline as table rows; there is no per-route URL in this slice.

### Changes Required

#### 1. New crag photos component

**File**: `src/components/catalog/CragPhotos.astro` (new)

**Intent**: Render a crag's photos as a hero (first photo) with an optional thumbnail strip for the rest. Mobile-first, no JS island, native lazy-loading on non-hero images, accessible.

**Contract**: Accepts `Props = { photos: CatalogPhoto[]; cragName: string }`. When `photos.length === 0`, renders nothing (returns `null`/no markup). Otherwise:

- Hero: `<img src={photos[0].url} alt={photos[0].alt ?? cragName} fetchpriority="high" decoding="async" {...width/height when both are numeric}>` styled responsively (Tailwind `w-full max-h-[420px] object-cover rounded-lg`). No `loading="lazy"` on the hero (above the fold). `fetchpriority="high"` is a free LCP win for the page's largest contentful paint candidate (mobile p95 NFR is 800 ms).
- Thumbnail strip: when `photos.length > 1`, render a horizontally-scrollable `<ul>` (Tailwind `flex gap-2 overflow-x-auto`) with each remaining photo as an `<li><img src={p.url} alt={p.alt ?? cragName} loading="lazy" decoding="async" {...width/height}>` sized ~120×80. Each thumb is also a plain `<a href={p.url} target="_blank" rel="noopener">` so a tap opens the original full-size image in a new tab (no carousel JS in v1; PRD allows nice-to-have polish later).

Use the photo's own `width`/`height` attributes when both are numeric (the mapper sets them as optional `number | undefined`); otherwise omit them. Tailwind handles responsive sizing on top. `decoding="async"` is set on every `<img>` (hero + thumbs) so the browser is free to parse the image off the main thread regardless of priority.

#### 2. New routes table component

**File**: `src/components/catalog/RoutesTable.astro` (new)

**Intent**: Render a crag's route list as an accessible, mobile-friendly table — semantic `<table>` on desktop, stacked-card layout on mobile (per the NFR "remains fully usable on a phone browser at the crag").

**Contract**: Accepts `Props = { routes: CatalogRoute[] }`. When `routes.length === 0`, renders a Polish "Brak tras dla tej skały." `<p>`. Otherwise renders ONE semantic `<table>` whose desktop layout is a standard table and whose mobile layout is a stacked-card list, achieved purely with Tailwind 4 responsive utilities (no JS island, no media query CSS). Table semantics are preserved at every breakpoint so screen readers always see a real table.

Concrete structure:

- Outer wrapper: `<table class="w-full text-sm">`.
- `<thead class="sr-only sm:not-sr-only">` containing one `<tr>` of `<th class="text-left font-medium text-slate-700 px-3 py-2 border-b border-slate-200">` per column, in order: `"Nazwa"`, `"Skala"`, `"Typ"`, `"Rok poprowadzenia"`. On mobile the thead is visually hidden via `sr-only` but still feeds assistive tech.
- `<tbody>` with one `<tr class="block sm:table-row border-b border-slate-200 mb-3 sm:mb-0">` per route. Mobile: each row is a stacked card with bottom margin to separate visually; desktop: standard table row separated by the cell borders.
- Each cell:
  ```html
  <td
    data-label="Nazwa:"
    class="block sm:table-cell px-3 py-1 sm:py-2 before:content-[attr(data-label)] before:mr-2 before:font-medium before:text-slate-500 sm:before:content-none"
  >{route.name}</td>
  ```
  The `data-label` attribute carries the column label **with a trailing colon** (`"Nazwa:"`, `"Skala:"`, `"Typ:"`, `"Rok poprowadzenia:"`) so the pseudo-element renders e.g. `"Nazwa: Sample Route"` on mobile. `before:content-[attr(data-label)]` is a verified Tailwind v4 arbitrary value; `sm:before:content-none` resets the pseudo-element at the `sm` breakpoint so desktop relies on the visible thead instead.
- Empty cells (e.g., `yearSet === null`) render an em-dash `"—"` as the cell content; the label still renders on mobile (so the visitor sees `"Rok poprowadzenia: —"`).
- All four cells per route use the same Tailwind base classes — only the `data-label` value and the rendered cell content differ.

Implementation note: if `before:content-[attr(data-label)]` proves brittle under the project's Tailwind 4 build (e.g., the arbitrary value isn't picked up), the equivalent fallback is to render a sibling `<span class="sm:hidden font-medium text-slate-500 mr-2">Nazwa:</span>` inside each `<td>` — same DOM end state, plain HTML, no pseudo-element. Pick the variant that compiles cleanly during Phase 3 implementation.

#### 3. New crag detail page

**File**: `src/pages/regiony/[region]/[crag].astro` (new)

**Intent**: Resolve `(region, crag)` slugs to a `CatalogCrag`, validate the region matches, fetch routes via `listRoutesByCrag(crag.id)`, and render the page.

**Contract**: Astro frontmatter imports `CatalogLayout`, `CragPhotos`, `RoutesTable`, `CatalogErrorAlert`, and `{ CatalogError, getCragBySlug, getRegionBySlug, listRoutesByCrag, type CatalogCrag, type CatalogRegion, type CatalogRoute } from "@/lib/catalog"`.

Frontmatter (data flow):

```astro
---
let crag: CatalogCrag | null = null;
let region: CatalogRegion | null = null;
let routes: CatalogRoute[] = [];
let error: unknown = null;

try {
  crag = await getCragBySlug(Astro.params.region!, Astro.params.crag!);
  if (crag === null) return Astro.rewrite("/404");
  region = await getRegionBySlug(Astro.params.region!); // for breadcrumb's Polish name; shares the cached listRegions payload
  routes = await listRoutesByCrag(crag.id);
} catch (err) {
  Astro.response.status = 500;
  error = err;
}

const regionLabel = region?.name ?? crag?.regionSlug ?? "Rejon";
---
```

Notes on the catch block: if step 1 (`getCragBySlug`) threw, `crag` stays `null` and the error fallback below renders. If step 2 (`getRegionBySlug`) or step 3 (`listRoutesByCrag`) threw, `crag` is set so the happy-path layout renders with `<CatalogErrorAlert>` in place of the routes table; `regionLabel` falls back to `crag.regionSlug` for the breadcrumb when `region` is `null` after a partial failure. The additional `getRegionBySlug` call is cheap — it shares the single cached `listRegions` payload, no new Strapi request.

Body (two explicit branches, mutually exclusive):

```astro
{crag ? (
  <CatalogLayout
    title={crag.name}
    breadcrumbs={[
      { label: "SendLog", href: "/" },
      { label: regionLabel, href: `/regiony/${crag.regionSlug}` },
      { label: crag.name },
    ]}
  >
    <h1>{crag.name}</h1>
    <p>Współrzędne: {crag.latitude.toFixed(5)}, {crag.longitude.toFixed(5)}</p>
    <CragPhotos photos={crag.photos} cragName={crag.name} />
    <h2>Trasy</h2>
    {error ? (
      <CatalogErrorAlert error={error} />
    ) : (
      <RoutesTable routes={routes} />
    )}
  </CatalogLayout>
) : (
  <CatalogLayout
    title="Błąd"
    breadcrumbs={[{ label: "SendLog", href: "/" }]}
  >
    <h1>Nie udało się załadować crągu</h1>
    <CatalogErrorAlert error={error} />
  </CatalogLayout>
)}
```

The error-path branch (lower) only renders when `crag` is `null` AND we caught an error on step 1 — typically a Strapi outage during `getCragBySlug`. Breadcrumbs omit the region and crag labels since neither is known.

### Success Criteria

#### Automated Verification

- Lint passes: `npm run lint`
- `npx astro sync` succeeds.
- Production build passes: `npm run build`
- `rg "getCragBySlug|listRoutesByCrag" src/pages` returns the new crag page.

#### Manual Verification

- `npm run dev`, click through `/` → `/regiony/<region-slug>` → first crag (e.g., `/regiony/<region-slug>/<crag-slug>`): page renders crag name, coordinates as text, hero photo + thumbnail strip (when ≥1 photo), and the routes table.
- Breadcrumbs show "SendLog / <Region Name> / <Crag Name>" with the first two linking back; the region label shows the region's Polish name (not the slug).
- A crag with no photos renders without the hero/strip and without errors.
- A crag with multiple photos shows the first as hero and the rest in a horizontal thumbnail strip that scrolls horizontally on mobile.
- Each route row shows `name`, `grade`, `type`, and either `yearSet` or "—" when null.
- A crag with zero routes renders the Polish "Brak tras dla tej skały." copy.
- Visiting `/regiony/<region-slug>/nieistniejacy-crag` renders the Polish 404 page (URL preserved, status 404).
- Visiting a known crag URL while signed in shows the user email + "Wyloguj" in the header; while signed out shows "Zaloguj się"; no per-route climb-log CTA is present (verifies the read-only seam decision).
- With Strapi unreachable, the crag page renders chrome + the Polish `CatalogErrorAlert` with status 500.
- Mobile viewport (375×667): hero photo respects aspect ratio without overflow, thumbnail strip scrolls horizontally, route table stacks each row vertically with labels visible (no rows clipped).
- DevTools network panel: no client-side JS bundle is added for the crag page (only the framework runtime).
- `STRAPI_API_TOKEN` does not appear in the rendered HTML or any network response.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering this change complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

- No automated test runner is configured (`AGENTS.md`: "No test runner is configured"). Future coverage to add when a runner lands, captured in `src/lib/catalog/__tests__/README.md`:
  - `getRegionBySlug` returns the matching region; returns `null` for unknown slugs; forwards `bypassCache` and `locale`.
  - `getCragBySlug` matches both `cragSlug` and `regionSlug`; returns `null` for mismatched region; forwards options.
  - `listRoutesByCrag` filters by `cragId`; preserves upstream `name:asc` order; returns `[]` when no routes match.

### Integration Tests

- `npx astro sync` + `npm run lint` + `npm run build` are the CI gates; all must pass after each phase.
- Local manual verification against a Strapi instance with one region + at least one crag (with ≥2 photos and ≥2 routes) covers the end-to-end happy path.

### Manual Testing Steps

1. Confirm Strapi has at least one published sample region, one published crag in that region with ≥2 photos and `alternativeText` set on at least one of them, and ≥2 published routes attached to that crag.
2. `npm run dev` and load `/`. Verify the Polish landing renders with the regions list inline; the `#regiony` anchor works.
3. Click the sample region. Verify the region page renders the crag list with thumbnails (where present) and breadcrumbs.
4. Click a crag. Verify the crag page renders the hero photo, thumbnail strip (when ≥2 photos), coordinates as text, breadcrumbs with the region's Polish name, and the routes table.
5. Try an invalid region (`/regiony/foo`) and an invalid crag (`/regiony/<region-slug>/foo`) — both render the Polish 404 page with HTTP status 404 in devtools.
6. Sign in via `/auth/signin`; navigate back to any catalog page and verify the header shows the user email + "Wyloguj". Sign out and verify it shows "Zaloguj się" again.
7. Resize devtools to mobile (375×667). Verify every page is readable without horizontal scrolling; the routes table stacks rows with labels visible.
8. Temporarily blank `STRAPI_API_TOKEN` in `.dev.vars` and restart `npm run dev`. Visit `/`, `/regiony/<region-slug>`, `/regiony/<region-slug>/<crag-slug>`: each renders chrome + `CatalogErrorAlert` with status 500.
9. Confirm `STRAPI_API_TOKEN` does not appear in the rendered HTML on any page.
10. Confirm the existing `/catalog-smoke/regions` page still renders unchanged (verifies no accidental break to the smoke path).

## Performance Considerations

The slice introduces three new public routes that each call exactly one or two catalog `list*()` functions per request. Cache locality is identical to the F-01 contract: one Cloudflare Cache API entry per resource (`/api/regions?...`, `/api/crags?...&populate=photos&populate=region`, `/api/routes?...&populate=crag&populate=crag.region`). With v1 scale (~1 region, ~5–10 crags, ~tens of routes per crag), the entire catalog fits well within the Strapi Cloud Free quota assumed in F-01 (~2,500 req/month) at a 1-hour TTL.

Image-rendering performance: the hero photo on the crag page is the largest contentful paint candidate. We rely on (a) Cloudinary's CDN URLs from Strapi Cloud, (b) native `loading="lazy"` on non-hero thumbnails, and (c) `width`/`height` attributes when present to avoid CLS. No image transform pipeline is added — Strapi's stored sizes are used as-is. If image weight becomes a real NFR violation later, Cloudflare Images or `<picture>` with Strapi `formats` thumbnails are reasonable next steps (deferred).

Mobile 800 ms p95 perceived response (per PRD NFR): the landing renders one cached `listRegions` call; the region page renders one cached `listCrags` call; the crag page renders two cached calls (`listCrags` via `getCragBySlug`, `listRoutes` via `listRoutesByCrag`) plus one cached `listRegions` for the breadcrumb. All three pages have zero client-side JS islands, so first paint is bounded by upstream cache hit + Tailwind CSS over the wire. This stays well inside 800 ms on a cache hit.

No memoization, no SWR, no per-isolate LRU. Webhook-based cache invalidation remains the documented F-01 follow-up.

## Migration Notes

No Supabase migration. No Strapi schema change. No data migration of any kind — the slice is read-only over existing F-01 + `catalog-crag-photos-multi` content.

The "starter retirement" (deleting `Welcome.astro` and `Topbar.astro`) is a destructive code change. Both files have zero non-`index.astro` consumers (verified by `rg "Welcome|Topbar" src/`), so the rollback story is simply `git revert` the deletion commit alongside the landing rewrite.

The Strapi auth cookies and middleware behavior are untouched. Visitors with existing sessions stay signed in; the header just changes how that state is presented.

## References

- Roadmap entry: `context/foundation/roadmap.md` (S-01 "Public catalog browse", lines 118-128, 200)
- PRD: `context/foundation/prd.md` (FR-001 through FR-003, NFRs on mobile/Polish/response time)
- F-01 archive: `context/archive/2026-05-26-catalog-content-contract/plan.md` (canonical read contract)
- `catalog-crag-photos-multi` plan: `context/changes/catalog-crag-photos-multi/plan.md` (current `CatalogCrag.photos` shape)
- Existing catalog module: `src/lib/catalog/index.ts`, `src/lib/catalog/strapi.client.ts`, `src/lib/catalog/cache.ts`, `src/lib/catalog/types.ts`
- Existing smoke page (diagnostic patterns reused): `src/pages/catalog-smoke/regions.astro`
- Existing chrome: `src/layouts/Layout.astro`, `src/components/Topbar.astro` (deleted in Phase 1), `src/components/Welcome.astro` (deleted in Phase 1)
- Astro 6 rewrite/404 pattern: Astro docs — "Rendering live content in Astro pages" (verified via Context7)
- Repo rules: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Catalog chrome, slug helpers, landing, and 404

#### Automated

- [x] 1.1 Astro types are regenerated: `npx astro sync` — caf0f4f
- [x] 1.2 Lint passes: `npm run lint` — caf0f4f
- [x] 1.3 Production build passes: `npm run build` — caf0f4f
- [x] 1.4 `rg "Welcome|Topbar" src/` returns no import or reference results. — caf0f4f
- [x] 1.5 `rg "getRegionBySlug|listCragsByRegion|getCragBySlug|listRoutesByCrag" src/lib/catalog/index.ts` returns the four new re-exports. — caf0f4f

#### Manual

- [x] 1.6 `npm run dev` loads `/` and shows the Polish SendLog landing with brand, tagline, intro, CTA, and the regions list with the sample region entry. — caf0f4f
- [x] 1.7 Header shows "Zaloguj się" when signed out and `{user.email}` + "Wyloguj" button when signed in; sign-out POST to `/api/auth/signout` works. — caf0f4f
- [x] 1.8 The "Przeglądaj rejony" CTA scrolls to the `#regiony` anchor on the same page. — caf0f4f
- [x] 1.9 Rendered HTML has `<html lang="pl">` and the document `<title>` defaults to "SendLog — katalog polskich rejonów wspinaczkowych" or the page-supplied "SendLog". — caf0f4f
- [x] 1.10 Visiting an unknown route renders the Polish 404 page with HTTP status 404. — caf0f4f
- [x] 1.11 With Strapi unreachable, the landing renders chrome + the Polish `CatalogErrorAlert`, HTTP status 500. — caf0f4f
- [x] 1.12 Mobile (375×667) layout: no horizontal scrolling, regions list legible without zoom. — caf0f4f
- [x] 1.13 No client-side JS bundle added for the landing (DevTools network panel). — caf0f4f

### Phase 2: Region detail page (`/regiony/[region]`)

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — b7ab6cc
- [x] 2.2 `npx astro sync` succeeds. — b7ab6cc
- [x] 2.3 Production build passes: `npm run build` — b7ab6cc
- [x] 2.4 `rg "getRegionBySlug" src/pages` returns the new region page. — b7ab6cc

#### Manual

- [x] 2.5 Clicking the sample region entry from `/` navigates to `/regiony/<region-slug>` and shows the region heading and list of published crags. — b7ab6cc
- [x] 2.6 Breadcrumbs show "SendLog / <Region Name>" with "SendLog" linking to `/`. — b7ab6cc
- [x] 2.7 Each crag card shows the crag name; cards with photos show the first photo as a thumbnail with admin-set `alt` (or crag name fallback); cards without photos render cleanly. — b7ab6cc
- [x] 2.8 Clicking a crag card navigates to `/regiony/<region-slug>/<crag-slug>` (404 expected at this phase). — b7ab6cc
- [x] 2.9 Visiting `/regiony/nieistniejacy-rejon` renders the Polish 404 page with HTTP status 404 (URL preserved). — b7ab6cc
- [x] 2.10 With Strapi unreachable, the page renders chrome + Polish `CatalogErrorAlert`, HTTP status 500. — b7ab6cc
- [x] 2.11 A region with zero published crags renders the Polish "Brak opublikowanych crągów w tym rejonie." copy. — b7ab6cc
- [x] 2.12 Mobile (375×667) layout: crag cards stack vertically, no horizontal scrolling. — b7ab6cc

### Phase 3: Crag detail page (`/regiony/[region]/[crag]`)

#### Automated

- [x] 3.1 Lint passes: `npm run lint`
- [x] 3.2 `npx astro sync` succeeds.
- [x] 3.3 Production build passes: `npm run build`
- [x] 3.4 `rg "getCragBySlug|listRoutesByCrag" src/pages` returns the new crag page.

#### Manual

- [x] 3.5 `/` → `/regiony/<region-slug>` → first crag (e.g., `/regiony/<region-slug>/<crag-slug>`) renders crag name, coordinates as text, hero photo + thumbnail strip (when ≥1 photo), and routes table.
- [x] 3.6 Breadcrumbs show "SendLog / <Region Name> / <Crag Name>" with first two linking back; the region label shows the region's Polish name (not the slug).
- [x] 3.7 A crag with no photos renders without the hero/strip and without errors.
- [x] 3.8 A crag with multiple photos shows the first as hero and the rest in a horizontally scrollable strip on mobile.
- [x] 3.9 Each route row shows `name`, `grade`, `type`, and either `yearSet` or "—" when null.
- [x] 3.10 A crag with zero routes renders the Polish "Brak tras dla tej skały." copy.
- [x] 3.11 Visiting `/regiony/<region-slug>/nieistniejacy-crag` renders the Polish 404 page (URL preserved, status 404).
- [x] 3.12 Signed-in vs signed-out header states render correctly on the crag page; NO per-route climb-log CTA is present.
- [x] 3.13 With Strapi unreachable, the crag page renders chrome + Polish `CatalogErrorAlert`, status 500.
- [x] 3.14 Mobile (375×667) layout: hero photo respects aspect ratio, thumbnail strip scrolls horizontally, route table stacks rows with labels visible.
- [x] 3.15 No client-side JS bundle added for the crag page (DevTools network panel).
- [x] 3.16 `STRAPI_API_TOKEN` does not appear in rendered HTML or any network response.

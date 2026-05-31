# Crag Map Navigation (S-02) Implementation Plan

## Overview

Ship S-02 (PRD FR-004 / FR-005): on the public homepage `/`, replace the current regions-list section with an interactive Leaflet map of every published crag. Each marker uses a custom CSS-themable `L.divIcon`; tapping a pin opens a popup with the crag name and an "Otwórz trasy" link that navigates to the S-01 crag detail page at `/regiony/[regionSlug]/[cragSlug]`. The map auto-fits to all pins on first render (single-pin branch uses `setView`).

The map is a `client:only="react"` React island so Leaflet never imports in the Cloudflare Worker SSR path. The Astro wrapper that owns the server fetch (`listCrags()` + `listRegions()`) passes a serializable `CragMapPin[]` DTO into the island and renders an SSR crag list (grouped by region) in the island's `fallback` slot — so visitors on slow cellular, no-JS browsers, or screen readers see the same crag set as text with links.

OSM raster tiles with the required attribution ship for v1; a tile-provider migration is held back as a v2 follow-up. The PRD-documented Tier 2 fallback (static crag-locator + external mapping deep links) is not in this slice; it ships only if the Phase 2 mobile-cellular tripwire fires (~4h budget post-Phase 1), in which case this plan is parked and a sibling change `crag-map-fallback` is opened via `/10x-new`.

## Current State Analysis

The Astro app today is post-S-01 on the public face: `/` renders a SendLog hero (`src/pages/index.astro:18-34`) plus an `#regiony` section consuming `RegionsList.astro` (`src/components/catalog/RegionsList.astro`), which links each published region to `/regiony/[region]`. The region page (`src/pages/regiony/[region]/index.astro`) renders a list of crags via `CragCard.astro`. The crag page (`src/pages/regiony/[region]/[crag].astro:49-52`) shows coordinates as text (`crag.latitude.toFixed(5), crag.longitude.toFixed(5)`).

The catalog read contract is stable and S-02 needs no new helpers:

- `src/lib/catalog/index.ts:12-30` — public surface; `listCrags()` and `listRegions()` are the only server calls this slice needs. Doc comment is explicit: "Import from `@/lib/catalog`; never reach into `strapi.client.ts` or `cache.ts` directly from outside this folder." Catalog reads are server-only because they carry a Strapi API token.
- `src/lib/catalog/strapi.client.ts:224-228` — `listCrags()` populates `["photos", "region"]`; the mapped `CatalogCrag` carries `latitude`, `longitude`, `regionId`, `regionSlug` (`src/lib/catalog/types.ts:26-35`). Same cache key as any prior `listCrags()` call — adding a new caller does NOT add Strapi request count.
- `src/lib/catalog/strapi.client.ts:177-187` — Strapi crag → `CatalogCrag` mapping; `regionId` / `regionSlug` are `null` when the upstream record lacks a populated region.
- `src/lib/catalog/cache.ts:55-86` — Cloudflare Cache API wrapper, 1h TTL; local Strapi and `bypassCache` skip; `caches.default` unavailable (Node build) also skips.

The chrome and middleware:

- `src/layouts/CatalogLayout.astro` — Polish light-theme chrome shared by all S-01 pages and the 404.
- `src/components/catalog/CatalogErrorAlert.astro` — reusable Polish error UI for `CatalogError` and friends.
- `src/middleware.ts:1-28` — populates `Astro.locals.user`; `PROTECTED_ROUTES = ["/dashboard"]`. The homepage is public; the middleware does not touch it.

React islands:

- `package.json:14-35` — React 19, `@astrojs/react`, Astro 6, Tailwind 4, Cloudflare adapter present; `leaflet` and `react-leaflet` are NOT installed.
- `src/components/auth/SignInForm.tsx` and friends use `client:load`; no React component currently uses `client:only="react"`. S-02 introduces the first `client:only` island.
- `src/components/ui/button.tsx` is the only shadcn primitive installed; this slice does not need additional shadcn components — semantic HTML + Tailwind + `cn()` from `@/lib/utils` is enough.

Strapi content for Sokoliki is loaded manually by the project owner via Strapi Cloud admin per the roadmap S-07 note. The plan assumes published crags carry valid `latitude`, `longitude`, and `regionSlug`; this is verified at Phase 1 manual-success step 1.6 (the map renders pins).

## Desired End State

- `/` renders the existing SendLog hero, plus a new `#mapa` section that replaces the prior `#regiony` section. The CTA in the hero ("Przeglądaj rejony", `href="#regiony"`) is updated to "Zobacz crągi na mapie" with `href="#mapa"`.
- The `#mapa` section renders an interactive Leaflet map of all published crags as themed `L.divIcon` markers.
- First marker tap opens a popup with the crag name (`<strong>`) and an "Otwórz trasy" link to `/regiony/[regionSlug]/[cragSlug]`. The link navigates in the same tab (no `target="_blank"`).
- On first mount, the map auto-fits to all pins via `fitBounds` with `padding: [40, 40]`; with a single crag, the map centers and zooms via `setView([lat, lng], 14)` to avoid Leaflet's world view.
- Crags missing `regionSlug` or with invalid coordinates (`Number.isFinite === false`, lat outside `[-90, 90]`, lng outside `[-180, 180]`) are filtered out server-side, excluded from both map and fallback, and logged with `console.warn({ slug, reason })` for diagnostic visibility. Never throws.
- With JavaScript disabled (or during the brief hydration window on slow cellular), the same `#mapa` section renders a Polish crag list grouped by region (`<h3>` per region name, `<ul>` of `<a>` links) inside the island's `fallback` slot. Empty pins → reuses the S-01 Polish "Brak opublikowanych skał" wording.
- OSM raster tiles via `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with the required `attribution` prop. No tile-provider API key in environment, in code, or in Strapi.
- `src/components/catalog/RegionsList.astro` is deleted (newly orphaned after the homepage swap; only consumer was `/`).
- `change.md` front matter is updated to `change_id: crag-map-navigation`, `status: planned`, `updated: 2026-05-31` (already done by this plan-write step).
- `npm install`, `npx astro sync`, `npm run lint` (type-checked), and `npm run build` all pass.
- A real phone over cellular (Safari iOS and Chrome Android) renders the map, lets the visitor tap a pin, see the popup, and navigate to the crag's route list within an acceptable response budget — verified manually in Phase 2.

### Key Discoveries

- `listCrags()` already populates `region` and `photos` so both the map DTO and the SSR fallback list can be built from one cached upstream payload (`src/lib/catalog/strapi.client.ts:224-228`). No new Strapi reads are introduced by this slice.
- `CatalogCrag.regionSlug: string | null` (`src/lib/catalog/types.ts:34`); the marker `href` requires both `regionSlug` and `slug`, so the server mapper must drop crags whose `regionSlug` is null. Treat them as invalid catalog content, not as a hard error — the rest of the map should still render.
- `listRegions()` shares one cached entry; calling it on the homepage to build a `regionSlug → regionName` map for the fallback's group headings adds zero extra Strapi requests (`src/lib/catalog/strapi.client.ts` regions read uses the same `withCache` wrapper).
- Astro's `client:only` directive accepts a `<Fragment slot="fallback">` (or any element with `slot="fallback"`) whose contents render server-side and are replaced when the island mounts — the canonical SSR-fallback shape for client-only islands.
- The Leaflet default marker icon breaks under Vite because Leaflet's relative asset paths don't survive Vite's module rewriting. Using `L.divIcon` exclusively sidesteps this (no `marker-icon.png` / `marker-shadow.png` imports needed); the alternative — rewiring `L.Icon.Default.mergeOptions` with `marker-icon{,-2x}.png` + `marker-shadow.png` URL imports — is documented in `./leaflet-api-reference.md:152-161` but unnecessary here.
- `<MapContainer>` props (`center`, `zoom`, `bounds`) are immutable after first render; runtime view changes must go through `useMap()`. The plan uses a small `FitToCrags` child component that consumes `useMap()` and reacts to `pins` changes via a single `useEffect`.
- Wrap `<MapContainer>` in `useMemo(..., [pins])` so React re-renders of the parent don't re-instantiate Leaflet's `Map` instance (react-leaflet external-state pattern, called out in `./leaflet-api-reference.md:35`).
- `<MapContainer>` needs an explicit height or the tile pane renders 0px tall and tiles never load. Use a Tailwind utility (`h-[60vh]` or similar) merged via `cn()` from `@/lib/utils`.
- `@astrojs/cloudflare` runs Astro on Cloudflare Workers (`workerd`); the worker has no `window`/`document`. Any module that imports `leaflet` at top level must be reachable only from `client:only="react"` — never inside an `.astro` frontmatter, an Astro middleware, an API route, or `src/lib/catalog/*`.
- Polish noun plural for "crąg" (m/inanimate): 1 → "skała", 2-4 → "skały", 5+ → "skał". The existing region page uses "skał" (the >=5 form) in the "Brak opublikowanych skał" message; for the section subtitle, a small inline branch (`count === 1 ? "1 crąg" : count >= 2 && count <= 4 ? \`${count} skały\` : \`${count} skał\``) is correct without an i18n library.
- `RegionsList.astro` has exactly one consumer (`/`) — confirmed by reading `src/pages/index.astro:3`. Deleting it is safe and matches the S-01 precedent of removing orphaned starter components in the same slice (`Welcome.astro`, `Topbar.astro` from `context/archive/2026-05-29-public-catalog-browse/plan.md`).

## What We're NOT Doing

- **A region-scoped map at `/regiony/[region]`**: the region page keeps its S-01 list shape. The homepage map covers all crags (single-region in v1).
- **Tile-provider migration**: v1 ships OSM raster with attribution. Swapping to MapTiler / Stadia / OpenFreeMap / Protomaps+R2 is recorded as a v2 follow-up; not in this slice.
- **Vector tiles / MapLibre / Mapbox / Google Maps**: research already settled the library choice; vector tiles are not needed at v1 scale.
- ~~**Marker clustering**: pin count is small (<20 expected at v1); clustering is out of scope.~~ **Adapted during Phase 1**: visual verification surfaced co-located crags (e.g. multiple Rzędkowice pins overlapping at low zoom) that the small-pin-count assumption did not cover. Added `leaflet.markercluster` with default options (click cluster → zoom to bounds) inside the existing `client:only="react"` island.
- **User-location geolocation / "find nearest crag"**: out of scope.
- **GPX export, route lines, polygons, search/filter**: out of scope (PRD Non-Goals exclude search/filters in v1).
- **PRD-named Tier 2 fallback (static crag-locator + `geo:` / Google Maps deep links)**: held back to a separate change `crag-map-fallback`, opened only if the Phase 2 tripwire fires.
- **shadcn primitives beyond `button.tsx`**: no new shadcn installs.
- **New API routes, Supabase migrations, Strapi schema changes, env-var additions**: none.
- **Sitemap entry for `/#mapa`**: the existing `/` entry covers it; no separate sitemap change.
- **Tests**: no test runner is configured (`AGENTS.md`). Intended coverage is documented in a new `src/components/catalog/__tests__/README.md` and an extension of `src/lib/catalog/__tests__/README.md`.
- **Auth-page or dashboard restyle, climb-log surface, projects list**: those belong to S-03 / S-04 / S-06.

## Implementation Approach

Two phases, both leave the app shippable:

1. **Phase 1** installs Leaflet + react-leaflet, adds the `CragMapPin` DTO and the `toCragMapPins()` server mapper, builds the `CragMap` React island (custom `L.divIcon`, popup-then-link, `FitToCrags`, OSM raster `<TileLayer>` with attribution), wraps it in a `CragMapSection.astro` that fetches data server-side and renders an SSR crag list grouped by region in the `fallback` slot, swaps the homepage `#regiony` section to `#mapa`, updates the hero CTA, and deletes the orphaned `RegionsList.astro`. Lint, type-check, and build all pass; desktop dev (`npm run dev`) renders the map with pins.
2. **Phase 2** is the mobile-cellular verification: real-phone smoke on Safari iOS + Chrome Android, single-pin edge-case check, no-JS fallback check, console-error sweep. If green within the ~4h tripwire budget, sign off by writing `verification.md` to the change folder and proceed to `/10x-archive`. If the tripwire fires, write `tripwire-fired.md` recording the failure mode, park this plan, and open `/10x-new crag-map-fallback` for the PRD-named Tier 2 path.

Each Astro page/component follows the existing S-01 patterns: try/catch around catalog reads, `Astro.response.status = 500` on `CatalogError`, `<CatalogErrorAlert>` inside the chrome, Polish strings inline.

## Critical Implementation Details

### SSR boundary (hard rule)

`leaflet`, `react-leaflet`, and `leaflet/dist/leaflet.css` are imported only from `src/components/catalog/CragMap.tsx`. They MUST NOT appear in any `.astro` file, in `src/lib/`, in `src/middleware.ts`, or in `src/pages/api/`. Cloudflare Workers (`workerd`) has no `window`; a stray top-level `import "leaflet"` from a server-evaluated file would crash the worker on first request. Phase 1 Success Criterion 1.5 codifies this as a grep invariant — keep the check in CI-friendly shape so future contributors don't accidentally regress it.

### Type-only catalog import on the island

`CragMap.tsx` imports `import type { CragMapPin } from "@/lib/catalog"`. Type-only imports are erased at compile time and never reach the client bundle, so they don't drag the server-only `strapi.client.ts` runtime into the island. Any non-type import from `@/lib/catalog` inside `CragMap.tsx` would break this invariant.

### MapContainer lifetime

Wrap the `<MapContainer>` subtree in `useMemo(..., [pins])` so React re-renders of the section parent don't re-instantiate Leaflet's `Map`. The `FitToCrags` helper (a child of `<MapContainer>`) consumes `useMap()` and runs a single `useEffect` keyed on `pins`. Without `useMemo`, the map flashes and `whenReady` fires multiple times during dev hot-reload.

### Single-pin branch in FitToCrags

`fitBounds` on a single point picks the world view. Branch: `pins.length === 1 → map.setView([lat, lng], 14)`; `pins.length > 1 → map.fitBounds(pins.map(p => [p.latitude, p.longitude]), { padding: [40, 40] })`. The padding leaves room for any future overlay (Tailwind header is sticky; this preserves headroom). `pins.length === 0` → no view change; the SSR fallback empty-state handles the user-visible message.

---

## Phase 1: Interactive map slice

### Overview

Install dependencies, add the DTO + server mapper, build the React island, build the Astro wrapper with SSR fallback, swap the homepage section, retire the orphaned `RegionsList`. After this phase, the homepage on desktop dev renders the interactive map with pins; lint and build pass.

### Changes Required

#### 1. Install runtime dependencies

**File**: `package.json` (via `npm install`)

**Intent**: Add Leaflet + react-leaflet + Leaflet types so the React island can import them.

**Contract**: `npm install leaflet react-leaflet` adds both to `dependencies`. `npm install -D @types/leaflet` adds the type package (Leaflet ships no built-in types; react-leaflet ships its own). React-leaflet v5+ requires React 19 — matches the codebase. Versions resolved at install time. Do not pin majors unless the install fails; let `^` carry the latest compatible minor.

#### 2. Add the CragMapPin DTO + server mapper

**File**: `src/lib/catalog/map.ts` (new; server-safe, type-only imports remain client-safe)

**Intent**: Define the minimum serializable contract the React island consumes; provide a pure-function mapper that converts `CatalogCrag[]` + `CatalogRegion[]` into `CragMapPin[]`, filtering invalid records and resolving region names.

**Contract**:

- Exports `interface CragMapPin { id: string; name: string; latitude: number; longitude: number; href: string; regionSlug: string; regionName: string; }`.
- Exports `function toCragMapPins(crags: CatalogCrag[], regions: CatalogRegion[]): CragMapPin[]`.
- Valid crag = `regionSlug !== null`, `Number.isFinite(latitude)`, `Number.isFinite(longitude)`, `-90 <= latitude <= 90`, `-180 <= longitude <= 180`.
- Invalid crag → filtered out, with `console.warn({ slug: crag.slug, reason })` for diagnostic visibility. Never throws.
- `regionName` is resolved by case-sensitive slug lookup in `regions`; if no match, fall back to the slug itself (defensive — the UI never breaks on a missing region label).
- `href` = `/regiony/${regionSlug}/${crag.slug}` — matches the shipped S-01 route shape (`src/pages/regiony/[region]/[crag].astro`). Do not URL-encode; admins enter URL-safe slugs in Strapi.
- Pure function; no side effects besides the diagnostic `console.warn`.
- File-level docblock: state explicitly that this file is server-safe (no top-level browser imports) and that `CragMapPin` is type-only-importable from React islands.

#### 3. Re-export the new DTO + mapper from `@/lib/catalog`

**File**: `src/lib/catalog/index.ts`

**Intent**: Surface the new exports through the module's public API, consistent with how every other catalog symbol is exported.

**Contract**: Add `export { toCragMapPins, type CragMapPin } from "@/lib/catalog/map";` to the existing export block. Order does not matter; group with the other type/function exports.

#### 4. Build the React island

**File**: `src/components/catalog/CragMap.tsx` (new)

**Intent**: Render the interactive Leaflet map for `client:only="react"`. This is the ONLY file in the repo that imports `leaflet`, `react-leaflet`, and `leaflet/dist/leaflet.css`.

**Contract**:

- Default-exports `function CragMap({ pins }: { pins: CragMapPin[] })`.
- `import type { CragMapPin } from "@/lib/catalog"` (type-only — keep server runtime out of the client bundle).
- Imports: `import L from "leaflet"; import "leaflet/dist/leaflet.css"; import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";`.
- Module-scoped `cragIcon = L.divIcon({ className: "crag-pin", html: "<inline SVG marker>", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] })`. The inline SVG should be a simple pin shape (drop pin or teardrop) coloured via CSS class so it can adapt to future dark mode without re-rendering.
- Render `<MapContainer>` with explicit height (e.g. `style={{ height: "60vh", width: "100%" }}` or Tailwind via `className={cn("h-[60vh] w-full", ...)}`), `scrollWheelZoom={false}` (mobile-friendly default), and no `center`/`zoom` (the `FitToCrags` child owns the view).
- Children: `<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} />`, then `pins.map(pin => <Marker key={pin.id} position={[pin.latitude, pin.longitude]} icon={cragIcon}><Popup><PopupBody pin={pin} /></Popup></Marker>)`, then `<FitToCrags pins={pins} />`.
- `PopupBody` is an inline component rendering `<strong>{pin.name}</strong>` then `<a href={pin.href}>Otwórz trasy</a>` (Polish), separated by a `<br/>` or styled with a `<div>` — kept simple, no shadcn primitives.
- `FitToCrags` is a sibling component: `function FitToCrags({ pins }: { pins: CragMapPin[] })` → consumes `useMap()`; `useEffect` keyed on `pins` runs `map.setView` (single) or `map.fitBounds` (multi) with `padding: [40, 40]`; returns `null`.
- Wrap the whole `<MapContainer>` subtree in `useMemo` keyed on `pins` (the parent should re-render only when the pin set changes, but the memo defends against future external state).
- Do NOT import anything from `@/lib/catalog` other than the `type CragMapPin`. Do NOT call `console.error` for empty `pins.length === 0` — the SSR fallback handles the empty case.

#### 5. Build the SSR fallback list

**File**: `src/components/catalog/CragMapFallbackList.astro` (new)

**Intent**: Render the no-JS / slow-cellular / screen-reader version of the map data as a plain Polish crag list, grouped by region. Lives in the `fallback` slot of the React island.

**Contract**:

- Props: `{ pins: CragMapPin[] }`.
- Empty pins → render the existing S-01 Polish empty state: `<p class="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">Brak opublikowanych skał.</p>`.
- Non-empty pins → group by `regionSlug` (preserving the first-seen order from the upstream `name:asc` sort). For each region: `<h3>{regionName}</h3>` then `<ul>` of `<li><a href={pin.href}>{pin.name}</a></li>`. Reuse the Tailwind classes from `RegionsList.astro` (`block rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50`) so the fallback feels like part of the page, not a stripped-down downgrade.
- Pure-Astro component; no JS island. No `client:*` directives.

#### 6. Build the Astro wrapper section

**File**: `src/components/catalog/CragMapSection.astro` (new)

**Intent**: Server-side fetch + DTO mapping + composes the React island and its SSR fallback list. This is the SSR/island seam: the only file that imports both `@/lib/catalog` (server) and the `CragMap` React island.

**Contract**:

- Frontmatter imports: `import { listCrags, listRegions, toCragMapPins, type CragMapPin } from "@/lib/catalog";`, `import CatalogErrorAlert from "@/components/catalog/CatalogErrorAlert.astro";`, `import CragMapFallbackList from "@/components/catalog/CragMapFallbackList.astro";`, `import CragMap from "@/components/catalog/CragMap";`.
- Calls `listCrags()` and `listRegions()` server-side in parallel via `Promise.all`. Both reuse the existing Cloudflare Cache API entries — zero extra Strapi requests.
- Runs `toCragMapPins(crags, regions)` to produce the DTO.
- On `CatalogError` (caught around the `Promise.all`): set `Astro.response.status = 500`, render the section heading + `<CatalogErrorAlert error={error} />` inside the same `<section>` so the page chrome still renders.
- On success, render:
  ```astro
  <section id="mapa" class="mt-8 sm:mt-12">
    <h2 class="text-2xl font-semibold text-slate-900">Crągi</h2>
    <p class="mt-2 text-sm text-slate-600">{pluralizeCrags(pins.length)}</p>
    <div class="mt-4">
      <CragMap client:only="react" pins={pins}>
        <Fragment slot="fallback">
          <CragMapFallbackList pins={pins} />
        </Fragment>
      </CragMap>
    </div>
  </section>
  ```
- `pluralizeCrags(count: number): string` is a small inline helper at the top of the frontmatter: `count === 1 ? "1 crąg" : count >= 2 && count <= 4 ? \`${count} skały\` : \`${count} skał\``.
- Do NOT import `leaflet` or `react-leaflet` directly — only the `CragMap` component (which itself owns those imports inside the `client:only` boundary).

#### 7. Swap the homepage section

**File**: `src/pages/index.astro`

**Intent**: Replace the `#regiony` section that consumed `RegionsList` with the new `#mapa` section that consumes `CragMapSection`. The hero (brand, tagline, intro paragraph) stays unchanged; the CTA href + label change to point at the new anchor.

**Contract**:

- Remove the `RegionsList` import and the `listRegions` import; remove the page-level `regions` / `error` state and the surrounding try/catch (errors now live inside `CragMapSection`).
- Add `import CragMapSection from "@/components/catalog/CragMapSection.astro";`.
- Change the CTA: `href="#regiony"` → `href="#mapa"`; label `"Przeglądaj rejony"` → `"Zobacz crągi na mapie"`.
- Replace the entire `<section id="regiony">…</section>` block with `<CragMapSection />` (the section owns its own `<section id="mapa">` wrapper).
- Keep the `CatalogLayout title="SendLog"` wrapper and the hero `<section>` exactly as-is.

#### 8. Delete the orphaned RegionsList component

**File**: `src/components/catalog/RegionsList.astro` (DELETE)

**Intent**: After the homepage swap, this component has no consumers (verified by reading `src/pages/index.astro:3` — its only import site). Delete it to keep the tree clean and follow the S-01 precedent of removing newly-orphaned components in the same slice.

**Contract**: File removed. No other file referenced it; no follow-up grep cleanup needed.

#### 9. Document intended test surface

**File**: `src/components/catalog/__tests__/README.md` (new) + `src/lib/catalog/__tests__/README.md` (extend)

**Intent**: Mirror the existing `src/lib/catalog/__tests__/README.md` pattern. Document what would be tested once a runner exists.

**Contract**:

- New `src/components/catalog/__tests__/README.md` covers `CragMap` rendering (FitToCrags single vs multi branch, popup link href construction, attribution presence, `cragIcon` className) and `CragMapFallbackList` (empty state, grouping order, link href construction).
- Extend `src/lib/catalog/__tests__/README.md` with a `### Map mapper (`map.ts`)` section listing `toCragMapPins` cases: `null regionSlug` filtered, `NaN` coordinates filtered, out-of-range lat/lng filtered, region-name resolution by slug, region-name fallback to slug when no region matches, preserves upstream order.

### Success Criteria

#### Automated Verification:

- Dependencies install cleanly: `npm install` succeeds with no peer-dependency errors about React or Leaflet
- Astro types regenerated: `npx astro sync` succeeds
- Lint + type check passes: `npm run lint`
- Production build passes: `npm run build`
- Pre-commit hook passes on staged files (`lint-staged` runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`)
- No `leaflet` or `react-leaflet` import leaks: `rg -l "leaflet|react-leaflet" src/pages src/lib src/middleware.ts src/components --type-add 'astro:*.astro' --type astro --type ts` returns no `.astro`, `src/lib/`, `src/middleware.ts`, or `src/pages/api/` hits (the only allowed match is `src/components/catalog/CragMap.tsx`)

#### Manual Verification:

- `npm run dev` against Strapi Cloud: the homepage renders the SendLog hero, then the `#mapa` section with a custom-divIcon pin per published Sokoliki crag (visually verifies that Strapi content has populated `latitude`, `longitude`, and `regionSlug` for at least one crag — resolves the research open question)
- Clicking a pin opens a popup with the crag name in `<strong>` and a Polish "Otwórz trasy" link; clicking the link navigates in the same tab to `/regiony/[regionSlug]/[cragSlug]` and the existing S-01 crag page renders
- The map auto-fits to all pins on first load (visible viewport contains every pin with some padding); if the catalog has exactly one published crag, the map centers on that crag at zoom ~14 instead of showing the world
- DevTools → Disable JavaScript → reload `/`: the `#mapa` section renders the SSR Polish crag list (grouped by region, each crag a styled link); clicking a link navigates to the crag page
- OSM attribution is visible in the bottom-right of the map
- The hero CTA "Zobacz crągi na mapie" scrolls smoothly to the `#mapa` section
- No regressions on `/regiony/[region]` or `/regiony/[region]/[crag]` — both still render correctly; 404 still works for unknown region/crag slugs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the desktop dev experience matches the spec before proceeding to Phase 2.

---

## Phase 2: Mobile-cellular verification + tripwire decision

### Overview

Verify the slice on real phones over cellular. No code changes are made by default; the phase outcome is either a documented sign-off (`verification.md`) or a documented tripwire firing (`tripwire-fired.md`) that triggers opening a sibling change for the Tier 2 fallback.

### Changes Required

By default, no code changes. The phase outputs one of two documentation artifacts in the change folder:

- **On sign-off** — write `context/changes/crag-map-navigation/verification.md` recording the phones tested, OS/browser versions, observed behavior, and the timestamp.
- **On tripwire firing** — write `context/changes/crag-map-navigation/tripwire-fired.md` recording the failure mode (broken on mobile, blank tiles, console errors, focused effort exceeded ~4h budget without a path forward), then run `/10x-new crag-map-fallback` to open the sibling change for the PRD-named Tier 2 path. This plan's `change.md` status moves to `parked`; this plan is not edited further.

### Success Criteria

#### Manual Verification:

- On Safari iOS (real phone, cellular, not WiFi): map loads inside ~3s after the hero renders, tiles fill the visible area without blank squares, pins are tappable (tap target large enough for a thumb), popup opens, link inside popup navigates to the crag's route list
- On Chrome Android (real phone, cellular): same checks as above
- On the same phones, with DevTools (or `chrome://inspect` / Safari Web Inspector) throttling to "Slow 3G" or with airplane-mode-then-WiFi over a known-slow connection: the SSR crag list visibly renders inside the `#mapa` section as the fallback during the slow tile-load period
- No console errors in Safari Web Inspector or Chrome DevTools (Remote Debugging) on the homepage
- Single-pin edge case: temporarily unpublish all-but-one crag in Strapi, hard-refresh `/`, confirm the map centers on the remaining crag at zoom ~14 (not the world view), re-publish. Cleanup: republish the unpublished crags after the check
- Tripwire decision documented in the change folder: either `verification.md` (sign-off) or `tripwire-fired.md` (failure mode + link to new `crag-map-fallback` change)

**Implementation Note**: This phase is verification-only by default. Code only changes if the tripwire fires, and in that case the work moves to a sibling change folder via `/10x-new crag-map-fallback` — do not edit this plan's code surface or success criteria after Phase 1 lands.

---

## Testing Strategy

### Unit Tests

(Future — no test runner is configured per `AGENTS.md`. Coverage targets are documented in `src/components/catalog/__tests__/README.md` and `src/lib/catalog/__tests__/README.md`.)

- `toCragMapPins` filtering: null `regionSlug`, `NaN` / non-finite coordinates, latitude outside `[-90, 90]`, longitude outside `[-180, 180]`
- `toCragMapPins` region-name resolution: matched slug → region name, unmatched slug → falls back to the slug itself
- `toCragMapPins` href construction: `/regiony/${regionSlug}/${slug}` exactly
- `FitToCrags` single-pin branch (calls `setView` with zoom 14, not `fitBounds`)
- `FitToCrags` multi-pin branch (calls `fitBounds` with `padding: [40, 40]`)
- `CragMap` popup body: contains `<strong>{name}</strong>` and `<a href={href}>Otwórz trasy</a>`
- `CragMapFallbackList` empty state, grouping order, link href

### Integration / Smoke Tests

(Manual, until a runner exists)

- `/` renders pins matching the count of published crags in Strapi (visual count)
- Clicking a pin → popup → link → arrives at `/regiony/[regionSlug]/[cragSlug]` with HTTP 200 (Network panel check)
- `/regiony/<unknown>` still 404s (regression check)
- Strapi outage (point `STRAPI_API_URL` at an invalid host in `.dev.vars`, restart `npm run dev`): `/` still renders the SendLog hero + section heading + `<CatalogErrorAlert>` inside `#mapa`; HTTP 500

### Manual Testing Steps

1. `npm install && npm run dev`; visit `http://localhost:4321/`; confirm hero + map + pins
2. Click a pin → confirm popup with name and "Otwórz trasy" link → click the link → confirm landing on the crag's route list
3. DevTools → Disable JavaScript → reload `/` → confirm SSR fallback list renders inside `#mapa`
4. Bind dev server to LAN (`npm run dev -- --host`) and connect a real phone via local network (Safari iOS + Chrome Android); confirm desktop behavior reproduces. For true cellular verification, deploy to Cloudflare (preview) and repeat on cellular
5. Single-pin test: unpublish all-but-one crag in Strapi → hard refresh → confirm `setView` (not `fitBounds`-world); republish

## Performance Considerations

- Leaflet runtime is ~42 KB gzipped + ~4 KB CSS; added to the client bundle only when the island hydrates — the SSR HTML stays small and the homepage's FCP/TTI is not impacted by the island weight
- OSM tile requests happen on the client; the cellular budget of ~3s for first paint is mostly tile-network-bound, not bundle-bound
- The Cloudflare Cache API entry for `listCrags()` and `listRegions()` is already in place (1h TTL); the new homepage adds zero new Strapi requests
- The CSS-themable `divIcon` avoids loading PNG marker assets entirely, saving 3 image requests per page load (and sidestepping the Vite default-icon bundling break)

## Migration Notes

- No data migration; no Strapi schema change; no Supabase migration
- No environment-variable additions
- `change.md` front matter is updated from `change_id: crag-map-navigation-investigation` / `status: research` to `change_id: crag-map-navigation` / `status: planned` as part of this plan-writing step
- After Phase 2 sign-off, `change.md.status` moves to `implementing` (during `/10x-implement`) and then `implemented`; the change is archived to `context/archive/YYYY-MM-DD-crag-map-navigation/` via `/10x-archive`
- Investigation artifacts (`research.md`, `library-research.md`, `leaflet-api-reference.md`) stay in this folder as history; do not move or delete them

## References

- Research: `context/changes/crag-map-navigation/research.md`
- Library survey: `context/changes/crag-map-navigation/library-research.md`
- Leaflet + react-leaflet API reference: `context/changes/crag-map-navigation/leaflet-api-reference.md`
- PRD: `context/foundation/prd.md` (FR-004, FR-005; line 168 fallback note)
- Roadmap: `context/foundation/roadmap.md` (S-02; lines 130-141)
- S-01 prior slice (precedent for chrome, error UI, page patterns, orphaned-component deletion): `context/archive/2026-05-29-public-catalog-browse/plan.md`
- Catalog module public surface: `src/lib/catalog/index.ts`
- Catalog server client (`listCrags`, `listRegions`, mappers): `src/lib/catalog/strapi.client.ts:177-263`
- Current homepage (`/`, to be swapped): `src/pages/index.astro`
- Current S-01 region/crag pages (route shape for marker hrefs): `src/pages/regiony/[region]/index.astro`, `src/pages/regiony/[region]/[crag].astro`
- Astro `client:only` + `slot="fallback"` reference: <https://docs.astro.build/en/reference/directives-reference/#clientonly>

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Interactive map slice

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install` succeeds with no peer-dependency errors about React or Leaflet — d8de0fc
- [x] 1.2 Astro types regenerated: `npx astro sync` succeeds — d8de0fc
- [x] 1.3 Lint + type check passes: `npm run lint` — d8de0fc
- [x] 1.4 Production build passes: `npm run build` — d8de0fc
- [x] 1.5 Pre-commit hook passes on staged files (`lint-staged` runs `eslint --fix` and `prettier --write`) — d8de0fc
- [x] 1.6 No `leaflet` or `react-leaflet` import leaks into `.astro` files, `src/lib/`, `src/middleware.ts`, or `src/pages/api/` (grep invariant) — d8de0fc

#### Manual

- [x] 1.7 `npm run dev`: homepage renders the SendLog hero, then the `#mapa` section with a custom-divIcon pin per published Sokoliki crag — d8de0fc
- [x] 1.8 Clicking a pin opens a popup with the crag name (`<strong>`) and a Polish "Otwórz trasy" link; clicking the link navigates in the same tab to `/regiony/[regionSlug]/[cragSlug]` — d8de0fc
- [x] 1.9 The map auto-fits to all pins on first load; single-pin catalog state centers on the one crag at zoom ~14 (no world view) — d8de0fc
- [x] 1.10 DevTools → Disable JavaScript → reload `/`: the `#mapa` section renders the SSR Polish crag list (grouped by region, links work, no broken layout) — d8de0fc
- [x] 1.11 OSM attribution is visible in the bottom-right of the map — d8de0fc
- [x] 1.12 The hero CTA "Zobacz crągi na mapie" scrolls to the `#mapa` section — d8de0fc
- [x] 1.13 No regressions on `/regiony/[region]` or `/regiony/[region]/[crag]`; 404 still works for unknown region/crag slugs — d8de0fc

### Phase 2: Mobile-cellular verification + tripwire decision

#### Manual

- [x] 2.1 Safari iOS (real phone, cellular): map loads in ~3s, tiles fill viewport without blank squares, pins are tappable, popup opens, link navigates to the crag's route list
- [x] 2.2 Chrome Android (real phone, cellular): same checks as 2.1
- [x] 2.3 Throttled "Slow 3G" or known-slow cellular on a real phone: the SSR Polish crag list visibly renders inside `#mapa` during the slow tile-load period
- [x] 2.4 No console errors in Safari Web Inspector or Chrome DevTools (Remote Debugging) on the homepage
- [x] 2.5 Single-pin edge case (temporarily unpublish all-but-one crag in Strapi): the map centers on the remaining crag at zoom ~14, not the world view; republish all crags after the check
- [x] 2.6 Tripwire decision documented in the change folder: either `verification.md` (sign-off) or `tripwire-fired.md` (failure mode + link to the new `crag-map-fallback` change opened via `/10x-new`)

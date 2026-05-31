# Crag Map Navigation (S-02) — Plan Brief

> Full plan: `context/changes/crag-map-navigation/plan.md`
> Research: `context/changes/crag-map-navigation/research.md`

## What & Why

Ship S-02: replace the regions-list section on the public homepage `/` with an interactive Leaflet map of every published crag. Each pin opens a popup whose "Otwórz trasy" link navigates to the S-01 crag detail page (`/regiony/[regionSlug]/[cragSlug]`). PRD FR-004 ("visitor can view a map showing crag locations as pins") and FR-005 ("clicking a pin navigates to that crag's route list") demand this; today `/` only renders a regions list, so the geographic-locator value is missing.

## Starting Point

S-01 shipped the public catalog (`/`, `/regiony/[region]`, `/regiony/[region]/[crag]`) backed by the server-only `@/lib/catalog` module. `CatalogCrag` already carries `latitude`, `longitude`, `regionSlug`, `regionId`, and photos — no Strapi schema change. `listCrags()` and `listRegions()` are both Cloudflare-Cache-API-backed (1h TTL); adding new callers does not add Strapi request count. The homepage today renders `RegionsList` (links to regions); this slice swaps that section for the map and deletes the orphaned component.

## Desired End State

A visitor opening `/` on a mobile phone over cellular sees the SendLog hero, then an interactive map of all Sokoliki crags rendered as themed `L.divIcon` pins. Tapping a pin opens a popup with the crag name and a Polish "Otwórz trasy" link to the route list. On slow cellular, with JS disabled, or via a screen reader, the same `#mapa` section renders a Polish crag list (grouped by region) as the island's SSR `fallback` slot — so no visitor is blocked by JS or network conditions. The catalog browse experience is now geographic, not just textual.

## Key Decisions Made

| Decision                 | Choice                                                                                             | Why (1 sentence)                                                                                                                       | Source   |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Library                  | Leaflet + react-leaflet                                                                            | Mature, ~42 KB gzip, free OSM tiles, no API key — best fit for `main_goal: speed` and a single-region v1                               | Research |
| Placement                | Homepage `/`, replacing the `RegionsList` section                                                  | One-click map entry from the landing; `listCrags()` covers all (single-region) crags in one cached read                                | Plan     |
| Pin click UX             | Popup-then-link (first tap = popup, second tap = navigate)                                         | Mobile users frequently tap pins to identify crags without committing to a page load; cheap insurance vs accidental navigation         | Plan     |
| Hydration UX             | SSR Polish crag list (grouped by region) inside `<Fragment slot="fallback">`                       | Layered fallback for slow cellular, no-JS, screen readers; the SSR list still delivers FR-005 even if the island never mounts          | Plan     |
| Tile provider for v1     | OSM raster (`{s}.tile.openstreetmap.org`) with attribution                                         | Zero setup, no API key; expected v1 traffic well under OSM Tile Usage Policy thresholds; provider migration documented as v2 follow-up | Plan     |
| Marker icon              | `L.divIcon` (inline SVG, Tailwind-themable class)                                                  | Sidesteps Vite default-marker bundling breakage; CSS-themable for future dark mode / hover / focus                                     | Research |
| Fallback tripwire        | ~4h time-box on Phase 2; if fired, this plan is parked and `/10x-new crag-map-fallback` is opened  | Matches PRD framing ("time sink") and roadmap's `top_blocker: time`; prevents Leaflet from blocking S-03 / S-04                        | Plan     |
| Test runner              | None (documented in `__tests__/README.md`)                                                         | No runner configured (`AGENTS.md`); follows the S-01 precedent                                                                         | Repo     |
| `change_id` housekeeping | Rename `crag-map-navigation-investigation` → `crag-map-navigation`; `status: research` → `planned` | Folder is `crag-map-navigation/`; promoting the folder from "investigation-only" to "S-02 implementation slice"                        | Plan     |

## Scope

**In scope:**

- Install `leaflet`, `react-leaflet`, and `@types/leaflet`
- New `src/lib/catalog/map.ts`: `CragMapPin` DTO + `toCragMapPins()` server mapper (filters invalid records, resolves region names, logs warnings, never throws)
- New `src/components/catalog/CragMap.tsx`: React island (`client:only="react"`, divIcon, popup-then-link, `FitToCrags` single/multi branch, OSM `TileLayer` with attribution)
- New `src/components/catalog/CragMapFallbackList.astro`: SSR Polish crag list grouped by region
- New `src/components/catalog/CragMapSection.astro`: server fetch + DTO + island + SSR fallback wrapper
- Swap the homepage `#regiony` section to `#mapa`; update the hero CTA to "Zobacz crągi na mapie"
- Delete the orphaned `src/components/catalog/RegionsList.astro`
- Document intended test surface in `src/components/catalog/__tests__/README.md` + extend `src/lib/catalog/__tests__/README.md`
- Update `change.md` front matter (already applied by the plan-writing step)

**Out of scope:**

- Per-region map at `/regiony/[region]` (region page keeps the S-01 list shape)
- Tile-provider migration (OSM-only for v1; v2 concern)
- MapLibre / Mapbox / Google Maps / Pigeon Maps / vector tiles
- Marker clustering, geolocation, route lines, search/filter (PRD Non-Goals)
- PRD-named Tier 2 fallback (static crag-locator + external mapping deep links) — held to a separate `crag-map-fallback` change, opened only if the tripwire fires
- Test runner setup
- Any auth / climb-log / projects work (S-03 / S-04 / S-06)

## Architecture / Approach

```
Astro page (server, Cloudflare Worker)
└── CragMapSection.astro
     ├── listCrags() + listRegions()  ──▶  toCragMapPins()  ──▶  CragMapPin[]
     └── <CragMap client:only="react" pins={pins}>
           ├── (client island)  <MapContainer><TileLayer/><Marker/>×N + <FitToCrags/>
           └── <Fragment slot="fallback">  (server-rendered)
                 └── <CragMapFallbackList pins={pins} />   ◀── Polish list grouped by region
```

Hard rule (Phase 1 Success Criterion 1.6): only `CragMap.tsx` imports `leaflet`, `react-leaflet`, and `leaflet/dist/leaflet.css`. Astro pages, the catalog module, middleware, and API routes must never import Leaflet — `workerd` has no `window`. `CragMap.tsx` imports `CragMapPin` as type-only so the server-only `@/lib/catalog` runtime never reaches the client bundle.

## Phases at a Glance

| Phase                                      | What it delivers                                                                              | Key risk                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Interactive map slice                   | Working Leaflet map on `/` (desktop verified) + SSR fallback + island/server boundary in code | Vite + Leaflet bundling edge cases (default-icon, CSS import, optional `optimizeDeps`)            |
| 2. Mobile-cellular verification + tripwire | Real-phone sign-off OR the parked decision to open `crag-map-fallback`                        | Real-phone behavior under cellular doesn't match desktop dev; OSM tile latency on first cold load |

**Prerequisites:** S-01 done (it is). Published Sokoliki crags in Strapi carry valid `latitude`, `longitude`, and `regionSlug` (Phase 1 manual step 1.7 surfaces this — if zero pins render despite crags existing, content gap is the signal).

**Estimated effort:** ~1 focused session for Phase 1 (4-6h, dominated by Vite/Leaflet bundling edge cases). Phase 2 verification ≤4h including the tripwire budget. Total: 1-2 days of focused work, or 3-4 spread across context switches.

## Open Risks & Assumptions

- **Strapi content gap**: assumes at least one published Sokoliki crag has valid `latitude`/`longitude`/`regionSlug`. Phase 1 manual step 1.7 surfaces a gap; loading content is a content task, not a code task
- **OSM Tile Usage Policy**: v1 ships under the policy's small-scale threshold (beta group, known users, single region); documented as a v2 follow-up if traffic grows
- **Cloudflare Worker + Leaflet SSR boundary**: the rule is sharp but easy to break with a stray import — Success Criterion 1.6 codifies the grep invariant as a defense
- **Vite + react-leaflet dev startup**: if dev-server boot complains about Leaflet, the documented workaround is `vite.optimizeDeps.include = ["leaflet"]` in `astro.config.mjs` (not pre-applied; only added if needed)
- **react-leaflet v5 + React 19**: research-confirmed compatible; pin minor versions defensively after the first successful install
- **Phase 2 tripwire is judgement-bound**: 4h is a guideline; "stuck on Vite/Leaflet bundling" vs "stuck on cellular tile latency" are different failure modes — the implementer documents which one fired

## Success Criteria (Summary)

- A visitor opening `/` on a phone over cellular sees the map, taps a pin, sees the popup, and reaches the crag's route list without console errors
- With JS disabled (or during slow hydration), `/` still renders a Polish, region-grouped, linked crag list inside `#mapa`
- `npm install`, `npx astro sync`, `npm run lint` (type-checked), `npm run build`, and the pre-commit hook all pass; no Leaflet imports leak into server-evaluated files

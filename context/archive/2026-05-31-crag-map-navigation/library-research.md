# S-02 Crag map navigation — library research

> Scope: identify the realistic library options for delivering FR-004 ("any visitor can view a map showing crag locations as pins") and FR-005 ("any visitor clicking a map pin can navigate to that crag's route list"), filtered through the SendLog stack, and short-list candidates for `/10x-plan crag-map-navigation`.
>
> Date: 2026-05-31. Roadmap: `context/foundation/roadmap.md` S-02 (proposed). PRD: `context/foundation/prd.md` FR-004 / FR-005 plus static-fallback note on line 168.

## Constraints that filter the field

Carried into every option below; none of the options below dodge any of them.

- **Runtime**: Astro 6 SSR on Cloudflare Workers (`workerd`). Workers cannot run any browser map library server-side, so every option here must load inside a React island via `client:only="react"` (or `React.lazy` + `Suspense`). This is uniform — does not tilt the choice.
- **Frontend**: React 19 islands, Tailwind 4, shadcn/ui ("new-york"). Map must be a self-contained React component.
- **Mobile-first, Polish-first**: target device is a phone on cellular signal; UI strings are Polish.
- **Content scope at v1**: a single Polish region (Sokoliki) with a handful of crags — N is small.
- **Project state**: `main_goal: speed`, `top_blocker: time` (per roadmap front matter). Time-to-ship dominates feature richness.
- **PRD-documented scope cut**: FR-004/FR-005 may fall back to a static crag-locator link or QR-per-crag handing off to an external mapping service if the interactive map becomes a time sink (`prd.md` line 168). Library shortlist must respect that.

## Tier 1 — Interactive maps (satisfy FR-004/FR-005 fully)

### A. Leaflet + `react-leaflet`

- **License / size**: BSD-2-Clause, ~42 KB gzipped runtime; ~2.5M weekly npm downloads — the safest "many eyes on it" option.
- **Rendering**: SVG/Canvas, no WebGL requirement. Renders well on low-end Android.
- **Marker click → navigate** (FR-005): `<Marker eventHandlers={{ click: () => navigate(...) }}>` or wrap popup content in an `<a>`. Trivial.
- **Astro fit**: well-trodden. The exact `React.lazy` + `client:only` pattern for Astro (including the `Vite optimizeDeps: { include: ['leaflet'] }` workaround) is documented end-to-end with code.
- **Tiles**: free OSM raster tiles work out of the box; attribution required; no API key, no billing.
- **Pre-baked Astro wrappers** (small communities, all OSS): `astro-leaflet`, `astro-geo-map`, `maps-withastro`. Useful as references; not necessary to depend on.
- **Trade-offs**: SSR setup needs the lazy/client-only dance — a few extra files, no novel risk. No vector tiles, no 3D — not needed here.
- **Sources**: [Jan Müller, React + Leaflet + SSR (2025-10)](https://janmueller.dev/blog/react-leaflet/); [Wuest Labs, interactive Leaflet maps (2026-05)](https://wuest-labs.com/blog/2026-05-03-interactive-leaflet-maps); [PkgPulse 2026 maps comparison](https://www.pkgpulse.com/guides/mapbox-vs-leaflet-vs-maplibre-interactive-maps-2026); [astro-leaflet](https://github.com/esoleyman/astro-leaflet); [astro-geo-map](https://code.juliancataldo.com/component/astro-geo-map/); [maps-withastro](https://github.com/roblabs/maps-withastro).

### B. MapLibre GL JS + `react-map-gl/maplibre`

- **License / size**: MIT, ~290 KB gzipped, WebGL. MapLibre is the open-source fork of Mapbox GL JS (community fork after Mapbox went proprietary at v2); recommended default for _new_ WebGL projects in 2026.
- **Click handler** (FR-005): per-layer, e.g. `map.on("click", "crag-pins", e => …)`. Clean once data is in a GeoJSON source.
- **React binding**: `react-map-gl/maplibre` from vis.gl (v7+ has a dedicated `maplibre` entry point, no `mapLib` prop needed).
- **Tile-provider decision is separate**:
  - **MapTiler** — 100K tiles/mo free, API key required.
  - **Stadia Maps** — 200K tiles/mo free, no credit card.
  - **OpenFreeMap** — free public instance, no API key, no registration.
  - **Protomaps + PMTiles on Cloudflare R2** — synergistic with the existing Cloudflare stack: serve `.pmtiles` directly from R2; MapLibre reads them via `addProtocol`. Pinball Map's reported first month was $1.67 for ~111 GB stored, near-zero ongoing because Class B requests fall in R2's 10M-request free tier.
- **Trade-offs for S-02**: ~7× the runtime bytes of Leaflet for capabilities the v1 brief doesn't need (vector tiles, 3D, custom style JSON). The Protomaps-on-R2 path is the only reason a v1 might still pick MapLibre — and even then it's premature for one region with <100 pins.
- **Sources**: [MapLibre GL JS](https://maplibre.org/projects/gl-js/); [PkgPulse comparison](https://www.pkgpulse.com/guides/mapbox-vs-leaflet-vs-maplibre-interactive-maps-2026); [react-map-gl v7 upgrade guide](https://github.com/visgl/react-map-gl/blob/master/docs/upgrade-guide.md); [Stadia Maps + MapLibre quickstart](https://docs.stadiamaps.com/tutorials/vector-maps-with-maplibre-gl-js/); [MapTiler React tutorial](https://docs.maptiler.com/react/maplibre-gl-js/get-started/); [Protomaps PMTiles for MapLibre](https://docs.protomaps.com/pmtiles/maplibre); [Pinball Map: Protomaps on Cloudflare R2 (2024-11)](https://blog.pinballmap.com/2024/11/05/protomaps-tile-hosting/); [OpenFreeMap](https://openfreemap.org/).

### C. Pigeon Maps

- **License / size**: MIT, ~16 KB gzipped, **zero external runtime deps** (no Leaflet or MapLibre underneath). ~67K weekly downloads.
- **API**: pure React: `<Map><Marker onClick={…} /></Map>`. `Marker` has `onClick`, `onMouseOver`, `onMouseOut`, `onContextMenu` built in.
- **Tiles**: any OSM-compatible provider; sensible OSM default for dev with no setup.
- **SSR**: needs a client-only wrapper, same as the others; project explicitly supports a "100% static server-rendered React map" mode (events disabled) — useful for graceful no-JS fallback.
- **Trade-offs**: no vector tiles, no clustering ecosystem, smaller community. Irrelevant at v1 scope (single region, ≤ ~20 crags).
- **Sources**: [Pigeon Maps Marker docs](https://pigeon-maps.js.org/docs/marker/); [Pigeon Maps intro](https://pigeon-maps.js.org/docs/); [npm registry entry](https://registry.npmjs.org/pigeon-maps); [mariusandra/pigeon-maps](https://github.com/mariusandra/pigeon-maps).

### D. Mapbox GL JS + `react-map-gl/mapbox`

- Same WebGL engine as MapLibre but proprietary, mandatory account + API key, 50K loads/mo free then paid.
- No SendLog-specific advantage over MapLibre. Lock-in to Mapbox's tile/Studio ecosystem we don't currently use.
- **Verdict**: not justified for v1.

### E. Google Maps JS API + `@vis.gl/react-google-maps`

- Billing account, API key, monthly free credit then per-load charges; ~200 KB+ payload after first parse.
- Recognizable UX for Polish hikers; no technical advantage.
- **Verdict**: cost + lock-in not justified for v1.

## Tier 2 — Static-image / no-JS fallbacks (the PRD-documented scope-cut path)

The PRD explicitly authorizes degrading FR-004/FR-005 to "a static crag-locator link (or QR code per crag) handing off to an external mapping service" if the interactive map "proves too painful mid-build". These are the concrete shapes that fallback could take. None of them deliver true pan/zoom — they preserve the geographic-locator value the PRD calls out.

- **Static map image services** — render one PNG with all crag pins, then overlay clickable `<a>` regions (CSS positioning over the image, or HTML `<map>`/`<area>`, or an SVG layer with `<a>` wrappers):
  - **Geoapify Static Maps** — 3000 credits/day free, OSM tiles, commercial use allowed, image caching allowed.
  - **Mapbox Static Images** — 50K req/mo free, $1/1000 after.
  - **MapTiler Static Maps** — paid plans only, no free tier.
  - Self-rendered: `osm-static-maps` (Node), `staticmap` / `py-staticmaps` (Python) — zero vendor; runs at build time.
- **External-link / QR-per-crag** — emit `geo:lat,lng` URIs or Google Maps deep links from each crag detail page. Zero map dependency, zero JS, mobile-native handoff (opens Google Maps / Apple Maps / OsmAnd). This is the option the PRD names directly.
- **Hand-drawn SVG topo of Sokoliki with `<a>` tags** — one static asset; each `<path>` or `<circle>` is a link to the crag's route list. On-brand for a small known climbing area. Only viable because v1 ships a single region.
- **Sources**: [Geoapify Static Maps](https://www.geoapify.com/static-maps-api/); [Mapbox Static Maps](https://www.mapbox.com/static-maps); [MapTiler Static Maps API](https://docs.maptiler.com/cloud/api/static-maps/); [OSM wiki — static map images](https://wiki.openstreetmap.org/wiki/Static_map_images).

## Comparison summary

| Option                                  | License     | Approx. gzip | API key             | Vector tiles | SSR friction           | Fit for S-02               |
| --------------------------------------- | ----------- | ------------ | ------------------- | ------------ | ---------------------- | -------------------------- |
| Leaflet + react-leaflet                 | BSD-2       | ~42 KB       | No                  | No           | Low (lazy/client-only) | High                       |
| MapLibre GL JS + react-map-gl/maplibre  | MIT         | ~290 KB      | Depends on provider | Yes          | Low                    | Medium (overkill for v1)   |
| Pigeon Maps                             | MIT         | ~16 KB       | No                  | No           | Low                    | High                       |
| Mapbox GL JS + react-map-gl/mapbox      | Proprietary | ~300 KB      | Yes                 | Yes          | Low                    | Low (cost + lock-in)       |
| Google Maps + @vis.gl/react-google-maps | Proprietary | ~200 KB+     | Yes                 | Yes          | Low                    | Low (cost + lock-in)       |
| Static image + `<a>` overlay            | varies      | 0 KB JS      | varies              | n/a          | None                   | Fallback                   |
| External-link / QR per crag             | n/a         | 0 KB JS      | None                | n/a          | None                   | Fallback (PRD-named)       |
| Hand-drawn SVG topo + `<a>`             | own         | 0 KB JS      | None                | n/a          | None                   | Fallback (on-brand, niche) |

## Short-list for `/10x-plan crag-map-navigation`

Given `main_goal: speed`, `top_blocker: time`, and a single-region v1 scope, the realistic contenders are:

1. **Leaflet + react-leaflet** — default recommendation. Mature, smallest interactive footprint among full-featured maps, broad Astro precedent, free OSM tiles, no account setup.
2. **Pigeon Maps** — pick this if every kilobyte and every dependency matters more than ecosystem breadth; ships fastest for a ~handful of pins.
3. **Static image + `<a>` overlay** (or external-link / QR) — pre-planned escape hatch per PRD line 168; resolves the S-02 fallback unknown if integration goes long.

MapLibre / Mapbox / Google are reasonable in absolute terms but cost more time and bytes than the v1 brief justifies. The Protomaps-on-Cloudflare-R2 angle is the only reason to revisit MapLibre later (e.g. v2 multi-region growth).

## Open questions handed to `/10x-plan`

- **Q1 — interactive vs fallback for v1**: pick Tier 1 (default) or commit upfront to a Tier 2 fallback? Roadmap S-02 already lists this as an unknown owned by the user.
- **Q2 — if Tier 1: Leaflet or Pigeon?** Decide on the basis of ecosystem (Leaflet) vs raw smallness (Pigeon). Either picks the same OSM raster tile source, so the tile decision is shared.
- **Q3 — tripwire for falling back**: define a concrete cutoff (e.g. "if the interactive map is not behaving on a real phone after N hours, switch to Tier 2"). Resolves the roadmap unknown by replacing judgment with a checkpoint.
- **Q4 — pin data source**: crag coordinates currently live in Strapi (F-01 `catalog-content-contract`). Confirm the `latitude`/`longitude` fields are populated for Sokoliki crags before scheduling S-02; if not, that's a content-load prerequisite, not a code one.

---
date: 2026-05-31T14:49:23+02:00
researcher: GPT-5.5
git_commit: 1ba970e0e8f1476c46273c4bc985d7a7a2596e86
branch: feature/S02-crag-map-navigation
repository: sendlog
topic: "Leaflet API reference compatibility for S-02 crag map navigation"
tags: [research, codebase, crag-map-navigation, leaflet, react-leaflet, astro, catalog]
status: complete
last_updated: 2026-05-31
last_updated_by: GPT-5.5
---

# Research: Leaflet API reference compatibility for S-02 crag map navigation

**Date**: 2026-05-31T14:49:23+02:00
**Researcher**: GPT-5.5
**Git Commit**: 1ba970e0e8f1476c46273c4bc985d7a7a2596e86
**Branch**: feature/S02-crag-map-navigation
**Repository**: sendlog

## Research Question

Review the codebase and decide whether `context/changes/crag-map-navigation-investigation/leaflet-api-reference.md` is compatible with it. The goal is to implement S-02 from `context/foundation/roadmap.md`: "visitor can use map pins to reach a crag's route list."

## Summary

The Leaflet + `react-leaflet` API reference is compatible with SendLog's current Astro 6 SSR, React 19 islands, Tailwind 4, Strapi catalog, and Cloudflare Workers setup, with one important route correction and one hard architectural boundary.

The route correction: marker links must navigate to the current S-01 crag detail route, `/regiony/${regionSlug}/${crag.slug}`, not the reference document's generic `/crags/${slug}` example.

The architectural boundary: all catalog reads must stay server-side. An Astro page should fetch crags with `listCrags()` or `listCragsByRegion()`, map them to a small serializable marker DTO, and pass that DTO into a `client:only="react"` React island. The map island may import `leaflet`, `react-leaflet`, and `leaflet/dist/leaflet.css`; Astro pages and server helpers must not.

Decision: proceed with Leaflet + `react-leaflet` for `/10x-plan crag-map-navigation`, while keeping the PRD-approved static/external-link fallback as a time-boxed escape hatch.

## Detailed Findings

### S-02 Requirements

- S-02 is proposed in the roadmap as `crag-map-navigation`, with outcome "visitor can use map pins to reach a crag's route list" and prerequisites satisfied by S-01 (`context/foundation/roadmap.md:130-141`).
- FR-004 requires a public map with crag pins, and FR-005 requires clicking a pin to navigate to that crag's route list (`context/foundation/prd.md:77-80`).
- The PRD explicitly allows a fallback if interactive map integration becomes too costly: a static crag-locator link or QR code handing off to an external mapping service (`context/foundation/prd.md:168`).

### Existing Catalog Data Supports Pins

- `CatalogCrag` already includes the minimum marker fields: `id`, `slug`, `name`, `latitude`, `longitude`, and `regionSlug` (`src/lib/catalog/types.ts:26-35`).
- The Strapi client models `latitude` and `longitude` on crag records (`src/lib/catalog/strapi.client.ts:40-48`) and maps them into the app-facing `CatalogCrag` contract (`src/lib/catalog/strapi.client.ts:177-187`).
- `listCrags()` exposes published crags with photos and region populated (`src/lib/catalog/strapi.client.ts:224-228`).
- `listCragsByRegion(regionSlug)` already filters crags by region and is the best data source for a region-scoped Sokoliki map (`src/lib/catalog/strapi.client.ts:254-263`).

Compatibility impact: Leaflet marker data does not require a new database/API contract. S-02 can reuse the S-01 catalog read model and reduce it to `{ id, name, latitude, longitude, href }` before hydration.

### Server-Only Catalog Boundary

- The catalog module states that catalog reads are server-only because they carry a Strapi API token, and React client components must receive mapped data via Astro pages or API routes (`src/lib/catalog/index.ts:1-9`).
- `astro.config.mjs` declares Strapi environment values as server-only secret fields (`astro.config.mjs:17-23`).

Compatibility impact: `leaflet-api-reference.md` is correct that browser map libraries must be isolated from server execution, but S-02 also needs the inverse rule: the browser-only map island must not import `@/lib/catalog`.

### Current Route Shape Differs From Reference Example

- S-01's region page links crag cards to `/regiony/${regionSlug}/${c.slug}` (`src/pages/regiony/[region]/index.astro:40-45`).
- `CragCard` receives the href from the page and renders it as the public crag link (`src/components/catalog/CragCard.astro:13-34`).
- The Leaflet reference's examples use `/crags/${crag.slug}` (`context/changes/crag-map-navigation-investigation/leaflet-api-reference.md:22` and `context/changes/crag-map-navigation-investigation/leaflet-api-reference.md:75-80`).

Compatibility impact: the API reference is conceptually compatible, but its navigation examples need to be adapted to the shipped route contract:

```ts
const href = `/regiony/${crag.regionSlug}/${crag.slug}`;
```

If any crag lacks `regionSlug`, S-02 should either omit that marker or treat it as invalid catalog content, because the current public route requires both region and crag slugs.

### Astro, React, Vite, and Cloudflare Fit

- The app is configured for Astro SSR with `output: "server"`, React integration, Tailwind's Vite plugin, and the Cloudflare adapter (`astro.config.mjs:10-16`).
- React 19 and `@astrojs/react` are already present, but `leaflet` and `react-leaflet` are not installed yet (`package.json:14-35`).
- Existing React islands use Astro hydration directives for auth forms; Leaflet should use `client:only="react"` rather than `client:load` because Leaflet touches browser globals during import.
- The Leaflet reference's stack-specific gotchas are valid for this repo: client-only island, island-local `leaflet/dist/leaflet.css`, custom `L.divIcon` or explicit default-marker asset rewiring, and optional `vite.optimizeDeps.include = ["leaflet"]` only if dev startup complains (`context/changes/crag-map-navigation-investigation/leaflet-api-reference.md:146-162`).

Compatibility impact: Cloudflare Workers is not a blocker as long as no Leaflet code is imported in files that Astro evaluates on the server. The implementation should keep the map component under `src/components/...` as a React island and hydrate it from an `.astro` page with `client:only="react"`.

### Product Scope and Fallback

- The library research ranks Leaflet + `react-leaflet` as the default recommendation, Pigeon Maps as the small-dependency alternative, and static/external-link options as the PRD-approved fallback (`context/changes/crag-map-navigation-investigation/library-research.md:91-99`).
- The S-02 roadmap records the fallback decision as non-blocking, with the risk that geographic navigation should not block the core catalog path (`context/foundation/roadmap.md:138-141`).

Compatibility impact: Leaflet is a reasonable default for speed, ecosystem maturity, and no API-key setup. The plan should still define a concrete fallback tripwire before implementation starts, such as switching to static/external links if the interactive map is not working on a real phone after a fixed time box.

## Code References

- `src/lib/catalog/types.ts:26-35` - `CatalogCrag` already exposes marker-ready fields.
- `src/lib/catalog/index.ts:1-9` - catalog reads are server-only and must not be imported into client React components.
- `src/lib/catalog/strapi.client.ts:40-48` - Strapi crag records include `latitude`, `longitude`, photos, and region.
- `src/lib/catalog/strapi.client.ts:177-187` - Strapi crag records are mapped into `CatalogCrag`.
- `src/lib/catalog/strapi.client.ts:224-228` - `listCrags()` fetches published crags.
- `src/lib/catalog/strapi.client.ts:254-263` - `listCragsByRegion()` supports region-scoped marker data.
- `src/pages/regiony/[region]/index.astro:15-20` - region pages already fetch the relevant region and crags server-side.
- `src/pages/regiony/[region]/index.astro:40-45` - current crag route shape is `/regiony/${regionSlug}/${c.slug}`.
- `astro.config.mjs:10-16` - Astro SSR, React, Tailwind Vite plugin, and Cloudflare adapter configuration.
- `astro.config.mjs:17-23` - Strapi env values are server-only secrets.
- `package.json:14-35` - React/Astro stack exists; Leaflet dependencies still need to be added.

## Architecture Insights

The compatible implementation shape is:

1. Astro page fetches published crags server-side using `listCragsByRegion()` or `listCrags()`.
2. Astro page maps each crag to a serializable pin DTO:

   ```ts
   interface CragMapPin {
     id: string;
     name: string;
     latitude: number;
     longitude: number;
     href: string;
   }
   ```

3. Astro renders a React island with `client:only="react"`.
4. The React island imports `leaflet`, `react-leaflet`, and `leaflet/dist/leaflet.css`.
5. Markers use `L.divIcon` to avoid Vite default marker asset issues.
6. Marker popup/link navigates to the S-01 crag route list page.

This keeps browser-only Leaflet code out of the Cloudflare Worker SSR path and keeps Strapi secrets out of the browser bundle.

## Historical Context (from prior changes)

- `context/archive/2026-05-26-catalog-content-contract/plan.md` established Strapi as the server-side source of truth for region, crag, and route content, including crag coordinates.
- `context/archive/2026-05-29-public-catalog-browse/plan.md` shipped the public region/crag/route browsing path first and explicitly deferred map pins to S-02.
- `context/changes/catalog-crag-photos-multi/plan.md` made crag photos an array, which could support richer map popups later but is not required for S-02 compatibility.
- `context/changes/crag-map-navigation-investigation/library-research.md` selected Leaflet + `react-leaflet` as the default interactive option and preserved static/external-link fallback options.
- `context/changes/crag-map-navigation-investigation/leaflet-api-reference.md` provides the right Leaflet API surface, with the repo-specific route correction described above.

## Related Research

- `context/changes/crag-map-navigation-investigation/library-research.md` - map library option survey and recommendation.
- `context/changes/crag-map-navigation-investigation/leaflet-api-reference.md` - API-level reference for Leaflet + `react-leaflet`.

## Open Questions

- Are all Sokoliki crags populated in Strapi with valid `latitude`, `longitude`, and `regionSlug` values? The schema/code supports them, but content should be verified before implementation.
- Should S-02 place the map on each region page, add a dedicated map route, or both? Reusing the region page is the smallest path because it already fetches region-scoped crags.
- What is the explicit fallback tripwire? The PRD allows fallback, but `/10x-plan crag-map-navigation` should define the time/behavior threshold before implementation begins.

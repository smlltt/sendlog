---
change_id: crag-topo-route-groups
title: Filter crag routes by active topo photo
status: new
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

On multi-photo crag pages, climbers compare a topo image to route names/grades in the table below. Today every route is always visible, so matching a line on photo *N* to its row requires scrolling. Goal: show only the routes that belong to the currently selected photo (with sensible fallbacks when mapping is missing or incomplete).

Editorial model should live in Strapi admin (not hard-coded in the app). Prefer explicit route ↔ topo links over fragile numeric ranges, but keep migration/fallback paths for crags that only have the legacy `photos` media list.

Related work:

- `catalog-crag-photos-multi` — `CatalogCrag.photos[]` and `CragPhotos.astro` CSS radio gallery (no per-photo metadata in Strapi).
- `catalog-route-numbering` (planned) — display-only `#` column in `RoutesTable`; useful for editors but must not become the source of truth for topo grouping.

Primary surfaces: `admin` crag schema, `src/lib/catalog` contract/mapper, `src/pages/regiony/[region]/[crag].astro`, `CragPhotos` + `RoutesTable` (and S-04 `RouteClimbAction` islands).

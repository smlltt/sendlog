---
change_id: catalog-route-numbering
title: Number routes in catalog list by fetch order
status: new
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Show routes on the crag page with a visible sequence number (1, 2, 3, …) matching the order of the `routes` array as returned from the backend — i.e. the same order `listRoutesByCrag` / `RoutesTable` already receives today (`name:asc` from Strapi via `buildListPath`, then filtered by crag). Numbers are display-only; do not add a new Strapi field or persist sequence in private state.

Scope assumptions for planning:

- Primary surface: `RoutesTable.astro` on `src/pages/regiony/[region]/[crag].astro` (and any other catalog views that reuse the same table).
- Numbering is 1-based index in the rendered list (`index + 1`), not the route's editorial "line number" in the guidebook.
- Signed-in and signed-out users see the same numbers; the log-action column layout should stay usable on mobile (stacked labels) and desktop (table).
- i18n: add a column header / `data-label` for the number column if we expose it as a proper table column (accessibility).

Open questions for `/10x-plan`:

- Column placement (leading `#` column vs. prefix before route name).
- Whether `CragMapFallbackList` or other route lists should stay in sync.
- Visual weight (plain digit vs. muted badge) so it doesn't compete with route name / grade.

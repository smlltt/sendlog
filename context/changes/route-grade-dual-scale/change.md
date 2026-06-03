---
change_id: route-grade-dual-scale
title: Show route grade in both Polish (Kurtyka) and French systems
status: new
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Enable showing the route grade in both the Polish (Kurtyka) and French scales. Today `grade` is a single non-localized string on the Strapi `route` content type, mapped to `CatalogRoute.grade` and rendered verbatim in `src/components/catalog/RoutesTable.astro`.

Undecided approach (resolve during planning):

- **Admin/Strapi side** — store two grade fields (e.g. `gradeKurtyka` + `gradeFrench`) so editors set both explicitly. Pro: exact control, no lossy conversion. Con: more editor work, risk of the two drifting out of sync, schema migration + backfill of existing routes.
- **Frontend conversion** — keep Kurtyka as the single stored grade and derive the French grade via a lookup/conversion function based on the comparison table at https://pl.wikipedia.org/wiki/Skala_trudno%C5%9Bci_dr%C3%B3g_skalnych . Pro: single source of truth, no admin changes. Con: the published cross-scale tables are approximate/disputed, mapping isn't perfectly 1:1 (one Kurtyka grade can span multiple French grades and vice versa), and bouldering scales don't map cleanly.

Open questions to resolve when planning:

- Which scale is canonical/stored, and is the other shown alongside (e.g. "VI.3 / 7a") or behind a user toggle?
- Does the conversion table cover the full Kurtyka range used in the catalog, and how are gaps / non-rope (boulder) grades handled?
- Where does this surface — `RoutesTable` only, or also the route/crag detail views and the climb-log UI?
- i18n: column labels / scale names in `src/i18n/ui.ts`.

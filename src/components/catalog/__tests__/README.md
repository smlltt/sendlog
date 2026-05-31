# Catalog components — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to satisfy
the repo module-structure rule and to record the test surface that should be
covered once a runner is added — Vitest + React Testing Library is the likely
candidate given the Vite/Astro toolchain.

## `CragMap.tsx` (React island)

- `FitToCrags` single-pin branch: with `pins.length === 1`, calls `map.setView([lat, lng], 14)` and does NOT call `fitBounds`.
- `FitToCrags` multi-pin branch: with `pins.length > 1`, calls `map.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [40, 40] })`.
- `FitToCrags` empty branch: with `pins.length === 0`, calls neither `setView` nor `fitBounds`.
- `PopupBody` rendering: contains `<strong>{pin.name}</strong>` and `<a href={pin.href}>Otwórz trasy</a>`; the link is same-tab (no `target="_blank"`).
- `cragIcon` is a `L.divIcon` with `className: "crag-pin"` (not the default `L.Icon`) — confirms the divIcon path is exercised and the Vite-broken default-icon bundling is avoided.
- `<TileLayer>` receives the OSM attribution string containing `OpenStreetMap` and an `href` to `openstreetmap.org/copyright`.
- `MapContainer` is wrapped in `useMemo` keyed on `pins`: re-rendering the parent with identical `pins` does NOT re-instantiate the underlying Leaflet `Map`.
- `ClusteredCragMarkers` mounts: calls `L.markerClusterGroup()`, adds one `L.marker` per pin (each with `cragIcon` and a bound popup), and adds the group to the map.
- `ClusteredCragMarkers` cleanup: on unmount or when `pins` changes, removes the cluster group from the map so a stale layer is never left behind.
- Popup HTML from `buildPopupHtml`: HTML-escapes `pin.name` and `pin.href` (apostrophe → `&#39;`, `<` → `&lt;`, etc.) so an admin-entered crag name with `<`/`&`/`"` cannot break out of the popup markup.
- Default clustering behavior: clicking a cluster zooms in (`zoomToBoundsOnClick: true` default) to spread overlapping pins — verified by observing the zoom level increases after a cluster click in dev tools.

## `CragMapFallbackList.astro` (SSR fallback)

- Empty `pins` → renders the Polish empty state: `Brak opublikowanych skał.` inside a styled `<p>`.
- Non-empty `pins` → groups by `regionSlug`; each group rendered as `<h3>{regionName}</h3>` followed by a `<ul>` of link `<li>` items.
- Grouping preserves first-seen order from the upstream `name:asc` sort (i.e., the order is stable across renders and matches the upstream order of regions as encountered in `pins`).
- Each link's `href` is exactly `pin.href` (constructed by `toCragMapPins` as `/regiony/<regionSlug>/<crag-slug>`).
- Uses the Tailwind classes inherited from the prior `RegionsList.astro` so the fallback matches the visual feel of S-01 region links.

## `CragMapSection.astro` (SSR wrapper)

- Calls `listCrags()` and `listRegions()` in parallel via `Promise.all`.
- On `CatalogError`: sets `Astro.response.status = 500` and renders `<CatalogErrorAlert>` inside the `#mapa` section heading.
- On success: renders the section heading, the pluralized count text (`pluralizeCrags`), and the `<CragMap client:only="react">` with the `<CragMapFallbackList>` in the `fallback` slot.
- `pluralizeCrags(count)`:
  - `1` → `"1 skała"`
  - `2`, `3`, `4` → `"<n> skały"`
  - `0`, `5`, `6`, `>= 5` → `"<n> skał"`

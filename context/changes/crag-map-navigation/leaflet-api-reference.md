# Leaflet + react-leaflet — API reference for S-02

> Scope: concrete API-level reference for the **default recommendation** from `library-research.md` (Leaflet + react-leaflet), focused on what an S-02 implementation will actually call. Use this alongside `library-research.md` (which covers the option survey and trade-offs) when running `/10x-plan crag-map-navigation`.
>
> Source: Context7 MCP (`/leaflet/leaflet` and `/websites/react-leaflet_js`), fetched 2026-05-31.
>
> Roadmap: `context/foundation/roadmap.md` S-02 (proposed). PRD: `context/foundation/prd.md` FR-004 / FR-005.

## Libraries

| Library       | Context7 ID                  | Snippets | Source reputation | Benchmark |
| ------------- | ---------------------------- | -------- | ----------------- | --------- |
| Leaflet       | `/leaflet/leaflet`           | 1602     | High              | 68.8      |
| React Leaflet | `/websites/react-leaflet_js` | 157      | High              | 83.5      |

## What S-02 actually needs from these libraries

S-02 outcome: _visitor can use map pins to reach a crag's route list_. Minimum API surface:

1. A map container scoped to a region (Sokoliki).
2. A free OSM tile layer.
3. One `<Marker>` per crag, with a click/popup that navigates to `/crags/{slug}` (the route list page S-01 already ships).
4. Auto-fit the view to all crag pins (or center on the single crag if N=1).
5. A custom branded pin icon that survives Vite bundling.

Everything below is the smallest set of API calls that delivers those five.

## 1. Map container (react-leaflet `MapContainer`)

From the [api-map docs](https://react-leaflet.js.org/docs/api-map):

- Initializes the Leaflet `Map` instance and provides it to children via React Context.
- **Most props are immutable after the first render** — `center`, `zoom`, `bounds` set initial state; changing them later does nothing. Use the imperative `useMap()` API for runtime updates.
- Useful props: `bounds`, `boundsOptions`, `placeholder`, `style` / `className`, `whenReady`, `scrollWheelZoom`.
- Wrap `<MapContainer>` in `useMemo(..., [])` if its parent re-renders for external-state reasons — avoids re-instantiating the map (pattern from the [External State example](https://react-leaflet.js.org/docs/example-external-state)).

```jsx
<MapContainer center={[50.85, 15.95]} zoom={12} scrollWheelZoom={false} style={{ height: "60vh", width: "100%" }}>
  {/* TileLayer + Markers go here */}
</MapContainer>
```

**Container must have an explicit height** (style or Tailwind class via `cn()` from `@/lib/utils`); otherwise the map renders 0px and tiles never load.

## 2. Tile layer (OSM raster)

Standard URL + attribution from the [Leaflet quick-start](https://leafletjs.com/examples/quick-start/):

```jsx
<TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  maxZoom={19}
/>
```

**Production reminder** — per the OSM Foundation [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/), the default `tile.openstreetmap.org` endpoint is not for high-traffic public production. Decide before v1 launch whether to swap in MapTiler / Stadia / OpenFreeMap / Protomaps (covered in `library-research.md` § Tier 1 B).

## 3. Crag pins with navigation (FR-005)

react-leaflet attaches Leaflet event listeners via the `eventHandlers` prop (from [api-components](https://react-leaflet.js.org/docs/api-components)):

```jsx
{
  crags.map((crag) => (
    <Marker
      key={crag.id}
      position={[crag.latitude, crag.longitude]}
      icon={cragIcon}
      eventHandlers={{
        click: () => {
          window.location.href = `/crags/${crag.slug}`;
        },
      }}
    >
      <Popup>
        <a href={`/crags/${crag.slug}`}>{crag.name}</a>
      </Popup>
    </Marker>
  ));
}
```

UX note for the mobile-first PRD: the **Popup-then-link** pattern (first tap shows crag name, second tap navigates) is generally kinder on phones than immediate navigation, because it lets users browse the map without ping-ponging through page loads. Decide in `/10x-plan`.

Reference: [Popup marker example](https://react-leaflet.js.org/docs/example-popup-marker).

## 4. Fit map to all pins (`useMap` + `fitBounds`)

`useMap()` returns the Leaflet `Map` instance for any descendant of `<MapContainer>` (from [api-map](https://react-leaflet.js.org/docs/api-map)):

```jsx
import { useMap } from "react-leaflet/hooks";

function FitToCrags({ crags }) {
  const map = useMap();
  useEffect(() => {
    if (crags.length === 1) {
      map.setView([crags[0].latitude, crags[0].longitude], 14);
    } else if (crags.length > 1) {
      map.fitBounds(
        crags.map((c) => [c.latitude, c.longitude]),
        { padding: [40, 40] },
      );
    }
  }, [crags, map]);
  return null;
}
```

Leaflet `fitBounds` accepts an array of `[lat, lng]` pairs directly (from [Leaflet reference](https://leafletjs.com/reference.html#map-fitbounds)). `padding` / `paddingTopLeft` / `paddingBottomRight` reserve container-corner space — useful if the catalog UI overlays a sidebar or sticky header on top of the map.

**Single-marker edge case**: `fitBounds` on one point picks the world view. Branch to `setView([lat, lng], <zoom>)` when N=1 (shown above).

## 5. Custom pin icon

Two paths, both from the Leaflet docs:

**Option A — image icon (`L.icon`)** from [custom-icons example](https://leafletjs.com/examples/custom-icons/):

```js
import L from "leaflet";

const cragIcon = L.icon({
  iconUrl: "/icons/crag-pin.png",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
});
```

**Option B — HTML/SVG icon (`L.divIcon`)** from the [0.4 release notes](https://leafletjs.com/2012/07/30/leaflet-0-4-released.html) and Leaflet reference:

```js
const cragIcon = L.divIcon({
  className: "crag-pin",
  html: "<svg ...>...</svg>",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});
```

For the shadcn-styled UI in SendLog, **`L.divIcon` is the more aligned choice** — pins are CSS-themable (dark mode, hover, focus), need no extra image assets in the Cloudflare Workers bundle, and side-step the broken-default-icon bundling problem below.

## Stack-specific gotchas (Astro 6 + React 19 islands + Vite + Cloudflare Workers)

These are not in the Context7 results explicitly but are forced by the constraints in `library-research.md`. Calling them out here so `/10x-plan` writes them into the plan instead of rediscovering them mid-build.

1. **`client:only="react"` is mandatory.** Leaflet touches `window` at import time and Cloudflare Workers has no `window`. The Astro page may render a placeholder; the React island imports react-leaflet and Leaflet only. **Never** import `leaflet` or `react-leaflet` from an `.astro` file or from a server-side helper.
2. **CSS import.** `import "leaflet/dist/leaflet.css";` is required (controls and tile pane render broken without it). Import it from inside the React-Leaflet island so Vite ships it only on the client bundle.
3. **Broken default marker icon under Vite.** The bundler rewrites Leaflet's default `marker-icon.png` / `marker-icon-2x.png` / `marker-shadow.png` paths into URLs that don't resolve, so default markers render as broken images. Two known fixes:
   - **Preferred**: use `L.divIcon` for every `<Marker>` (Option B above) and never touch the default icon.
   - **If `L.icon` is needed**: explicitly rewire `L.Icon.Default` once at module load:
     ```js
     import L from "leaflet";
     import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
     import iconUrl from "leaflet/dist/images/marker-icon.png";
     import shadowUrl from "leaflet/dist/images/marker-shadow.png";
     L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
     ```
4. **Vite optimizeDeps.** Some Astro + react-leaflet setups need `optimizeDeps: { include: ["leaflet"] }` in `astro.config.mjs` (called out in the Jan Müller blog cited in `library-research.md`). Add only if dev-server boot complains.

## Cross-references

- Survey + trade-offs across all map options: `./library-research.md`
- Change identity + scope: `./change.md`
- Roadmap entry: `context/foundation/roadmap.md` (S-02, lines 130-141)
- PRD requirements: `context/foundation/prd.md` (FR-004, FR-005, fallback note line 168)

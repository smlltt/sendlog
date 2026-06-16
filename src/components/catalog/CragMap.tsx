import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { CragMapPin } from "@/lib/catalog";

const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40" aria-hidden="true">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 13.6 22.7 14.4 23.4a2.4 2.4 0 0 0 3.2 0C18.4 38.7 32 27.2 32 16 32 7.16 24.84 0 16 0z" fill="currentColor"/>
  <circle cx="16" cy="15" r="6" fill="white"/>
</svg>
`.trim();

const cragIcon = L.divIcon({
  className: "crag-pin",
  html: PIN_SVG,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
});

// Minimal HTML escape for popup content. Crag name + region come from Strapi
// (admin-controlled), but bindPopup takes raw HTML so we still escape to keep
// the trust boundary clean.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopupHtml(pin: CragMapPin, openRoutesLabel: string): string {
  return `<div class="text-sm"><strong class="block text-slate-900">${escapeHtml(pin.name)}</strong><a href="${escapeHtml(pin.href)}" class="mt-1 inline-block text-slate-700 underline hover:text-slate-900">${escapeHtml(openRoutesLabel)}</a></div>`;
}

interface ClusteredCragMarkersProps {
  pins: CragMapPin[];
  openRoutesLabel: string;
}

// Clustering is wired through the imperative leaflet.markercluster API rather
// than react-leaflet components because there is no first-party React-Leaflet
// v5 wrapper for the plugin. Default options give the UX we want: clicking a
// cluster zooms in to expand it (zoomToBoundsOnClick: true), and Leaflet picks
// the cluster vs individual-marker threshold per zoom level automatically.
function ClusteredCragMarkers({ pins, openRoutesLabel }: ClusteredCragMarkersProps) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup();
    for (const pin of pins) {
      // Stable interaction contract for tests + a11y: Leaflet markers default to
      // `keyboard: true`, so the icon element gets `role="button"` and is
      // focusable; passing `title` sets the icon's `title`, which becomes the
      // button's accessible name (the SVG glyph is `aria-hidden`). This lets
      // Playwright locate the seeded crag by `getByRole("button", { name })`
      // without coupling to the `.crag-pin` class, Leaflet panes, or cluster
      // internals. Do not remove `pin.name` here without updating the spec.
      L.marker([pin.latitude, pin.longitude], { icon: cragIcon, title: pin.name })
        .bindPopup(buildPopupHtml(pin, openRoutesLabel))
        .addTo(group);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [pins, map, openRoutesLabel]);
  return null;
}

interface FitToCragsProps {
  pins: CragMapPin[];
}

function FitToCrags({ pins }: FitToCragsProps) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 1) {
      const only = pins[0];
      map.setView([only.latitude, only.longitude], 14);
    } else if (pins.length > 1) {
      const bounds = pins.map((pin) => [pin.latitude, pin.longitude] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [pins, map]);
  return null;
}

interface CragMapProps {
  pins: CragMapPin[];
  openRoutesLabel: string;
}

export default function CragMap({ pins, openRoutesLabel }: CragMapProps) {
  return useMemo(
    () => (
      <MapContainer
        center={[52, 19]}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "60vh", width: "100%" }}
        className="overflow-hidden rounded-md border border-slate-200"
      >
        {/* i18n-allow — third-party legally-required OSM tile attribution */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClusteredCragMarkers pins={pins} openRoutesLabel={openRoutesLabel} />
        <FitToCrags pins={pins} />
      </MapContainer>
    ),
    [pins, openRoutesLabel],
  );
}

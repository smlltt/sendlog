/**
 * Server-safe DTO + mapper for the homepage crag map (S-02).
 *
 * This file is server-safe: it has no top-level browser-only imports (no
 * `leaflet`, no `react-leaflet`, no DOM access), so Astro pages, API routes,
 * and the rest of the catalog module can import it without dragging Leaflet
 * into the Cloudflare Workers SSR path.
 *
 * `CragMapPin` is also type-only-importable from React islands via
 * `import type { CragMapPin } from "@/lib/catalog"` — type-only imports are
 * erased at compile time, so the client bundle never picks up the surrounding
 * catalog runtime (`strapi.client.ts`, the Strapi API token, etc.).
 */

import type { CatalogCrag, CatalogRegion } from "@/lib/catalog/types";

export interface CragMapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  href: string;
  regionSlug: string;
  regionName: string;
}

type InvalidReason = "missing_region_slug" | "invalid_latitude" | "invalid_longitude";

/**
 * Converts the upstream `CatalogCrag[]` + `CatalogRegion[]` payloads into the
 * serializable `CragMapPin[]` consumed by the `CragMap` React island and its
 * SSR fallback list.
 *
 * Invalid records are filtered out — never thrown — so a single bad crag from
 * Strapi does not break the whole map. Each drop is logged via `console.warn`
 * for diagnostic visibility (Cloudflare logs, dev terminal).
 *
 * Region name resolution: case-sensitive slug lookup against `regions`; when
 * no match exists the slug itself is used as the label so the UI never breaks
 * on a missing region record.
 */
export function toCragMapPins(crags: CatalogCrag[], regions: CatalogRegion[]): CragMapPin[] {
  const regionNameBySlug = new Map<string, string>();
  for (const region of regions) {
    regionNameBySlug.set(region.slug, region.name);
  }

  const warn = (slug: string, reason: InvalidReason) => {
    console.warn({ slug, reason });
  };

  const pins: CragMapPin[] = [];
  for (const crag of crags) {
    const { regionSlug, latitude, longitude } = crag;
    if (regionSlug === null) {
      warn(crag.slug, "missing_region_slug");
      continue;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      warn(crag.slug, "invalid_latitude");
      continue;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      warn(crag.slug, "invalid_longitude");
      continue;
    }
    pins.push({
      id: crag.id,
      name: crag.name,
      latitude,
      longitude,
      href: `/regiony/${regionSlug}/${crag.slug}`,
      regionSlug,
      regionName: regionNameBySlug.get(regionSlug) ?? regionSlug,
    });
  }
  return pins;
}

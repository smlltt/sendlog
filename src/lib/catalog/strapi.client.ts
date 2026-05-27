import { STRAPI_API_URL, STRAPI_API_TOKEN } from "astro:env/server";
import { withCache } from "@/lib/catalog/cache";
import {
  CatalogError,
  type CatalogCrag,
  type CatalogPhoto,
  type CatalogReadOptions,
  type CatalogRegion,
  type CatalogRoute,
} from "@/lib/catalog/types";

const DEFAULT_LOCALE = "pl";
const DEFAULT_PAGE_SIZE = 100;

/**
 * Strapi v5 returns a flat record shape (no v4 `.attributes` envelope). These
 * Strapi* types model just the fields we actually read; unknown fields are
 * preserved by Strapi but ignored by the mapper.
 */
interface StrapiMediaFormatThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

interface StrapiMedia {
  url?: string;
  width?: number;
  height?: number;
  formats?: Record<string, StrapiMediaFormatThumbnail | undefined>;
}

interface StrapiRegionRecord {
  documentId: string;
  slug: string;
  name: string;
}

interface StrapiCragRecord {
  documentId: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  photo?: StrapiMedia | null;
  region?: StrapiRegionRecord | null;
}

interface StrapiRouteRecord {
  documentId: string;
  slug: string;
  name: string;
  grade: string;
  type: string;
  yearSet?: number | null;
  crag?: (StrapiCragRecord & { region?: StrapiRegionRecord | null }) | null;
}

interface StrapiListResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

function ensureConfig(): { url: string; token: string } {
  if (!STRAPI_API_URL || !STRAPI_API_TOKEN) {
    throw new CatalogError("missing_config", "Strapi API URL or token is not configured", {
      hasUrl: Boolean(STRAPI_API_URL),
      hasToken: Boolean(STRAPI_API_TOKEN),
    });
  }
  return { url: STRAPI_API_URL.replace(/\/$/, ""), token: STRAPI_API_TOKEN };
}

async function strapiFetch<T>(path: string, options: CatalogReadOptions): Promise<T> {
  const { url, token } = ensureConfig();
  const requestUrl = `${url}${path}`;

  return withCache<T>(requestUrl, options, async () => {
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
    } catch (cause) {
      throw new CatalogError("network_error", "Failed to reach Strapi", {
        cause: cause instanceof Error ? cause.message : String(cause),
        url: requestUrl,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new CatalogError("unauthorized", "Strapi rejected the API token", {
        status: response.status,
        url: requestUrl,
      });
    }

    if (!response.ok) {
      throw new CatalogError("upstream_error", "Strapi returned a non-OK response", {
        status: response.status,
        url: requestUrl,
      });
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new CatalogError("upstream_error", "Strapi returned a non-JSON response", {
        cause: cause instanceof Error ? cause.message : String(cause),
        url: requestUrl,
      });
    }
  });
}

function buildListPath(
  resource: "regions" | "crags" | "routes",
  options: CatalogReadOptions,
  populate?: string[],
): string {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const params = new URLSearchParams();
  params.set("locale", locale);
  params.set("sort", "name:asc");
  params.set("pagination[pageSize]", String(DEFAULT_PAGE_SIZE));
  // Explicitly request published content. Strapi v5 returns published-only by
  // default, but pinning the status here makes the contract obvious and
  // future-proofs against schema option changes.
  params.set("status", "published");
  for (const path of populate ?? []) {
    params.append("populate", path);
  }
  return `/api/${resource}?${params.toString()}`;
}

function mapPhoto(media: StrapiMedia | null | undefined): CatalogPhoto | null {
  if (!media?.url) return null;
  return {
    url: media.url,
    width: typeof media.width === "number" ? media.width : undefined,
    height: typeof media.height === "number" ? media.height : undefined,
  };
}

function mapRegion(record: StrapiRegionRecord): CatalogRegion {
  return {
    id: record.documentId,
    slug: record.slug,
    name: record.name,
  };
}

function mapCrag(record: StrapiCragRecord): CatalogCrag {
  return {
    id: record.documentId,
    slug: record.slug,
    name: record.name,
    latitude: record.latitude,
    longitude: record.longitude,
    photo: mapPhoto(record.photo),
    regionId: record.region?.documentId ?? null,
    regionSlug: record.region?.slug ?? null,
  };
}

function mapRoute(record: StrapiRouteRecord): CatalogRoute {
  return {
    id: record.documentId,
    slug: record.slug,
    name: record.name,
    grade: record.grade,
    type: record.type,
    yearSet: typeof record.yearSet === "number" ? record.yearSet : null,
    cragId: record.crag?.documentId ?? null,
    cragSlug: record.crag?.slug ?? null,
    regionId: record.crag?.region?.documentId ?? null,
    regionSlug: record.crag?.region?.slug ?? null,
  };
}

/**
 * Lists published regions in the requested locale (defaults to Polish). The
 * regions smoke page in Phase 3 consumes this directly; later catalog browsing
 * will share the same entrypoint.
 */
export async function listRegions(options: CatalogReadOptions = {}): Promise<CatalogRegion[]> {
  const path = buildListPath("regions", options);
  const json = await strapiFetch<StrapiListResponse<StrapiRegionRecord>>(path, options);
  return json.data.map(mapRegion);
}

/**
 * Lists published crags. Nested `region` is populated so callers get the
 * parent identity without a second round-trip. Photo (when present) carries an
 * absolute Strapi Cloud CDN URL; no transforms are applied in v1.
 */
export async function listCrags(options: CatalogReadOptions = {}): Promise<CatalogCrag[]> {
  const path = buildListPath("crags", options, ["photo", "region"]);
  const json = await strapiFetch<StrapiListResponse<StrapiCragRecord>>(path, options);
  return json.data.map(mapCrag);
}

/**
 * Lists published routes. Nested `crag.region` is populated to carry full
 * parent identity. `id` is Strapi's `documentId` and is the canonical reference
 * used by later private state (Supabase climb logs, projects, etc.).
 */
export async function listRoutes(options: CatalogReadOptions = {}): Promise<CatalogRoute[]> {
  const path = buildListPath("routes", options, ["crag", "crag.region"]);
  const json = await strapiFetch<StrapiListResponse<StrapiRouteRecord>>(path, options);
  return json.data.map(mapRoute);
}

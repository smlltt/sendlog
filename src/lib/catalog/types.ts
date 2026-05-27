/**
 * App-facing catalog contract. These types are intentionally independent from
 * Strapi's raw response shape — the Strapi client (strapi.client.ts) maps
 * incoming records into these types so pages and later features never see the
 * upstream wire format.
 *
 * Canonical identity: `id` on every catalog entity is Strapi's stable
 * `documentId`. Slugs are routing metadata only and MUST NOT be used as
 * canonical references in private state (e.g., Supabase rows linking back to a
 * route should store the route `id`).
 */

export interface CatalogPhoto {
  url: string;
  width?: number;
  height?: number;
}

export interface CatalogRegion {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogCrag {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  photo: CatalogPhoto | null;
  regionId: string | null;
  regionSlug: string | null;
}

export interface CatalogRoute {
  id: string;
  slug: string;
  name: string;
  grade: string;
  type: string;
  yearSet: number | null;
  cragId: string | null;
  cragSlug: string | null;
  regionId: string | null;
  regionSlug: string | null;
}

export interface CatalogReadOptions {
  /**
   * Skip the Cache API lookup and write for this read. Used by the smoke page
   * to verify edit visibility against a local Strapi without waiting for the
   * 1-hour TTL to expire. Cache is also bypassed automatically when
   * STRAPI_API_URL points at a localhost address.
   */
  bypassCache?: boolean;
  /**
   * Override the default `pl` locale. `name` is the only localized field on
   * catalog content types in v1; other fields are shared across locales.
   */
  locale?: string;
}

export type CatalogErrorCode = "missing_config" | "unauthorized" | "upstream_error" | "network_error";

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: CatalogErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = "CatalogError";
    this.code = code;
    this.context = context;
  }
}

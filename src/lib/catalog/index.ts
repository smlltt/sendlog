/**
 * Catalog module — server-only entrypoint for reading published Strapi catalog
 * content (regions, crags, routes). Import from `@/lib/catalog`; never reach
 * into `strapi.client.ts` or `cache.ts` directly from outside this folder.
 *
 * Catalog reads are server-only because they carry a Strapi API token. Do not
 * import this module from React components rendered on the client — use Astro
 * pages or API routes as the boundary and pass mapped data into islands as
 * props.
 */

export {
  listRegions,
  listCrags,
  listRoutes,
  getRegionBySlug,
  listCragsByRegion,
  getCragBySlug,
  listRoutesByCrag,
} from "@/lib/catalog/strapi.client";
export { CATALOG_CACHE_TTL_SECONDS, isLocalStrapi } from "@/lib/catalog/cache";
export {
  CatalogError,
  type CatalogCrag,
  type CatalogErrorCode,
  type CatalogPhoto,
  type CatalogReadOptions,
  type CatalogRegion,
  type CatalogRoute,
} from "@/lib/catalog/types";

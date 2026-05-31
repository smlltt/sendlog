import { CatalogError, listRoutes, type CatalogRoute } from "@/lib/catalog";
import { PrivateStateError } from "@/lib/private-state/types";

/**
 * Resolve `routeId` against the published Strapi catalog. Returns the matching
 * `CatalogRoute` or throws a typed `PrivateStateError`.
 *
 * - `unknown_route` — the catalog has no published route with this `documentId`.
 * - `missing_config` — `STRAPI_API_URL` / `STRAPI_API_TOKEN` are unset.
 * - `upstream_error` — anything else from the catalog (network / 5xx / parse).
 *
 * The catalog cache (1-hour TTL, single shared key per resource) absorbs the
 * cost — at steady state this is a zero-extra-Strapi-request integrity check.
 *
 * Internal to `@/lib/private-state`; not re-exported via `index.ts`.
 */
export async function validateRouteId(routeId: string): Promise<CatalogRoute> {
  let routes: CatalogRoute[];
  try {
    routes = await listRoutes();
  } catch (cause) {
    if (cause instanceof CatalogError) {
      const code = cause.code === "missing_config" ? "missing_config" : "upstream_error";
      throw new PrivateStateError(code, `Catalog read failed while validating routeId: ${cause.message}`, {
        routeId,
        catalogCode: cause.code,
        catalogContext: cause.context,
      });
    }
    throw cause;
  }
  const match = routes.find((route) => route.id === routeId);
  if (!match) {
    throw new PrivateStateError("unknown_route", `Strapi nie zwrócił żadnej drogi o documentId ${routeId}.`, {
      routeId,
    });
  }
  return match;
}

/**
 * Resilient catalog read used during hydration of read helpers. Same error
 * translation as `validateRouteId` minus the per-routeId match step.
 */
export async function loadCatalogRoutes(): Promise<CatalogRoute[]> {
  try {
    return await listRoutes();
  } catch (cause) {
    if (cause instanceof CatalogError) {
      const code = cause.code === "missing_config" ? "missing_config" : "upstream_error";
      throw new PrivateStateError(code, `Catalog read failed during hydration: ${cause.message}`, {
        catalogCode: cause.code,
        catalogContext: cause.context,
      });
    }
    throw cause;
  }
}

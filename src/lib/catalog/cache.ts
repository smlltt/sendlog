import { STRAPI_API_URL } from "astro:env/server";
import type { CatalogReadOptions } from "@/lib/catalog/types";

/**
 * Default TTL for cached Strapi reads (1 hour). Sized for the actual catalog
 * edit cadence rather than near-real-time freshness; webhook invalidation is a
 * known follow-up (see __tests__/README.md).
 */
export const CATALOG_CACHE_TTL_SECONDS = 3600;

/**
 * True when the configured Strapi base URL points at a local instance. Used to
 * bypass the Cache API during local verification — admins editing content in a
 * dev Strapi expect to see updates immediately, not after the 1-hour TTL.
 */
export function isLocalStrapi(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

interface CacheGlobal {
  default: {
    match(key: Request): Promise<Response | undefined>;
    put(key: Request, response: Response): Promise<void>;
  };
}

function getCachesDefault(): CacheGlobal["default"] | null {
  const cachesRef = (globalThis as { caches?: CacheGlobal }).caches;
  return cachesRef?.default ?? null;
}

/**
 * Wraps a JSON-returning Strapi fetch with the Cloudflare Cache API. The cache
 * key is the upstream request URL. Caching is skipped (read + write) when:
 *   - `options.bypassCache === true`
 *   - `STRAPI_API_URL` points at a local Strapi
 *   - `caches.default` is unavailable (e.g., Node SSR or build-time prerender)
 *
 * The fetcher result is cached as a fresh `Response` keyed by the upstream URL;
 * it is NOT a transparent proxy of the upstream `Response`. This keeps the
 * cached payload small and free of Strapi-side caching headers we don't want
 * to honor.
 */
export async function withCache<T>(key: string, options: CatalogReadOptions, fetcher: () => Promise<T>): Promise<T> {
  const caches = getCachesDefault();
  const shouldBypass = options.bypassCache === true || isLocalStrapi(STRAPI_API_URL) || caches === null;

  if (shouldBypass) {
    return fetcher();
  }

  const cacheKey = new Request(key, { method: "GET" });

  const cached = await caches.match(cacheKey);
  if (cached) {
    return (await cached.json()) as T;
  }

  const value = await fetcher();
  const response = new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CATALOG_CACHE_TTL_SECONDS}`,
    },
  });

  try {
    await caches.put(cacheKey, response);
  } catch {
    // Cache writes are best-effort; never fail the read because the cache
    // backend rejected the entry (e.g., size limit, transient runtime issue).
  }

  return value;
}

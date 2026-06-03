/**
 * Climbs UI module — public types.
 *
 * These DTOs cross the server → client boundary as React island props,
 * so they MUST stay free of server-only structures (no Supabase rows, no
 * `CatalogRoute` for write paths, no `PrivateStateClient`). The Astro
 * page assembles primitive props before passing them in, and the API
 * route at `/api/climbs` is the only path back to the server-only
 * `@/lib/private-state` module.
 */

/**
 * Per-route, per-user summary computed server-side by the crag page from
 * `listClimbs(client)` results. `count: 0` and `latestClimbedOn: null`
 * represent "no climbs logged yet for this route by this user".
 */
export interface RouteClimbSummary {
  count: number;
  latestClimbedOn: string | null;
}

/**
 * Mirror of the server-side `UserClimb` shape from `@/lib/private-state`,
 * duplicated here so the React island does not pull in the server-only
 * module. Keep field names in sync with `UserClimb` — same camelCase,
 * same string serialization.
 */
export interface ClimbResponse {
  id: string;
  routeId: string;
  climbedOn: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stable identifiers for every failure surface the `/api/climbs` endpoint
 * can return. Mirrors the server-side `ApiErrorCode` so the React island
 * can branch on `code` (e.g. show "session expired, sign in again" for
 * `unauthenticated`) without parsing free-form messages.
 */
export type ClimbApiErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "unknown_route"
  | "duplicate_project"
  | "not_found"
  | "missing_config"
  | "upstream_error"
  | "unknown";

export interface ClimbApiErrorBody {
  error: {
    code: ClimbApiErrorCode;
    message: string;
    context: Record<string, unknown>;
  };
}

/**
 * Success payload from `DELETE /api/climbs`. Echoes the deleted climb `id`
 * so the `/historia` row island can reconcile its local list state without
 * a re-fetch. A handled `not_found` (404) error is treated by the client as
 * an idempotent "already gone" — see `ClimbApiErrorCode`.
 */
export interface DeleteClimbResponse {
  deleted: {
    id: string;
  };
}

/**
 * Pre-shaped row consumed by `<HistoryList>` on `/historia`.
 *
 * The page-level loader (`src/pages/historia.astro`) joins
 * `listClimbs(client)` against `listCrags()` and projects each row into
 * this DTO so the list component never touches `@/lib/private-state` or
 * `@/lib/catalog`. This keeps the server-only boundary intact and
 * leaves `HistoryList` reusable from any future caller (e.g. dashboard
 * preview, projects page) that hydrates the same primitives.
 *
 * `cragHref` is `null` when either `regionSlug` or `cragSlug` is
 * missing on the underlying route — the row still renders, but the
 * page surfaces a Polish unavailable-link fallback instead of emitting
 * a broken `/regiony/null/null` URL.
 */
export interface HistoryClimbItem {
  id: string;
  climbedOn: string;
  note: string | null;
  routeName: string | null;
  routeGrade: string | null;
  cragName: string | null;
  cragHref: string | null;
}

/**
 * Projects UI module — public types.
 *
 * These DTOs cross the server → client boundary as React island props,
 * so they MUST stay free of server-only structures (no Supabase rows, no
 * `CatalogRoute` for write paths, no `PrivateStateClient`). The Astro page
 * assembles primitive props before passing them in, and the API route at
 * `/api/projects` is the only path back to the server-only
 * `@/lib/private-state` module. Mirrors `src/components/climbs/types.ts`.
 */

/**
 * Mirror of the server-side `UserProject` shape from `@/lib/private-state`,
 * duplicated here so the React island does not pull in the server-only
 * module. Keep field names in sync with `UserProject` — same camelCase,
 * same string serialization.
 */
export interface ProjectResponse {
  id: string;
  routeId: string;
  createdAt: string;
}

/**
 * Success payload from `POST /api/projects`. Carries the new project row so
 * the crag-row toggle can hold the project `id` and support an immediate
 * remove without a re-fetch.
 */
export interface AddProjectResponse {
  project: ProjectResponse;
}

/**
 * Success payload from `DELETE /api/projects`. Echoes the deleted project
 * `id` so the calling island can reconcile its local state without a
 * re-fetch. A handled `not_found` (404) error is treated by the client as an
 * idempotent "already gone" — see `ProjectApiErrorCode`.
 */
export interface DeleteProjectResponse {
  deleted: {
    id: string;
  };
}

/**
 * Stable identifiers for every failure surface the `/api/projects` endpoint
 * can return. Mirrors the server-side `ApiErrorCode` so the React island can
 * branch on `code` (e.g. show "session expired, sign in again" for
 * `unauthenticated`) without parsing free-form messages.
 */
export type ProjectApiErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "unknown_route"
  | "duplicate_project"
  | "not_found"
  | "missing_config"
  | "upstream_error"
  | "unknown";

export interface ProjectApiErrorBody {
  error: {
    code: ProjectApiErrorCode;
    message: string;
    context: Record<string, unknown>;
  };
}

/**
 * Pre-shaped row consumed by `<ProjectsList>` on `/projekty`.
 *
 * The page-level loader (`src/pages/projekty.astro`) joins
 * `listProjects(client)` against `listCrags()` and projects each row into
 * this DTO so the list component never touches `@/lib/private-state` or
 * `@/lib/catalog`. This keeps the server-only boundary intact. Mirrors
 * `HistoryClimbItem`.
 *
 * `cragHref` is `null` when either `regionSlug` or `cragSlug` is missing on
 * the underlying route — the row still renders, but the page surfaces a
 * Polish unavailable-link fallback instead of emitting a broken
 * `/regiony/null/null` URL.
 */
export interface ProjectListItem {
  id: string;
  addedOn: string;
  routeName: string | null;
  routeGrade: string | null;
  routeType: string | null;
  cragName: string | null;
  cragHref: string | null;
}

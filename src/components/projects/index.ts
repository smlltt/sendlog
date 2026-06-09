/**
 * Projects UI module — public entrypoint.
 *
 * React islands and shared types for the S-06 personal projects list flow.
 * The components here are explicitly client-safe — none of them imports
 * `@/lib/private-state`. The single path back to Supabase is the JSON
 * `POST` / `DELETE /api/projects` endpoint, which the islands call through
 * `fetch`. Mirrors `src/components/climbs/index.ts`.
 *
 * Astro pages that need to embed an island should import the default export
 * from `ProjectAction` / `ProjectsListCard` directly with `client:load` (the
 * `<Astro client:*>` directive only works on default exports). The named
 * re-exports below are intended for cross-component imports inside
 * React-land.
 */

export type {
  ProjectResponse,
  AddProjectResponse,
  DeleteProjectResponse,
  ProjectApiErrorBody,
  ProjectApiErrorCode,
  ProjectListItem,
} from "@/components/projects/types";

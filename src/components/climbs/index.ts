/**
 * Climbs UI module — public entrypoint.
 *
 * React islands and shared types for the S-04 inline route-log flow.
 * The components here are explicitly client-safe — none of them imports
 * `@/lib/private-state`. The single path back to Supabase is the JSON
 * `POST /api/climbs` endpoint, which the form calls through `fetch`.
 *
 * Astro pages that need to embed an island should import the default
 * export from `RouteClimbAction` directly with `client:load` (the
 * `<Astro client:*>` directive only works on default exports). The
 * named re-exports below are intended for cross-component imports
 * inside React-land.
 */

export type { RouteClimbSummary, ClimbResponse, ClimbApiErrorBody, ClimbApiErrorCode } from "@/components/climbs/types";
export { default as ClimbLogForm } from "@/components/climbs/ClimbLogForm";
export { default as RouteClimbAction } from "@/components/climbs/RouteClimbAction";

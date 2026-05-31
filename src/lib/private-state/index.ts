/**
 * Private-state module — server-only entrypoint for per-user climb log and
 * projects I/O backed by Supabase. Every row is anchored to a Strapi catalog
 * route by `documentId` (`CatalogRoute.id` in `@/lib/catalog`); slugs are
 * routing metadata and MUST NOT be used as cross-source references.
 *
 * Server-only because every helper carries the request's Supabase session
 * cookies and the catalog module's API token. Do NOT import this module from
 * React components rendered on the client — use Astro pages or API routes as
 * the boundary and pass mapped DTOs into islands as props.
 *
 * Deep imports into `client.ts`, `climbs.ts`, `projects.ts`, or any other
 * file inside this folder are discouraged the same way `@/lib/catalog`'s
 * internal modules are private; consume the surface re-exported below.
 *
 * Authenticated-only writes: every helper takes a `PrivateStateClient` built
 * by `createPrivateStateClient(headers, cookies, user)`, which refuses to
 * proceed without a non-null `user`. RLS is the second line of defense; this
 * is the first one inside the app.
 *
 * Orphan handling: read helpers hydrate `route_id` against `@/lib/catalog`.
 * When a private row points at a `route_id` not present in the catalog
 * (admin deletion / unpublish), the row is dropped by default and surfaced
 * with `route: null` only when the caller passes `{ includeOrphans: true }`.
 * Cleanup paths (e.g. the smoke page) MUST pass `includeOrphans: true` so
 * orphan rows are not silently skipped.
 */

export {
  PrivateStateError,
  type CreateClimbInput,
  type CreateProjectInput,
  type PrivateStateErrorCode,
  type PrivateStateReadOptions,
  type UserClimb,
  type UserClimbWithRoute,
  type UserProject,
  type UserProjectWithRoute,
} from "@/lib/private-state/types";
export { createPrivateStateClient, type PrivateStateClient } from "@/lib/private-state/client";
export { createClimb, deleteClimb, listClimbs, listClimbsByRoute } from "@/lib/private-state/climbs";
export { addProject, isRouteOnProjects, listProjects, removeProject } from "@/lib/private-state/projects";

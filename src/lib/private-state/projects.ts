import type { CatalogRoute } from "@/lib/catalog";
import type { PrivateStateClient } from "@/lib/private-state/client";
import {
  type CreateProjectInput,
  PrivateStateError,
  type PrivateStateReadOptions,
  type UserProject,
  type UserProjectWithRoute,
} from "@/lib/private-state/types";
import { loadCatalogRoutes, validateRouteId } from "@/lib/private-state/validate-route";

interface ProjectRow {
  id: string;
  route_id: string;
  created_at: string;
}

const PROJECT_COLUMNS = "id, route_id, created_at";

function rowToProject(row: ProjectRow): UserProject {
  return {
    id: row.id,
    routeId: row.route_id,
    createdAt: row.created_at,
  };
}

/**
 * List the current user's projects ordered by `created_at desc` (FR-013).
 * Hydrated against `@/lib/catalog`'s `listRoutes()`; orphans are dropped by
 * default, surfaced with `route: null` only when `{ includeOrphans: true }`.
 */
export async function listProjects(
  client: PrivateStateClient,
  options: PrivateStateReadOptions = {},
): Promise<UserProjectWithRoute[]> {
  const { data, error } = await client.supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("user_id", client.userId)
    .order("created_at", { ascending: false })
    .overrideTypes<ProjectRow[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase select on projects failed: ${error.message}`, {
      pgCode: error.code,
    });
  }
  const rows: ProjectRow[] = data;
  if (rows.length === 0) return [];

  const routes = await loadCatalogRoutes();
  const routesById = new Map<string, CatalogRoute>(routes.map((route) => [route.id, route] as const));
  const includeOrphans = options.includeOrphans === true;
  const result: UserProjectWithRoute[] = [];
  for (const row of rows) {
    const route = routesById.get(row.route_id) ?? null;
    if (!route && !includeOrphans) continue;
    result.push({ ...rowToProject(row), route });
  }
  return result;
}

/**
 * Per-route "is this on the current user's projects list?" indicator (S-06).
 * Returns `true` iff a `projects` row exists for `(client.userId, routeId)`.
 */
export async function isRouteOnProjects(client: PrivateStateClient, routeId: string): Promise<boolean> {
  const { data, error } = await client.supabase
    .from("projects")
    .select("id")
    .eq("user_id", client.userId)
    .eq("route_id", routeId)
    .limit(1)
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase select on projects failed: ${error.message}`, {
      pgCode: error.code,
      routeId,
    });
  }
  return data.length > 0;
}

/**
 * Add a route to the current user's projects list. `routeId` is validated
 * against the catalog first; the duplicate-route case (Postgres `23505`
 * unique_violation on `(user_id, route_id)`) is translated into
 * `PrivateStateError("duplicate_project")` so callers never see the raw pg
 * code.
 */
export async function addProject(client: PrivateStateClient, input: CreateProjectInput): Promise<UserProject> {
  await validateRouteId(input.routeId);

  const { data, error } = await client.supabase
    .from("projects")
    .insert({
      user_id: client.userId,
      route_id: input.routeId,
    })
    .select(PROJECT_COLUMNS)
    .single<ProjectRow>();
  if (error) {
    if (error.code === "23505") {
      throw new PrivateStateError(
        "duplicate_project",
        `Trasa o documentId ${input.routeId} jest już na liście projektów.`,
        { routeId: input.routeId },
      );
    }
    throw new PrivateStateError("upstream_error", `Supabase insert on projects failed: ${error.message}`, {
      pgCode: error.code,
      routeId: input.routeId,
    });
  }
  return rowToProject(data);
}

/**
 * Hard-delete a project owned by the current user. Same `not_found` discipline
 * as `deleteClimb` — RLS makes "row owned by another user" indistinguishable
 * from "row does not exist".
 */
export async function removeProject(client: PrivateStateClient, id: string): Promise<void> {
  const { data, error } = await client.supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", client.userId)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase delete on projects failed: ${error.message}`, {
      pgCode: error.code,
      id,
    });
  }
  if (data.length === 0) {
    throw new PrivateStateError("not_found", `No project with id=${id} for current user.`, { id });
  }
}

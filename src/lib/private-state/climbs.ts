import type { CatalogRoute } from "@/lib/catalog";
import type { PrivateStateClient } from "@/lib/private-state/client";
import {
  type CreateClimbInput,
  PrivateStateError,
  type PrivateStateReadOptions,
  type UpdateClimbInput,
  type UserClimb,
  type UserClimbWithRoute,
} from "@/lib/private-state/types";
import { loadCatalogRoutes, validateRouteId } from "@/lib/private-state/validate-route";

/**
 * Raw shape of a `public.climbs` row as returned by the Supabase JS client.
 * snake_case mirrors the migration; mapping into camelCase happens in
 * `rowToClimb`.
 */
interface ClimbRow {
  id: string;
  route_id: string;
  climbed_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const CLIMB_COLUMNS = "id, route_id, climbed_on, note, created_at, updated_at";

function rowToClimb(row: ClimbRow): UserClimb {
  return {
    id: row.id,
    routeId: row.route_id,
    climbedOn: row.climbed_on,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List the current user's climbs ordered by `climbed_on desc, created_at desc`
 * (FR-010). Each row is hydrated against `@/lib/catalog`'s `listRoutes()`:
 * the catalog cache absorbs the cost. Orphans (rows whose `route_id` is no
 * longer published) are dropped by default; pass `{ includeOrphans: true }`
 * to keep them and surface `route: null`.
 */
export async function listClimbs(
  client: PrivateStateClient,
  options: PrivateStateReadOptions = {},
): Promise<UserClimbWithRoute[]> {
  const { data, error } = await client.supabase
    .from("climbs")
    .select(CLIMB_COLUMNS)
    .eq("user_id", client.userId)
    .order("climbed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<ClimbRow[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase select on climbs failed: ${error.message}`, {
      pgCode: error.code,
    });
  }
  const rows: ClimbRow[] = data;
  if (rows.length === 0) return [];

  const routes = await loadCatalogRoutes();
  const routesById = new Map<string, CatalogRoute>(routes.map((route) => [route.id, route] as const));
  const includeOrphans = options.includeOrphans === true;
  const result: UserClimbWithRoute[] = [];
  for (const row of rows) {
    const route = routesById.get(row.route_id) ?? null;
    if (!route && !includeOrphans) continue;
    result.push({ ...rowToClimb(row), route });
  }
  return result;
}

/**
 * List the current user's climbs for a single `routeId`. Unhydrated — used by
 * per-route "have I climbed this?" indicators (S-04) where the calling page
 * already has the `CatalogRoute` in hand.
 */
export async function listClimbsByRoute(client: PrivateStateClient, routeId: string): Promise<UserClimb[]> {
  const { data, error } = await client.supabase
    .from("climbs")
    .select(CLIMB_COLUMNS)
    .eq("user_id", client.userId)
    .eq("route_id", routeId)
    .order("climbed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<ClimbRow[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase select on climbs failed: ${error.message}`, {
      pgCode: error.code,
      routeId,
    });
  }
  return data.map(rowToClimb);
}

/**
 * Insert a climb for the current user. `routeId` is validated against the
 * catalog first — unknown ids are rejected with `PrivateStateError("unknown_route")`
 * before any Supabase write happens.
 */
export async function createClimb(client: PrivateStateClient, input: CreateClimbInput): Promise<UserClimb> {
  await validateRouteId(input.routeId);

  const { data, error } = await client.supabase
    .from("climbs")
    .insert({
      user_id: client.userId,
      route_id: input.routeId,
      climbed_on: input.climbedOn,
      note: input.note ?? null,
    })
    .select(CLIMB_COLUMNS)
    .single<ClimbRow>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase insert on climbs failed: ${error.message}`, {
      pgCode: error.code,
      routeId: input.routeId,
    });
  }
  return rowToClimb(data);
}

/**
 * Update one climb owned by the current user — only the editable fields
 * (`climbed_on`, `note`). The route is identity, never re-validated or
 * rewritten here. RLS enforces user scoping; the explicit `user_id` filter
 * makes the intent obvious and lets the helper collapse "row not found" and
 * "RLS denied" into one `not_found` (both surface as zero rows returned). The
 * `climbs_set_updated_at` trigger bumps `updated_at` on the write. Returns the
 * refreshed `UserClimb` so the caller can reconcile without a re-fetch.
 */
export async function updateClimb(client: PrivateStateClient, id: string, input: UpdateClimbInput): Promise<UserClimb> {
  const { data, error } = await client.supabase
    .from("climbs")
    .update({ climbed_on: input.climbedOn, note: input.note })
    .eq("id", id)
    .eq("user_id", client.userId)
    .select(CLIMB_COLUMNS)
    .overrideTypes<ClimbRow[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase update on climbs failed: ${error.message}`, {
      pgCode: error.code,
      id,
    });
  }
  if (data.length === 0) {
    throw new PrivateStateError("not_found", `No climb with id=${id} for current user.`, { id });
  }
  return rowToClimb(data[0]);
}

/**
 * Hard-delete a climb owned by the current user. RLS already enforces user
 * scoping; the explicit `user_id` filter makes the intent obvious in the SQL
 * and lets the helper distinguish "row not found" from "RLS denied" — both
 * surface as zero rows affected, both throw `not_found`. (See the module
 * `types.ts` header for why there is no separate `forbidden` code.)
 */
export async function deleteClimb(client: PrivateStateClient, id: string): Promise<void> {
  const { data, error } = await client.supabase
    .from("climbs")
    .delete()
    .eq("id", id)
    .eq("user_id", client.userId)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (error) {
    throw new PrivateStateError("upstream_error", `Supabase delete on climbs failed: ${error.message}`, {
      pgCode: error.code,
      id,
    });
  }
  if (data.length === 0) {
    throw new PrivateStateError("not_found", `No climb with id=${id} for current user.`, { id });
  }
}

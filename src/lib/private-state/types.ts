/**
 * App-facing private-state contract. These types are intentionally independent
 * from Supabase's raw row shape — the helpers in `climbs.ts` and `projects.ts`
 * map snake_case database columns into camelCase DTOs so pages and (future)
 * API routes never see the upstream wire format.
 *
 * Canonical identity: `routeId` on every DTO is Strapi's stable `documentId`
 * (the `CatalogRoute.id` invariant from F-01). It is the only acceptable
 * cross-source reference; slugs are routing metadata and MUST NOT be stored on
 * climb / project rows.
 *
 * Server-only by extension: `PrivateStateError` is safe to import anywhere
 * (it has no runtime dependency on secrets), but every helper that throws it
 * is server-only.
 */

import type { CatalogRoute } from "@/lib/catalog";

export interface UserClimb {
  id: string;
  routeId: string;
  climbedOn: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProject {
  id: string;
  routeId: string;
  createdAt: string;
}

export interface UserClimbWithRoute extends UserClimb {
  /**
   * Hydrated catalog route. `null` iff the row points at a `routeId` that is
   * no longer present in `@/lib/catalog`'s `listRoutes()` (orphan). Read
   * helpers drop orphans by default; pass `{ includeOrphans: true }` to keep
   * them and surface `route: null` to the caller.
   */
  route: CatalogRoute | null;
}

export interface UserProjectWithRoute extends UserProject {
  route: CatalogRoute | null;
}

export interface CreateClimbInput {
  routeId: string;
  climbedOn: string;
  note?: string | null;
}

export interface CreateProjectInput {
  routeId: string;
}

export interface PrivateStateReadOptions {
  /**
   * Include rows whose `routeId` is not present in the catalog. Default
   * `false` — orphans are silently dropped. Smoke / cleanup paths that need
   * to reach every row owned by the user should pass `true`.
   */
  includeOrphans?: boolean;
}

export type PrivateStateErrorCode =
  | "missing_config"
  | "unauthenticated"
  | "unknown_route"
  | "duplicate_project"
  | "not_found"
  | "upstream_error";

/**
 * Internal error thrown by every private-state helper. Mirrors the shape of
 * `CatalogError` from `@/lib/catalog`. There is no `forbidden` variant: RLS
 * makes "row owned by another user" indistinguishable from "row does not
 * exist" (both surface as a zero-rows-affected Supabase result), so helpers
 * throw `not_found` in both cases. Future code that needs to distinguish them
 * must add an explicit ownership pre-check before introducing a new code.
 */
export class PrivateStateError extends Error {
  readonly code: PrivateStateErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: PrivateStateErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = "PrivateStateError";
    this.code = code;
    this.context = context;
  }
}

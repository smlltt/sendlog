---
date: 2026-06-10T15:15:00+02:00
researcher: samuelliotta
git_commit: 5b4b5a0adb83d11c70f09fccdfd76a8ca6bd76a9
branch: feature/tests
repository: sendlog
topic: "Private climber flows and data isolation (RLS)"
tags: [research, codebase, rls, private-state, climbs, projects, data-isolation]
status: complete
last_updated: 2026-06-10
last_updated_by: samuelliotta
---

# Research: Private climber flows and data isolation (RLS)

**Date**: 2026-06-10T15:15:00+02:00
**Researcher**: samuelliotta
**Git Commit**: 5b4b5a0adb83d11c70f09fccdfd76a8ca6bd76a9
**Branch**: feature/tests
**Repository**: sendlog

## Research Question

How is per-user (climber) data isolation enforced for private climber data? Map the
database-level RLS posture and the app-level scoping for the private climber flows
(climbs, projects), as the foundation for the "isolation test" phase of this change.
Scope: data isolation / RLS, quick overview.

## Summary

Private climber data is held in exactly two Supabase tables — `public.climbs` and
`public.projects` — and isolation is enforced in **two redundant layers**:

1. **Database (RLS)**: Both tables have RLS enabled with per-operation policies for the
   `authenticated` role only, each scoped to `auth.uid() = user_id`. There are no `anon`
   policies, so anonymous access is denied by default.
2. **Application**: Every read/write goes through `createPrivateStateClient()`, which
   refuses to run without a resolved user and exposes a trusted `userId`. All queries
   additionally filter/write `user_id` explicitly (`.eq("user_id", client.userId)`), so
   the app does not rely on RLS alone.

The user identity is resolved once in `src/middleware.ts` via the cookie-backed Supabase
SSR client and attached to `context.locals.user`. The Supabase client uses the **anon**
key (per README), not a service-role key, so RLS is not bypassed. No service-role client
usage was found in `src`. No obvious cross-user leak was found in the private paths.

The one residual posture risk: `SUPABASE_KEY` is generically named, so misconfiguring it
with a service-role key would silently bypass RLS — nothing in code enforces "anon only".

Prior work (`testing-e2e-auth-foundation`) proved Phase-1 auth (real magic-link sessions,
anonymous `401`) but **explicitly deferred cross-user isolation testing to Phase 2** —
which is exactly this change.

## Detailed Findings

### Private climber tables + RLS (DB layer)

Single migration: `supabase/migrations/20260531172510_private_user_state.sql`.

**`public.climbs`** (`:20-27`)
- `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade`,
  `route_id text not null`, `climbed_on date`, `note`, `created_at`, `updated_at`.
- RLS enabled at `:72`. Per-operation policies, role `authenticated`:
  - `climbs_select_own` — SELECT, `USING (auth.uid() = user_id)` (`:76-80`)
  - `climbs_insert_own` — INSERT, `WITH CHECK (auth.uid() = user_id)` (`:82-86`)
  - `climbs_update_own` — UPDATE, `USING` + `WITH CHECK (auth.uid() = user_id)` (`:88-93`)
  - `climbs_delete_own` — DELETE, `USING (auth.uid() = user_id)` (`:95-99`)

**`public.projects`** (`:47-52`)
- `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade`,
  `route_id text not null`, `created_at`, `unique (user_id, route_id)`.
- RLS enabled at `:73`. Per-operation policies, role `authenticated`:
  - `projects_select_own` — SELECT, `USING (auth.uid() = user_id)` (`:102-106`)
  - `projects_insert_own` — INSERT, `WITH CHECK (auth.uid() = user_id)` (`:108-112`)
  - `projects_update_own` — UPDATE, `USING` + `WITH CHECK` (`:114-119`)
  - `projects_delete_own` — DELETE, `USING (auth.uid() = user_id)` (`:121-125`)

Notes:
- No `anon` policies; comments at `:67-69` state anonymous access is denied once RLS is on.
- No ownership-setting trigger; `user_id` is supplied by the app from request context.
- Only function/trigger is `public.set_updated_at()` for `climbs` — maintenance only
  (`:135-143` function, `:148-151` trigger).
- Catalog entities (crags, routes) are **not** Supabase tables — they live in external
  Strapi and are referenced only by opaque `route_id` text (`:3-7`). So "public vs
  private" is: catalog = external/public, climbs+projects = private per-user.

### User identity + query scoping (app layer)

- `src/middleware.ts:10-20` — resolves user via `supabase.auth.getUser()`, sets
  `context.locals.user`. `PROTECTED_ROUTES = ["/dashboard", "/historia", "/projekty",
  "/private-state-smoke"]` (`:5`).
- `src/lib/supabase.ts:5-23` — cookie-based `@supabase/ssr` server client using
  `SUPABASE_URL` / `SUPABASE_KEY`. README documents `SUPABASE_KEY` as the **anon** key
  (`README.md:120-127`). No `service_role` usage found in `src`.
- `src/lib/private-state/client.ts:30-44` — `createPrivateStateClient()` throws
  `unauthenticated` if `user` is null; returns `{ supabase, userId: user.id }`.

API routes (both call `createPrivateStateClient(headers, cookies, locals.user)`, validate
with zod, and return structured JSON `401` when unauthenticated — intentionally not
middleware-gated):
- `src/pages/api/climbs.ts` — zod schemas (`:70-89`), client init in POST/PATCH/DELETE
  (`:179-182`).
- `src/pages/api/projects.ts` — zod schemas (`:48-53`), client init (`:140-143`).

Helper queries explicitly scope by `user_id` (defense-in-depth on top of RLS):
- Climbs: list `.eq("user_id", client.userId)` (`climbs.ts:51-57`); insert sets `user_id`
  (`:109-118`); update scoped by `id` + `user_id` (`:138-144`).
- Projects: list `.eq("user_id", client.userId)` (`projects.ts:37-42`); insert sets
  `user_id` (`:94-100`).

### Leak-risk assessment

- No cross-user leak found in private paths.
- `/api/climbs` & `/api/projects` not middleware-gated but enforce auth via the private
  client → structured `401`.
- `/historia` and `/projekty` are middleware-protected and use scoped helpers.
- Public crag pages read private summaries only when `Astro.locals.user !== null`, via the
  same scoped helpers.
- Smoke page can list/delete current-user rows (incl. orphans) but is protected and gated
  by `SMOKE_WRITES_ENABLED`.
- **Residual risk**: generic `SUPABASE_KEY` name — a service-role value would bypass RLS;
  not enforced in code.

## Code References

- `supabase/migrations/20260531172510_private_user_state.sql:20-99` — `climbs` table + RLS
- `supabase/migrations/20260531172510_private_user_state.sql:47-125` — `projects` table + RLS
- `supabase/migrations/20260531172510_private_user_state.sql:135-151` — `set_updated_at` trigger
- `src/middleware.ts:5,10-20` — user resolution + protected routes
- `src/lib/supabase.ts:5-23` — cookie-based SSR client (anon key)
- `src/lib/private-state/client.ts:30-44` — auth gate + `userId`
- `src/lib/private-state/climbs.ts:51-57,109-118,138-144` — scoped climb queries
- `src/lib/private-state/projects.ts:37-42,94-100` — scoped project queries
- `src/pages/api/climbs.ts:70-89,179-182` — climbs API (zod + client)
- `src/pages/api/projects.ts:48-53,140-143` — projects API (zod + client)

## Architecture Insights

- **Layered privacy** is the deliberate pattern: middleware (HTML routes) → app auth gate
  (`createPrivateStateClient`) → explicit `user_id` query scoping → RLS at the DB. Any one
  layer failing does not, by itself, leak cross-user data.
- **APIs return JSON `401`, pages redirect** — APIs are intentionally not in
  `PROTECTED_ROUTES` so unauthenticated callers get a structured error, not an HTML redirect.
- **Non-owned rows collapse to `not_found`** on update/delete (scoping by `id` + `user_id`)
  so the API never reveals whether a row exists but belongs to another user.
- **Catalog stays external/public**; only opaque `route_id` links private rows to it — no
  cross-system FK, no private data in the catalog.

## Historical Context (from prior changes)

- `context/archive/2026-05-31-private-user-state-contract/plan.md:25-31,141-150,164-168` —
  F-02: defines `climbs`/`projects` as per-user tables, RLS on, `authenticated`-only
  `auth.uid() = user_id` policies, no `anon`; manual verification that user B can't
  read/delete user A's rows.
- `context/changes/testing-e2e-auth-foundation/research.md:28-32,124-130` and
  `plan.md:5-15,195-208` — Phase 1 proves real magic-link sessions, gated redirects,
  sign-out, and unauthenticated `POST /api/climbs` `401`; **explicitly defers cross-user
  isolation to Phase 2 (this change)**.
- `context/archive/2026-06-01-route-climb-log/plan.md:58-64,460-467` — S-04 climb logging
  on the private-state foundation; manual verification user A can't see user B's history.
- `context/archive/2026-06-03-delete-climb-log/plan.md:49-53,120-125` — S-05 delete uses
  own-row RLS; other-user IDs → `not_found` without leaking ownership.
- `context/archive/2026-06-03-personal-projects-list/research.md:36-42,97-99` &
  `plan.md:72-81` — S-06 projects reuse RLS/helpers; documents the layered privacy model.
- `context/archive/2026-06-09-edit-projects-and-climbs/plan.md:32-36,81-87` — edit climb
  relies on `climbs_update_own`; non-owned rows collapse to `not_found`.
- `context/foundation/test-plan.md:42-55,97-123` — private data leakage = risk #2; Phase 2
  "Private climber flows + isolation" must prove climb/project CRUD persistence **including
  user isolation**.
- `context/foundation/prd.md:42-45,91-107` / `shape-notes.md:55-68,177-191` /
  `roadmap.md:20-31` — strict per-user privacy mandated; F-02 sequenced before
  auth-dependent slices as a guardrail.
- `context/foundation/lessons.md:5-10` — migrations must be pushed to production Supabase
  after any schema change (RLS only protects production once applied there).

## Related Research

- `context/changes/testing-e2e-auth-foundation/research.md` — Phase 1 E2E auth foundation
  (the direct predecessor; this change is its deferred Phase 2).
- `context/archive/2026-06-03-personal-projects-list/research.md` — prior layered-privacy
  documentation for projects.

## Open Questions

- **Isolation test design**: Should the Phase-2 isolation test exercise the DB RLS directly
  (two real users, attempt cross-read/write) or go through the API/UI? The two-layer design
  means an app-only test could pass even if RLS regressed — a true isolation test should
  target the RLS boundary (e.g. authenticated client for user B querying user A's rows).
- **`SUPABASE_KEY` guard**: Worth a check/assertion (or a separate var name) to ensure the
  configured key is anon, so an accidental service-role key can't silently disable RLS?
- **Production parity**: Is the `private_user_state` migration confirmed pushed to
  production Supabase (per `lessons.md`)? An isolation test against a stale prod schema
  would be misleading.

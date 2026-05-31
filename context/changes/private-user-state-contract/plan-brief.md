# Private User State Contract — Plan Brief

> Full plan: `context/changes/private-user-state-contract/plan.md`
> Roadmap: `context/foundation/roadmap.md` (F-02)
> Upstream contract: `context/archive/2026-05-26-catalog-content-contract/` (F-01)

## What & Why

F-02 defines the contract for SendLog's authenticated climber state: a Supabase home for per-user climb logs and projects that anchors every row to a canonical Strapi catalog route via `documentId`, plus the RLS, typed module, and smoke surface that prove the contract works end-to-end.

This is foundational because S-03 (passwordless auth), S-04 (climb log), S-05 (delete climb), and S-06 (projects) all depend on it. The roadmap's named foundation risk — "discovering too late that personal state cannot cleanly attach to catalog routes" — is exactly what the smoke surface in Phase 3 is built to retire.

## Starting Point

The Astro app has auth scaffolding and the F-01 catalog read contract; the public catalog (S-01 / S-02) is live. `src/lib/supabase.ts` constructs a request-scoped server client and `src/middleware.ts` attaches `Astro.locals.user`, but `supabase/migrations/` is empty — there is no `climbs` or `projects` table yet, and no server-side I/O module for private state. The current sign-in is email+password; S-03 will swap to passwordless later without changing the contract F-02 defines.

## Desired End State

Supabase carries two RLS-protected tables — `public.climbs` and `public.projects` — each anchored to a Strapi route by `route_id text`. A server-only TypeScript module at `src/lib/private-state/` owns I/O, validates `route_id` against `@/lib/catalog` on every write, demands an authenticated user, and throws typed errors internally. A verification-only `/private-state-smoke` page (gated by middleware) round-trips create → read → delete for the signed-in user against a real Strapi route, and a different signed-in user cannot see the first user's data.

## Key Decisions Made

| Decision                         | Choice                                                                                                                                       | Why (1 sentence)                                                                                                                  | Source |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Scope breadth                    | Schema + RLS + typed read/write module + smoke surface (full pattern)                                                                        | Mirrors F-01; surfaces the foundation risk early instead of waiting for S-04.                                                     | Plan   |
| Schema shape                     | Two tables — `climbs` (many per user+route) and `projects` (unique on user+route)                                                            | One row shape per concept; trivial RLS; no joins for history or projects-list reads.                                              | Plan   |
| Verification surface             | Authenticated `/private-state-smoke` page round-tripping create / read / delete against a real Strapi route                                  | Same pattern as `/catalog-smoke/regions`; proves the cross-source identity contract end-to-end.                                   | Plan   |
| Route-id integrity               | Validate on write via `@/lib/catalog`; DB column is `route_id text NOT NULL` with no FK or CHECK                                             | Strapi is external (no FK possible); the 1 h catalog cache makes validation effectively free.                                    | Plan   |
| RLS policy shape                 | Per-operation policies (select / insert / update / delete) for the `authenticated` role, each `auth.uid() = user_id`; no `anon` grants       | Matches AGENTS.md "granular per-operation, per-role" mandate; `anon` denied by default once RLS is ON.                            | Plan   |
| Climb date column                | `climbed_on date NOT NULL` + `created_at timestamptz` for ordering tiebreaker                                                                | Matches the PRD wording "today's date but can be changed"; FR-010 ordering uses `(climbed_on desc, created_at desc)`.             | Plan   |
| Module layout                    | Single `src/lib/private-state/` with `client.ts`, `climbs.ts`, `projects.ts`, `types.ts`, `index.ts`, `__tests__/README.md`                  | Mirrors `src/lib/catalog/` exactly; one import surface for everything user-private; deep imports discouraged.                     | Plan   |
| Orphan handling                  | Tolerate — read helpers hydrate against `@/lib/catalog` and drop (default) or flag orphans; no DB cleanup, no reconciliation job             | Admin curates Strapi cautiously; full cleanup needs a webhook SendLog won't have in v1; UX of orphans deferred to S-04 / S-06.    | Plan   |

## Scope

**In scope:**

- Single migration `supabase/migrations/<YYYYMMDDHHmmss>_private_user_state.sql` creating `public.climbs`, `public.projects`, supporting indexes, RLS-on, and per-operation policies.
- New module `src/lib/private-state/` (`index.ts`, `types.ts`, `client.ts`, `climbs.ts`, `projects.ts`, `__tests__/README.md`) with typed errors, auth gate, route-id validation, and orphan-aware reads.
- New page `src/pages/private-state-smoke.astro` and `PROTECTED_ROUTES` update in `src/middleware.ts`.
- Polish-language inline diagnostics on the smoke page reusing `src/lib/config-status.ts`.

**Out of scope:**

- S-03 passwordless auth flow (the smoke page reuses the current email+password sign-in).
- S-04 climb-log / S-05 delete climb / S-06 projects UI; API route handlers under `src/pages/api/climbs/` and `src/pages/api/projects/`.
- FR-015 auto-removal of project on climb log (nice-to-have polish).
- User profile / display-name table; soft-delete or `removed_at` columns; `note` length cap.
- Strapi → Supabase webhook or any orphan-reconciliation job.
- A test runner; per-route catalog filters at the Strapi layer.

## Architecture / Approach

```
Astro page (server, Cloudflare Worker)
└── /private-state-smoke (protected by middleware)
     ├── Astro.locals.user  ──▶  createPrivateStateClient(headers, cookies, user)
     │                                        │
     │                                        ▼
     │                            @/lib/private-state
     │                            ├── client.ts  (authenticated Supabase wrapper)
     │                            ├── climbs.ts  (list / listByRoute / create / delete)
     │                            ├── projects.ts (list / isOnList / add / remove)
     │                            └── types.ts   (DTOs + PrivateStateError)
     │                                        │
     │                                        ▼
     │                            @/lib/catalog (route-id validation + hydration; cached)
     │                                        │
     │                                        ▼
     └── Render Polish summary  ◀──  Supabase (climbs / projects, RLS-scoped to auth.uid())
```

Hard rule: `@/lib/private-state` is server-only and never imported by React islands. Pages and (future) API routes are the boundary, exactly as `@/lib/catalog` is in F-01.

## Phases at a Glance

| Phase                                         | What it delivers                                                                                                                            | Key risk                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Supabase schema + RLS migration            | Single migration creating `climbs` + `projects` with indexes, RLS-on, and eight per-operation policies for `authenticated`.                  | RLS must be enabled before any later seed runs; missing the `with check` on insert/update would silently allow writes against other users. |
| 2. `src/lib/private-state/` typed I/O module  | Module mirroring `src/lib/catalog/`'s shape; typed errors; auth gate; route-id validation; orphan-aware reads.                              | The server-only invariant is easy to break with a stray React-island import — module header comment is the defense. |
| 3. Smoke verification surface                 | Authenticated `/private-state-smoke` page round-tripping create / read / delete against a real Strapi route; Polish inline diagnostics.     | The page must never leak Supabase or Strapi secrets in rendered HTML; cleanup link must be RLS-scoped, not admin-scoped. |

**Prerequisites:** F-01 (`catalog-content-contract`) is shipped and deployed; at least one published Strapi route exists; local Docker is available for `npx supabase start` / `db reset`; the operator can sign up two users via the existing email+password flow.

**Estimated effort:** About 2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- The 1 h catalog cache makes validate-on-write effectively free; if catalog traffic patterns later mean validation cold-misses repeatedly, the typed helper may need a smaller per-isolate route-id set cached in memory (out of scope here).
- Orphan tolerance is a *design* choice, not a deficiency: F-02 documents it explicitly so S-04 / S-06 know they can choose between dropping and flagging orphans without further schema work.
- `auth.users.id` is the only user identity F-02 leans on; if a `user_profiles` table later becomes necessary (display name, locale preference), it joins on `user_id` without changing `climbs` / `projects`.
- `npx supabase db reset` is the documented local-verification path; production deploys must run `npx supabase db push` against the linked project — out of scope to script here.
- The smoke page reuses the existing email+password auth surface; S-03's passwordless swap should not require any change to this plan's contract.

## Success Criteria (Summary)

- A signed-in user opens `/private-state-smoke` and sees one climb and one project created, read back hydrated against the catalog, and deletable via the cleanup link — fully Polish, all in one round-trip.
- A second signed-in user on the same Supabase project sees only their own rows on the smoke page; user A's row counts in Studio are unchanged.
- The migration applies cleanly to a fresh local Supabase, both tables have RLS = ON, and eight per-operation policies appear in Studio with `auth.uid() = user_id` expressions.
- `@/lib/private-state` exposes a typed surface that demands an authenticated user, validates `route_id` against `@/lib/catalog`, and surfaces typed errors S-04 / S-06 can translate into the API-route `{ error: { code, message, context } }` shape without changing the contract.

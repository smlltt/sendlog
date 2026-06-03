---
project: SendLog
version: 1
status: draft
created: 2026-05-26
updated: 2026-06-03
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: SendLog

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

SendLog is a Polish-first online catalog for local climbing crags, starting with a small climbing area and a small known beta group. The public catalog is the headline: regions, crags, routes, and map navigation stay browsable without an account. Personal climb logging and projects sit on top of that catalog as private, authenticated state tied to canonical routes.

## North star

**S-04: Climber can log a climb from a route and see it in history** - Here, "north star" means the smallest end-to-end slice whose successful delivery proves the product works: a signed-in beta climber finds a real route, records a dated note, saves it, and sees confirmation plus history without leaving the route flow.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | catalog-content-contract | (foundation) catalog content and canonical route identity are ready for public browsing and private references | - | Business Logic, Access Control, FR-001, FR-003, FR-016, FR-018 | done |
| F-02 | private-user-state-contract | (foundation) authenticated climber state is private per user and can reference canonical routes | F-01 | Access Control, NFR privacy, FR-006, FR-009, FR-012 | proposed |
| F-03 | core-flow-verification-guardrails | (foundation) mobile, Polish-language, progress, and response-time guardrails are checkable for beta flows | - | NFR mobile, NFR Polish UI, NFR progress, NFR response time | done |
| S-07 | admin-catalog-curation | admin can create, edit, and delete regions, crags, and routes | F-01 | FR-016, FR-017, FR-018 | done |
| S-01 | public-catalog-browse | visitor can browse regions, open a crag, and view its routes | F-01, S-07 | FR-001, FR-002, FR-003 | done |
| S-02 | crag-map-navigation | visitor can use map pins to reach a crag's route list | S-01 | FR-004, FR-005 | done |
| S-03 | passwordless-auth-flow | visitor can request a sign-in link, become signed in, and sign out | F-02 | FR-006, FR-007, FR-008 | done |
| S-04 | route-climb-log | signed-in climber can log a route with date and note, then see it in personal history | F-01, F-02, F-03, S-01, S-03 | US-01, FR-009, FR-010 | done |
| S-05 | delete-climb-log | signed-in climber can delete one of their own logged climbs | S-04 | US-01, FR-011 | done |
| S-06 | personal-projects-list | signed-in climber can add, view, and remove routes from their projects list | S-01, S-03 | FR-012, FR-013, FR-014 | proposed |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Catalog content and browse | `F-01` -> `S-07` -> `S-01` -> `S-02` | Admin curation precedes public browsing because the catalog has nothing to show until content is loaded. |
| B | Account and private state | `F-02` -> `S-03` -> `S-04` -> `S-05` / `S-06` | Joins Stream A through `F-01` and `S-01`; protects the fast path to the logged-climb flow. |
| C | Beta verification | `F-03` | Standalone guardrail foundation used by `S-04` before beta release. |

## Baseline

What's already in place in the codebase as of `2026-05-26` (auto-researched + user-confirmed). Foundations below assume these are present and do not re-scaffold them.

- **Frontend:** present - Astro SSR, React islands, Tailwind, shadcn/ui config, and file-based pages are in place; product pages are still starter-level.
- **Backend / API:** partial - server output and auth routes exist under `src/pages/api/auth/`; product API routes for catalog, climbs, projects, and admin workflows are absent.
- **Data:** partial - Supabase server client and a Strapi admin sidecar exist; Supabase migrations and catalog/content models are absent.
- **Auth:** partial - Supabase auth, cookies, auth routes, and route middleware exist; current sign-in is email+password while the PRD calls for passwordless sign-in links.
- **Deploy / infra:** partial - Cloudflare Worker config, CI deploy job, and deployment plan exist; Cloudflare/GitHub secret follow-ups and auto-deploy verification remain pending.
- **Observability:** partial - Cloudflare Worker observability is enabled; app-level logging, error tracking, analytics, metrics, and performance instrumentation are absent.

## Foundations

### F-01: Catalog content contract

- **Outcome:** (foundation) catalog content and canonical route identity are ready for public browsing and private references.
- **Change ID:** catalog-content-contract
- **PRD refs:** Business Logic, Access Control, FR-001, FR-003, FR-016, FR-018
- **Unlocks:** S-01, S-04, S-06, S-07; resolves the cross-slice need for one canonical route identity.
- **Prerequisites:** -
- **Parallel with:** F-03
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Sequenced first because route identity is shared by the catalog, climb log, projects, and admin curation; changing it later would ripple through every slice.
- **Status:** done

### F-02: Private user state contract

- **Outcome:** (foundation) authenticated climber state is private per user and can reference canonical routes.
- **Change ID:** private-user-state-contract
- **PRD refs:** Access Control, NFR privacy, FR-006, FR-009, FR-012
- **Unlocks:** S-03, S-04, S-05, S-06; creates the privacy boundary for climb logs and projects.
- **Prerequisites:** F-01
- **Parallel with:** S-07
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Kept before auth-dependent slices because privacy is a guardrail, not polish; the main risk is discovering too late that personal state cannot cleanly attach to catalog routes.
- **Status:** proposed

### F-03: Core-flow verification guardrails

- **Outcome:** (foundation) mobile, Polish-language, progress, and response-time guardrails are checkable for beta flows.
- **Change ID:** core-flow-verification-guardrails
- **PRD refs:** NFR mobile, NFR Polish UI, NFR progress, NFR response time
- **Unlocks:** S-04 verification path for the primary success criterion.
- **Prerequisites:** -
- **Parallel with:** F-01, F-02, S-01
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Kept lightweight for speed, but placed before the climb-log beta path so the primary flow is not judged only by "it works on my machine."
- **Status:** done

## Slices

### S-07: Admin catalog curation

- **Outcome:** admin can create, edit, and delete regions, crags, and routes.
- **Change ID:** admin-catalog-curation
- **PRD refs:** FR-016, FR-017, FR-018
- **Prerequisites:** F-01
- **Parallel with:** F-02, S-03
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Sequenced before public browsing because the catalog has nothing useful to show - and no canonical content for private state to reference - until the admin can load and maintain initial region, crag, and route data.
- **Status:** done
- **Subsumed by:** F-01 delivered the Strapi schema and live admin (`context/archive/2026-05-26-catalog-content-contract/`); `catalog-crag-photos-multi` tightened the crag photo contract. No standalone change folder. Initial Sokoliki content is loaded manually by the project owner via the Strapi admin UI.

### S-01: Public catalog browse

- **Outcome:** visitor can browse regions, open a crag, and view its routes.
- **Change ID:** public-catalog-browse
- **PRD refs:** FR-001, FR-002, FR-003
- **Prerequisites:** F-01, S-07
- **Parallel with:** F-02, F-03
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This is the earliest user-visible catalog path and the base for the logged-climb flow; if it drifts from the source topo, later personal features inherit bad data.
- **Status:** done

### S-02: Crag map navigation

- **Outcome:** visitor can use map pins to reach a crag's route list.
- **Change ID:** crag-map-navigation
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** -
- **Unknowns:**
  - Should the interactive map fallback be triggered for v1 if integration becomes a time sink? - Owner: user. Block: no.
- **Risk:** Placed after list browsing so geographic navigation can fall back without blocking the core catalog path.
- **Status:** done

### S-03: Passwordless auth flow

- **Outcome:** visitor can request a sign-in link, become signed in, and sign out.
- **Change ID:** passwordless-auth-flow
- **PRD refs:** FR-006, FR-007, FR-008
- **Prerequisites:** F-02
- **Parallel with:** S-02, S-07
- **Blockers:** -

- **Unknowns:** -
- **Risk:** Current auth scaffold uses a different sign-in shape than the PRD; aligning it before private features prevents reworking the primary beta path.
- **Status:** done

### S-04: Route climb log

- **Outcome:** signed-in climber can log a route with date and note, then see it in personal history.
- **Change ID:** route-climb-log
- **PRD refs:** US-01, FR-009, FR-010
- **Prerequisites:** F-01, F-02, F-03, S-01, S-03
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This is the north star flow - the smallest end-to-end slice that proves the catalog plus private log is useful - so it lands as soon as catalog, auth, and verification guardrails allow.
- **Status:** done

### S-05: Delete climb log

- **Outcome:** signed-in climber can delete one of their own logged climbs.
- **Change ID:** delete-climb-log
- **PRD refs:** US-01, FR-011
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Sequenced after logging because delete-only correction is useful only once the log exists; keeping edit out avoids expanding the v1 form surface.
- **Status:** done

### S-06: Personal projects list

- **Outcome:** signed-in climber can add, view, and remove routes from their projects list.
- **Change ID:** personal-projects-list
- **PRD refs:** FR-012, FR-013, FR-014
- **Prerequisites:** S-01, S-03
- **Parallel with:** S-05
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Projects are a secondary success signal, so they come after the logged-climb path is viable but can still run alongside delete-log polish.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | catalog-content-contract | Define catalog content and route identity contract | yes | Run `/10x-plan catalog-content-contract` |
| F-02 | private-user-state-contract | Define private climber state contract | no | Wait for F-01 |
| F-03 | core-flow-verification-guardrails | Add beta flow verification guardrails | yes | Can run alongside F-01 |
| S-07 | admin-catalog-curation | Ship admin catalog curation | n/a | Subsumed by F-01 + `catalog-crag-photos-multi`; no standalone plan |
| S-01 | public-catalog-browse | Ship public catalog browsing | yes | Run `/10x-plan public-catalog-browse` — F-01 and S-07 are both done |
| S-02 | crag-map-navigation | Ship crag map navigation | no | Wait for S-01 |
| S-03 | passwordless-auth-flow | Ship passwordless sign-in and sign-out | no | Wait for F-02 |
| S-04 | route-climb-log | Ship route climb logging and history | no | Wait for F-01, F-02, F-03, S-01, and S-03 |
| S-05 | delete-climb-log | Ship delete-only climb log correction | no | Wait for S-04 |
| S-06 | personal-projects-list | Ship personal projects list | no | Wait for S-01 and S-03 |

## Open Roadmap Questions

No open roadmap questions. The only sequencing-relevant uncertainty is tracked inside S-02 as a non-blocking map fallback question.

## Parked

- **User-submitted routes or crags** - Why parked: PRD Non-Goals keeps v1 admin-curated to avoid moderation burden and bad data.
- **Social features** - Why parked: PRD Non-Goals keeps v1 as catalog plus private log, not a network.
- **Public comments on routes** - Why parked: PRD Non-Goals excludes cross-user discussion in v1.
- **Favorites list** - Why parked: PRD Non-Goals says climbed routes plus projects cover v1 needs.
- **Personal grade override** - Why parked: PRD Non-Goals keeps climbers logging against catalog grades only.
- **Advanced search and filters** - Why parked: PRD Non-Goals limits v1 to visual browsing through map and lists.
- **Photo uploads on climb notes** - Why parked: PRD Non-Goals keeps climb notes text-only.
- **External climbing database integrations** - Why parked: PRD Non-Goals excludes sync with external climbing databases.
- **Climbing stats and analytics** - Why parked: PRD Non-Goals excludes totals, progression charts, and dashboards.
- **More than one Polish region at launch** - Why parked: PRD Non-Goals says v1 ships a small climbing area's content only.
- **Offline mode or installable app** - Why parked: PRD Non-Goals keeps v1 browser-only with connectivity required.
- **Native mobile apps** - Why parked: PRD Non-Goals keeps v1 as responsive web only.
- **Formal WCAG-AA certification** - Why parked: PRD Non-Goals keeps accessibility best-effort for v1.
- **Auto-remove project when route is logged** - Why parked: FR-015 is nice-to-have polish, not part of the required launch scope.

## Done

- **F-01: (foundation) catalog content and canonical route identity are ready for public browsing and private references** — Archived 2026-05-27 → `context/archive/2026-05-26-catalog-content-contract/`. Lesson: —.
- **S-07: admin can create, edit, and delete regions, crags, and routes** — Subsumed by F-01 (`context/archive/2026-05-26-catalog-content-contract/`) and the `catalog-crag-photos-multi` follow-up. Strapi Cloud admin (live at `https://light-talent-409ec7d381.strapiapp.com/admin/`) already provides FR-016/017/018 via native CRUD on the region/crag/route collection types; the project owner curates Sokoliki content manually. No standalone change folder. Lesson: —.
- **S-01: visitor can browse regions, open a crag, and view its routes** — Archived 2026-05-31 → `context/archive/2026-05-29-public-catalog-browse/`. Lesson: —.
- **S-02: visitor can use map pins to reach a crag's route list** — Archived 2026-05-31 → `context/archive/2026-05-31-crag-map-navigation/`. Lesson: —.
- **S-03: visitor can request a sign-in link, become signed in, and sign out** — Archived 2026-06-01 → `context/archive/2026-06-01-passwordless-auth-flow/`. Lesson: —.
- **F-03: (foundation) mobile, Polish-language, progress, and response-time guardrails are checkable for beta flows** — Archived 2026-06-02 → `context/archive/2026-06-01-core-flow-verification-guardrails/`. Lesson: —.
- **S-04: signed-in climber can log a route with date and note, then see it in personal history** — Archived 2026-06-03 → `context/archive/2026-06-01-route-climb-log/`. Lesson: —.
- **S-05: signed-in climber can delete one of their own logged climbs** — Archived 2026-06-03 → `context/archive/2026-06-03-delete-climb-log/`. Lesson: —.

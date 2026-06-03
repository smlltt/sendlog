# Personal Projects List — Plan Brief

> Full plan: `context/changes/personal-projects-list/plan.md`
> Research: `context/changes/personal-projects-list/research.md`

## What & Why

Ship S-06 so a signed-in climber can **add** a route to their personal projects list from the crag table (FR-012) and **view** all projects on `/projekty` (FR-013). Projects are the PRD's secondary success signal — at least 2 of ~5 beta users should add a project in week one.

**Remove** (FR-014) is intentionally deferred to a follow-up change mirroring `delete-climb-log`, keeping this slice aligned with how `route-climb-log` shipped add+view before delete existed.

## Starting Point

F-02 already delivered `public.projects`, RLS, and `@/lib/private-state` helpers (`listProjects`, `addProject`, `isRouteOnProjects`). S-04 shipped the UI/API patterns to mirror (`/api/climbs`, `RouteClimbAction`, `/historia`). Verification harness already scopes `/projekty` as `planned: S-06`.

## Desired End State

Signed-in climbers add routes inline on the crag page, see a **"W projektach"** badge on those rows, and open `/projekty` for a newest-first list with route name, grade/type, and crag back-links. Dashboard and header nav expose `/projekty`. Guardrails and beta checklist mark S-06 as shipped.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Slice scope | Add + view only (FR-012, FR-013) | Mirrors `route-climb-log`; remove ships later like `delete-climb-log` | Plan |
| Route-row UI | Separate `ProjectAction` island stacked in climb action cell | Modular, minimal change to shipped `RouteClimbAction` | Plan |
| On-projects state | Static **"W projektach"** badge | Honest until remove slice exists; no fake disabled remove | Plan |
| API shape | `POST /api/projects` only | Add-only slice; DELETE deferred | Plan |
| Discoverability | Dashboard CTA + `CatalogHeader` nav | Supports secondary PRD metric | Plan |
| List row content | Name + grade/type + crag link (no date) | Mirrors history rows; `createdAt` adds little for want-to-climb | Plan |
| FR-015 auto-remove on log | Out of scope | Nice-to-have, roadmap parked | Research / PRD |

## Scope

**In scope:**

- `POST /api/projects`, `ProjectAction` island, crag-page `listProjects` membership
- Protected `/projekty` + `ProjectsList.astro` (view-only)
- `/projekty` in `PROTECTED_ROUTES`, dashboard + header links, `projects.*` i18n
- Flip S-06 guardrail/checklist placeholders to shipped/current

**Out of scope:**

- Remove from projects (FR-014) — future `remove-personal-project`-style slice
- FR-015 auto-remove when logging a climb
- New migrations, stats, search, list reorder

## Architecture / Approach

```
Crag page (public) ──signed-in──► Promise.all(listClimbs, listProjects)
                                        │
                                        ▼
                              RoutesTable: RouteClimbAction + ProjectAction
                                        │
                         POST /api/projects ──► addProject (RLS)
                                        │
/projekty (protected) ──► listProjects ──► ProjectsList.astro
```

Server-only `@/lib/private-state`; islands POST JSON and receive booleans/DTOs as props.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Projects-State Preflight | Verify add/list/membership helpers | Assuming F-02 behavior without smoke |
| 2. Add API + Route-Page State | API, island, crag wiring, i18n | Mobile layout with two islands per row |
| 3. Projects List + Nav | `/projekty`, dashboard/header links | Broken crag links when slugs missing |
| 4. Guardrails + Beta | Flip `planned: S-06`, checklist run | Stale planned rows block CI guardrails |

**Prerequisites:** S-01 (catalog browse), S-03 (auth), F-02 private-state helpers live  
**Estimated effort:** ~2–3 focused sessions across 4 phases

## Open Risks & Assumptions

- Two islands per route row must not cause horizontal scroll on 375px viewports.
- Accidental adds cannot be undone until the remove slice ships — acceptable per scope split.
- F-02 roadmap status still says `proposed` but code is live (research confirmed).

## Success Criteria (Summary)

- Signed-in user adds a route from the crag table and sees **"W projektach"** without leaving the page.
- `/projekty` lists their projects with correct catalog context and crag links.
- `npm run guardrails`, lint, and build pass; S-06 verification rows are current.

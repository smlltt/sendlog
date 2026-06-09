# Personal Projects List (S-06) — Plan Brief

> Full plan: `context/changes/personal-projects-list/plan.md`
> Research: `context/changes/personal-projects-list/research.md`

## What & Why

Ship S-06 in full so a signed-in climber can **add**, **view**, and **remove** routes on a personal projects list (FR-012, FR-013, FR-014). Projects are the PRD's secondary success signal — at least 2 of ~5 beta users should add a project in week one. The data/privacy layer already exists from F-02, so this is the API + UI + nav + verification layer on top.

## Starting Point

F-02 delivered `public.projects` (RLS + unique constraint + index) and the `listProjects` / `isRouteOnProjects` / `addProject` / `removeProject` helpers. Since the prior (now-deleted) plan was written, S-05 `delete-climb-log` shipped a complete remove pattern — `DELETE /api/climbs` plus a two-step-confirm list island — making FR-014 cheap to include. The verification harness already pre-registers `/projekty` as `planned: S-06`.

## Desired End State

On a crag page, a signed-in climber sees a projects toggle stacked in the existing climb action cell: "Dodaj do projektów" when off-list, a "W projektach" state with inline two-step remove when on-list. `/projekty` (protected) lists projects newest-first with route name, grade, type, an "added on" date, and a crag back-link, each removable via the same two-step confirm. `/projekty` is reachable from the dashboard CTA and the header nav. Guardrails/lint/build pass and the S-06 verification rows are flipped from `planned`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Slice scope | Add + view + remove (FR-012/013/014) | `removeProject` + the S-05 DELETE/island pattern now exist, so the full roadmap outcome closes in one slice | Plan |
| Crag-row affordance | Full toggle (add off-list / two-step remove on-list) | Symmetric UX, no dead "already added" state; crag page can supply the project id | Plan |
| Remove confirmation | Two-step inline confirm (mirror /historia) | Consistent with shipped S-05; prevents accidental removal | Plan |
| Crag-row layout | Stack in existing "Twoje przejścia" cell | No new column → protects the 375px no-horizontal-scroll constraint | Plan |
| /projekty row content | Name + grade + type + crag link + "added on" date | Mirrors history rows; date shows how long a project has sat | Plan |
| Discoverability | Dashboard CTA + header nav link | Maximizes the PRD secondary metric; mirrors /historia | Plan |
| API verb shape | `POST {routeId}` + `DELETE {id}` on `/api/projects` | Exact mirror of `/api/climbs`; `STATUS_FOR_CODE` already covers the codes | Plan |
| Remove identity | DELETE by project row id | Matches `removeProject(client, id)`; crag page threads a routeId→projectId map | Research / Plan |
| FR-015 auto-remove on log | Out of scope | Roadmap-parked; spans climbs + projects | Research / PRD |

## Scope

**In scope:**

- `POST`/`DELETE /api/projects` + `src/components/projects/` module (types, index, `__tests__/`)
- Crag-row `ProjectAction` toggle, crag-page `listProjects` membership map, `RoutesTable` wiring
- Protected `/projekty` page + list/remove island, `/projekty` in `PROTECTED_ROUTES`
- Dashboard CTA + `CatalogHeader` link, `projects.*` / `errors.projects.*` i18n
- Flip `planned: S-06` rows in the progress registry + beta checklist

**Out of scope:**

- FR-015 auto-remove when logging a climb
- New migrations, project editing, stats, search, manual reordering, second locale

## Architecture / Approach

```
Crag page (public) ──signed-in──► Promise.all(listClimbs, listProjects)
                                        │  builds routeId→projectId map
                                        ▼
                       RoutesTable cell: RouteClimbAction + ProjectAction
                                        │
                  POST {routeId} / DELETE {id}  ──► /api/projects ──► add/removeProject (RLS)
                                        │
/projekty (protected) ──► listProjects ──► ProjectsList island (two-step remove)
```

Server-only `@/lib/private-state`; islands receive primitive props and call the JSON API only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API + module | `/api/projects` POST/DELETE, client-safe DTOs, error i18n | Drifting from the `/api/climbs` error-map contract |
| 2. Crag-row toggle | `ProjectAction` island + membership map + table wiring | Two controls per cell causing 375px horizontal scroll |
| 3. /projekty + nav | Protected page, remove island, dashboard/header links | Broken crag links when route slugs missing |
| 4. Guardrails + beta | Flip `planned: S-06`, run guardrails + checklist | Stale `planned: S-06` rows blocking CI guardrails |

**Prerequisites:** S-01 (catalog browse), S-03 (auth), and F-02 private-state helpers — all live.
**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- Two stacked controls per crag row must not cause horizontal scroll on 375px viewports.
- Membership must be threaded as a `routeId→projectId` map (not a boolean) so the toggle can remove by id without an extra round-trip.
- F-02's roadmap status still reads `proposed`, but the code/migration are live (research-confirmed).

## Success Criteria (Summary)

- A signed-in user adds and removes a route's project status from the crag table without leaving the page.
- `/projekty` lists their projects with correct catalog context and crag links, and supports two-step removal.
- `npm run guardrails`, lint, and build pass; no `planned: S-06` placeholders remain.

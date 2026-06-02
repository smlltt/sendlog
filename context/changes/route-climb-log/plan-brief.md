# Route Climb Log — Plan Brief

> Full plan: `context/changes/route-climb-log/plan.md`

## What & Why

Build the S-04 north-star flow: a signed-in climber can log a route from the existing crag route page, save a date plus optional note, see confirmation in place, and review the climb in personal history. This proves SendLog's core product loop: public catalog plus private, per-user climb memory tied to canonical routes.

## Starting Point

The catalog route view already exists at `/regiony/[region]/[crag]`, with routes rendered in `RoutesTable.astro`. Private state also exists: Supabase `climbs` stores per-user `route_id`, `climbed_on`, and optional `note`, and `@/lib/private-state` exposes the server-only helpers S-04 needs.

## Desired End State

Signed-out visitors keep browsing the public catalog and see a page-level prompt to sign in to track routes. Signed-in users log climbs inline from a route row, get a count/latest-date indicator, and can open `/historia` to see all logged climbs newest-first with route/crag context and a link back to the crag.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Signed-out UX | Page-level CTA | Keeps the route table clean while explaining "log in to track your routes." |
| Form placement | Inline expandable route-row form | Meets the PRD requirement that logging does not require leaving the route view. |
| Post-save behavior | Stay on route page with inline success and indicator | Confirms the save immediately and preserves crag context. |
| Repeat ascents | Allow multiple logs, show count/latest date | Matches the existing schema and real climbing behavior. |
| History surface | New protected `/historia` plus dashboard link | Gives FR-010 a stable page and keeps dashboard lightweight. |
| History row content | Route, crag, grade, date, optional note, crag link | Provides enough context without pulling S-05 delete into S-04. |
| Foundation readiness | Add private-state preflight phase | Reduces risk before building the north-star UI on F-02. |

## Scope

**In scope:**

- Private-state preflight for the helper behavior S-04 depends on.
- UTC `formatDate()` helper for climb dates.
- Authenticated climb-save API with structured JSON errors.
- Inline signed-in route-row form and saved/count/latest-date indicator.
- Page-level signed-out CTA on crag route pages.
- Protected `/historia` history page and dashboard link.
- Guardrail/checklist updates for S-04.

**Out of scope:**

- Delete or edit climb logs.
- Projects and auto-removing projects after a climb.
- Stats, charts, public profiles, or social features.
- Per-route detail pages or search/filter work.

## Architecture / Approach

The crag page remains public and server-rendered. When a user is signed in, the page reads that user's climbs server-side through `@/lib/private-state`, groups them by `routeId`, and passes small summaries into route-row React islands. Saves go through a new authenticated JSON API route; client components never import private-state helpers.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Private-State Preflight | Verifies F-02 helper behavior before UI work | Foundation gaps could block S-04. |
| 2. Save API + Route-Page State | Inline save form, API route, route indicators, signed-out CTA | Mobile route-row layout and server/client boundary. |
| 3. Personal History + Dashboard Entry | Protected `/historia` and dashboard link | Keeping history useful without pulling delete/stats into scope. |
| 4. Guardrails + Beta Verification | S-04 rows in guardrails/checklist and completed manual run | Manual verification must be kept current. |

**Prerequisites:** F-01, F-02, F-03, S-01, and S-03 are available; Phase 1 verifies the remaining private-state confidence gaps.
**Estimated effort:** ~3-4 focused implementation sessions across 4 phases.

## Open Risks & Assumptions

- The route-row action must preserve the existing mobile no-horizontal-scroll layout.
- The repo currently lacks `formatDate()`, so S-04 adds it before date defaults/display.
- F-02 has a few unchecked manual items; Phase 1 may surface a private-state blocker before visible UI begins.

## Success Criteria (Summary)

- A signed-in beta user logs a route with date and optional note in under 30 seconds and sees confirmation plus a route indicator.
- `/historia` shows only that user's climbs, newest-first, with route/crag context and crag links.
- `npm run guardrails`, `npm run lint`, `npm run build`, and the beta-flow checklist pass for the new S-04 paths.

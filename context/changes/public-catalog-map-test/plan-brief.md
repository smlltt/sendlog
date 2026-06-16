# Public Catalog Map Test — Plan Brief

> Full plan: `context/changes/public-catalog-map-test/plan.md`

## What & Why

Add Phase 3 of the e2e rollout: Playwright coverage for anonymous public catalog browsing, route-list fidelity, and homepage map pin navigation. This protects the foundation test plan's public risks: map pins/navigation breaking and Strapi catalog fields silently disappearing or rendering incorrectly.

## Starting Point

The Playwright harness already exists and current e2e tests use accessible locators, state-based waits, and seeded fixture constants. The public catalog is mostly SSR, but the homepage map is a `client:only="react"` Leaflet island whose marker DOM is not currently exposed through a stable accessible locator.

## Desired End State

A developer can run a focused `public-catalog-map.spec.ts` against the existing seeded Strapi fixture and prove anonymous visitors can browse homepage -> region -> crag, see the expected seeded route fields, and use the interactive map marker popup to reach the crag route list. The canonical test-plan cookbook explains the pattern for future public catalog/map specs.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Route oracle | Explicit fixture constants for name, grade, type, and year | Catches field-drop regressions without comparing rendered output to the app's own Strapi client path. |
| Map interaction | Add a small stable marker accessibility/test hook | Tests the real marker -> popup -> route-list path while avoiding brittle Leaflet internals. |
| Fixture prerequisite | Document the existing seeded Strapi fixture | Lowest scope and matches the current e2e setup; no seed-script expansion in this slice. |
| Anonymous scope | Homepage, region page, and fixture crag route table | Covers both public browse risk and route-list fidelity risk. |
| External tiles | Do not assert OSM tiles | Avoids external-network flake; the test asserts app-owned map state and navigation. |
| Error state | Out of scope | Keeps Phase 3 focused on selected risks #5/#6. |
| Documentation | Update `context/foundation/test-plan.md` §6.4 | Keeps the canonical rollout guide current without adding extra doc surfaces. |

## Scope

**In scope:**

- Add seeded route field constants in `tests/e2e/constants.ts`.
- Add a narrow stable marker hook in `src/components/catalog/CragMap.tsx`.
- Add `tests/e2e/public-catalog-map.spec.ts`.
- Update `context/foundation/test-plan.md` §6.4 with the public catalog/map e2e cookbook.

**Out of scope:**

- Auth/private climber flows, Supabase migrations, Strapi seed scripts, CI e2e wiring, visual snapshots, OSM tile assertions, catalog error-state automation, Mapy.com deep links, search/filter, or tile-provider changes.

## Architecture / Approach

The plan keeps the test at the cheapest useful layer: Playwright exercises the real public pages and real Leaflet popup navigation, while the expected route fields live in independent fixture constants. The only production-code change is a tiny marker hook so the test can interact with the map through a stable contract instead of Leaflet's internal DOM.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fixture Oracle + Map Testability Contract | Explicit route field constants and stable marker hook | Fixture values may not match current Strapi seed; hook must not couple to Leaflet internals. |
| 2. Public Catalog + Map E2E Specs | Anonymous browse, route fidelity, and marker-popup navigation tests | Client-only map hydration and clustering can make interaction timing flaky if not state-waited. |
| 3. Cookbook Documentation | Filled `test-plan.md` §6.4 public catalog/map pattern | Docs must reflect the actual spec and hook after implementation. |

**Prerequisites:** Existing local e2e prerequisites plus a seeded Strapi catalog containing `FIXTURE_CRAG_PATH` and `FIXTURE_ROUTE_NAME`.

**Estimated effort:** ~1-2 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Assumes the current seeded Strapi fixture has stable grade/type/year values that can be encoded as constants.
- Assumes a small marker hook is acceptable in production code because it also improves accessibility/testability.
- The test intentionally does not prove OSM tile rendering; that remains manual/residual risk.

## Success Criteria (Summary)

- The targeted public catalog/map spec passes locally and fails clearly if route fields or map popup navigation regress.
- Full `npm run test:e2e`, `npm run lint`, and `npm run build` pass with local prerequisites.
- `context/foundation/test-plan.md` §6.4 teaches future contributors the same fixture, locator, hydration, and tile-avoidance rules.

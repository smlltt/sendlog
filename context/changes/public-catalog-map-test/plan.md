# Public Catalog Map Test Implementation Plan

## Overview

Add Phase 3 of the project's phased test rollout: local-first Playwright coverage proving anonymous public catalog browsing, fixture route-list fidelity, and homepage map pin navigation. The tests protect `context/foundation/test-plan.md` risks #5 and #6 without expanding into private auth flows, visual snapshots, or external tile-provider checks.

## Current State Analysis

The e2e harness already exists and is local-first. `playwright.config.ts:5-27` points Chromium tests at `tests/e2e`, uses `http://127.0.0.1:3000`, starts `npm run dev -- --host 127.0.0.1 --port 3000`, and runs with `workers: 1`. `package.json:16-18` exposes `npm run test:e2e`, `npm run test:e2e:install`, and `npm run test:e2e:ui`.

The current e2e conventions prefer user-facing locators and state-based waits. `tests/e2e/AGENTS.md:3-10` names `seed.spec.ts` as the exemplar, requires `getByRole` / `getByLabel` / `getByText` as primary locators, forbids CSS/XPath/fixed sleeps, and asks tests to name the risk they protect. `tests/e2e/seed.spec.ts:45-51` demonstrates the retry pattern for hydrated client islands.

The public catalog flow is anonymous and server-rendered except for the map island. `/` renders the SendLog hero plus `CragMapSection` (`src/pages/index.astro:9-27`). `CragMapSection` reads crags and regions server-side, maps them to pins, then renders `CragMap client:only="react"` with an SSR fallback list (`src/components/catalog/CragMapSection.astro:22-46`). Region pages link crags (`src/pages/regiony/[region]/index.astro:31-49`), and crag pages render coordinates, an anonymous sign-in CTA, and the route table (`src/pages/regiony/[region]/[crag].astro:113-146`).

The current fixture constants are sufficient for path/name coverage but not full field fidelity. `tests/e2e/constants.ts:11-15` defines `FIXTURE_CRAG_PATH = "/regiony/rzedkowice/mala-gran"` and `FIXTURE_ROUTE_NAME = "test route"`. It does not yet encode the expected seeded route grade, type, or year display.

## Desired End State

A developer with the existing local prerequisites can run a targeted Phase 3 spec and prove:

1. An anonymous visitor can browse from the homepage map section through the public region/crag catalog path without being redirected to sign-in.
2. The seeded crag route table renders the expected route name, grade, type, and year/missing-year display from explicit fixture constants.
3. The interactive Leaflet map exposes a stable marker interaction contract, and clicking the seeded marker opens a popup with `Otwórz trasy`; clicking the popup link lands on `FIXTURE_CRAG_PATH`.
4. The test does not assert OSM tile images, geometry, screenshots, or external network behavior.
5. `context/foundation/test-plan.md` §6.4 documents how future public catalog/map e2e tests should be written.

### Key Discoveries:

- `src/lib/catalog/strapi.client.ts:128-145` builds published Polish Strapi reads with `name:asc` sorting and a `pageSize` of 1000.
- `src/lib/catalog/strapi.client.ts:224-239` lists crags with photos/region and routes with `crag.region`; the app-facing route fields are mapped at `src/lib/catalog/strapi.client.ts:190-202`.
- `src/lib/catalog/map.ts:42-78` filters invalid crags and builds pin `href` values as `/regiony/${regionSlug}/${crag.slug}`.
- `src/components/catalog/CragMap.tsx:51-64` creates Leaflet markers imperatively through `leaflet.markercluster`; markers currently have the `crag-pin` class but no stable accessible marker name.
- `src/components/catalog/RoutesTable.astro:86-103` renders route rows with name, grade, type, and `yearSet ?? t("catalog.routes.year_missing")`.
- `context/foundation/test-plan.md:46-58` identifies the public map and catalog fidelity risks and warns against meaningless snapshots or tests that assert against production logic.

## What We're NOT Doing

- No auth, magic-link, climb history, projects, or user-isolation coverage; those belong to prior rollout phases.
- No Strapi seed script or Strapi admin automation. This plan assumes the existing seeded fixture and documents its expected field values.
- No OSM tile assertions, visual snapshots, screenshot comparisons, or AI visual review.
- No public catalog error-state e2e for missing Strapi config or upstream outage.
- No CI wiring for e2e. The suite remains local-first per the foundation test plan.
- No region-scoped map, geolocation, search/filter, Mapy.com deep links, route lines, or tile-provider migration.
- No broad accessibility audit. The marker contract is a narrow testability/accessibility improvement for this map path.

## Implementation Approach

Use the existing e2e harness and seeded catalog fixture. First strengthen the independent oracle by adding route field constants beside the current fixture path/name, and expose the seeded map marker through a stable user-facing hook in the Leaflet marker options. Then add one focused public catalog/map spec that protects risks #5 and #6 with accessible locators and state-based waits. Finally, replace the Phase 3 cookbook placeholder in the foundation test plan.

## Critical Implementation Details

### Map Marker Testability

The map markers are created through Leaflet's imperative API, not JSX, so the hook belongs in `L.marker` options rather than around a React element. Add the smallest stable contract that lets Playwright find the seeded crag marker by accessible name or an explicitly documented test id; do not rely on `.crag-pin`, Leaflet pane structure, cluster internals, or tile DOM.

### Fixture Oracle Independence

Route fidelity must compare rendered text to constants in `tests/e2e/constants.ts`, not to values fetched through the app's Strapi client during the test. This keeps the e2e assertion independent from the production transformation path it is meant to protect.

## Phase 1: Fixture Oracle + Map Testability Contract

### Overview

Add the explicit expected route field constants for the seeded crag and expose the seeded Leaflet marker through a stable interaction contract. This phase makes the later spec possible without relying on app internals or brittle selectors.

### Changes Required:

#### 1. Seeded route field constants

**File**: `tests/e2e/constants.ts`

**Intent**: Extend the existing fixture oracle from path/name-only to the full route fields Phase 3 must protect.

**Contract**: Keep `FIXTURE_CRAG_PATH` and `FIXTURE_ROUTE_NAME`. Add constants for the seeded route's expected grade, type display, and year display. The values must be copied from the actual seeded Strapi fixture once, documented as the fixture contract, and used by the spec without fetching Strapi during the test.

#### 2. Leaflet marker accessibility/test hook

**File**: `src/components/catalog/CragMap.tsx`

**Intent**: Give Playwright a stable way to interact with the intended map marker while preserving the real marker -> popup -> route-list user path.

**Contract**: Add a stable marker option or DOM attribute derived from `pin.name` / `pin.href` that lets the test identify the seeded crag marker by a user-facing name or a documented test id. Preserve the existing `crag-pin` icon class, marker clustering behavior, popup HTML escaping, and `Otwórz trasy` popup link. Do not add assertions or hooks for OSM tile elements.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes after the constants and map hook changes.
- `npm run build` passes, proving the Leaflet import boundary remains valid for Cloudflare SSR.
- A targeted manual smoke of the map confirms the marker still opens the same popup and navigates to the crag route list.

#### Manual Verification:

- The new route field constants match the seeded Strapi fixture currently used by `FIXTURE_CRAG_PATH`.
- The marker hook is discoverable in browser devtools without depending on Leaflet pane/class structure.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the seeded fixture values and marker hook are correct before proceeding to the next phase.

---

## Phase 2: Public Catalog + Map E2E Specs

### Overview

Write the durable Phase 3 Playwright spec for anonymous public browsing, route-list fidelity, and map pin navigation. Keep it independent, local-first, and aligned with existing e2e rules.

### Changes Required:

#### 1. Public catalog/map spec

**File**: `tests/e2e/public-catalog-map.spec.ts` (new)

**Intent**: Protect risk #5 (public map pins/navigation) and risk #6 (catalog route-list fidelity) in one focused anonymous spec file.

**Contract**: Add risk-named tests covering:

- Homepage public browse: visit `/`, assert the SendLog heading, the `Zobacz skały na mapie` link, the `Skały` section heading, and the anonymous `Zaloguj się` header link.
- Region browse: visit or navigate to `/regiony/rzedkowice`, assert the region page renders and includes a link/card for the seeded crag.
- Crag route-list fidelity: visit `FIXTURE_CRAG_PATH`, assert no redirect to sign-in, assert the crag heading/coordinates/routes section, find the route row by `FIXTURE_ROUTE_NAME`, and assert the explicit expected grade/type/year display constants.
- Map pin navigation: from `/`, wait for the client-only map marker hook using `expect(async () => { ... }).toPass()` or web-first assertions, open the seeded marker, click `Otwórz trasy`, and assert the final URL/path is `FIXTURE_CRAG_PATH` with the fixture route row visible.

Use accessible locators wherever possible. The only allowed non-accessible hook is the marker contract added in Phase 1 and documented in the test-plan cookbook. Do not assert tile URLs, tile images, map geometry, marker coordinates, screenshots, or cluster internals.

#### 2. Optional fixture comment updates

**File**: `tests/e2e/constants.ts`

**Intent**: Make future fixture drift obvious when a public catalog assertion fails.

**Contract**: Add concise comments documenting that the route field constants are an independent oracle for the local seeded Strapi catalog, and that changing the seed requires updating these constants deliberately.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes.
- `npx playwright test tests/e2e/public-catalog-map.spec.ts` passes with the local app, local Supabase prerequisites already satisfied for the suite, and the seeded Strapi catalog available.
- `npm run test:e2e` passes all e2e specs in serial mode when the full local prerequisites are running.
- `npm run build` still passes.

#### Manual Verification:

- Temporarily breaking the route grade/type/year display causes the route-list fidelity test to fail with a clear assertion.
- Temporarily breaking the map popup href or marker hook causes the map navigation test to fail before it can reach the crag page.
- The spec remains anonymous; it does not call `signInViaMagicLink`, create private rows, or require cleanup.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the public catalog/map coverage is stable before proceeding to the next phase.

---

## Phase 3: Cookbook Documentation

### Overview

Fill the Phase 3 public catalog/map cookbook placeholder so future e2e additions follow the same oracle, locator, and flake-avoidance rules.

### Changes Required:

#### 1. Public catalog/map cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.4's `TBD` with the canonical pattern for public catalog and map e2e tests.

**Contract**: Under `### 6.4 Adding an e2e test for public catalog and map behavior`, document:

- Prerequisites: seeded Strapi catalog with `FIXTURE_CRAG_PATH`, `FIXTURE_ROUTE_NAME`, and the route field constants; `.env` / `.dev.vars` configured for local catalog reads.
- Scope: anonymous homepage, region page, crag page, route-list fidelity, and map pin navigation.
- Locator guidance: accessible locators first; the only allowed exception is the documented marker hook added in `CragMap.tsx`.
- Hydration guidance: use web-first assertions or `expect(...).toPass()` for the client-only Leaflet island.
- Tile guidance: never assert OSM tiles, screenshots, or geometry.
- Oracle guidance: expected route fields come from constants, not from fetching Strapi through the app's own production client during the test.

### Success Criteria:

#### Automated Verification:

- `npm run guardrails` passes.
- `npm run lint` passes if markdown or surrounding files trigger lint-staged checks.

#### Manual Verification:

- A future contributor can read §6.4 and understand how to add another public catalog/map e2e test without reading the full implementation plan.
- §6.4 reflects the actual spec and marker hook implemented in Phases 1-2.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the cookbook is clear and accurate.

---

## Testing Strategy

### E2E Tests:

- Anonymous homepage browse and map section presence.
- Anonymous region page browse to the seeded crag.
- Anonymous crag page route-list fidelity for route name, grade, type, and year/missing-year display.
- Homepage marker -> popup -> `Otwórz trasy` -> seeded crag route-list navigation.

### Manual Testing Steps:

1. Confirm local Strapi contains the seeded crag and route values encoded in `tests/e2e/constants.ts`.
2. Run `npx playwright test tests/e2e/public-catalog-map.spec.ts`.
3. Run `npm run test:e2e` with full local prerequisites active.
4. Temporarily perturb one route field in the UI or fixture constants and confirm the test fails clearly, then revert the perturbation.

## Performance Considerations

The spec should avoid external tile assertions and visual checks to reduce flake. The map test waits for the app's marker/popup state, not for OSM network completion. The suite already runs serially (`workers: 1`), and this anonymous spec does not create private data or poll Mailpit.

## Migration Notes

No database migrations, no Supabase changes, no Strapi schema changes, and no CI changes. This plan changes test constants, one public map component for a narrow marker hook, e2e specs, and test-plan documentation only.

## References

- Test rollout strategy: `context/foundation/test-plan.md`
- E2E rules: `tests/e2e/AGENTS.md`
- Existing fixture constants: `tests/e2e/constants.ts`
- Existing e2e exemplar: `tests/e2e/seed.spec.ts`
- Playwright config: `playwright.config.ts`
- Homepage: `src/pages/index.astro`
- Map section: `src/components/catalog/CragMapSection.astro`
- Leaflet map island: `src/components/catalog/CragMap.tsx`
- Map DTO mapper: `src/lib/catalog/map.ts`
- Region page: `src/pages/regiony/[region]/index.astro`
- Crag page: `src/pages/regiony/[region]/[crag].astro`
- Route table: `src/components/catalog/RoutesTable.astro`
- Catalog Strapi client: `src/lib/catalog/strapi.client.ts`
- Historical map implementation: `context/archive/2026-05-31-crag-map-navigation/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fixture Oracle + Map Testability Contract

#### Automated

- [x] 1.1 `npm run lint` passes after the constants and map hook changes — 8527eca
- [x] 1.2 `npm run build` passes, proving the Leaflet import boundary remains valid for Cloudflare SSR — 8527eca
- [x] 1.3 Targeted manual smoke of the map confirms the marker still opens the same popup and navigates to the crag route list — 8527eca

#### Manual

- [x] 1.4 The new route field constants match the seeded Strapi fixture currently used by `FIXTURE_CRAG_PATH` — 8527eca
- [x] 1.5 The marker hook is discoverable in browser devtools without depending on Leaflet pane/class structure — 8527eca

### Phase 2: Public Catalog + Map E2E Specs

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npx playwright test tests/e2e/public-catalog-map.spec.ts` passes with local prerequisites and seeded Strapi catalog available
- [x] 2.3 `npm run test:e2e` passes all e2e specs in serial mode when the full local prerequisites are running
- [x] 2.4 `npm run build` still passes

#### Manual

- [x] 2.5 Temporarily breaking the route grade/type/year display causes the route-list fidelity test to fail with a clear assertion
- [x] 2.6 Temporarily breaking the map popup href or marker hook causes the map navigation test to fail before it can reach the crag page
- [x] 2.7 The spec remains anonymous; it does not call `signInViaMagicLink`, create private rows, or require cleanup

### Phase 3: Cookbook Documentation

#### Automated

- [x] 3.1 `npm run guardrails` passes
- [x] 3.2 `npm run lint` passes if markdown or surrounding files trigger lint-staged checks

#### Manual

- [ ] 3.3 A future contributor can read §6.4 and understand how to add another public catalog/map e2e test without reading the full implementation plan
- [ ] 3.4 §6.4 reflects the actual spec and marker hook implemented in Phases 1-2

<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Public Catalog Browse Implementation Plan

- **Plan**: `context/changes/public-catalog-browse/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE → SOUND (after triage; all four findings fixed in plan)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING (F1 — fixed) |
| Blind Spots | PASS (F3 — fixed) |
| Plan Completeness | WARNING (F2, F4 — fixed) |

## Grounding

8/8 paths verified, 6/6 symbols verified, brief↔plan consistent. External docs verified via Astro docs (`Astro.rewrite('/404')` + `Astro.response.status` pattern) and Tailwind v4 docs (`before:content-[attr(...)]` arbitrary value).

## Findings

### F1 — Phase 2 region page does an inline filter; missing `listCragsByRegion` helper breaks the slug-helper pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §7 (helpers) + Phase 2 §2 (region page contract)
- **Detail**: The plan justified three slug-based helpers so pages don't filter list responses inline, but Phase 2 still did `allCrags.filter((c) => c.regionSlug === region.slug)`. Phase 3's symmetric routes-in-crag case got `listRoutesByCrag`; the crags-in-region case did not. The pattern was half-implemented.
- **Fix**: Added a fourth helper `listCragsByRegion(regionSlug, options?)` to `strapi.client.ts`, re-exported from `index.ts`, documented in `__tests__/README.md`, and consumed it from the Phase 2 page. Updated all "three helpers" references in the plan and brief to "four helpers".
- **Decision**: FIXED

### F2 — RoutesTable mobile stacked layout is under-specified (most design-sensitive surface per plan-brief)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §2 — `RoutesTable.astro`
- **Detail**: The contract said `data-label` + `before:content-[attr(data-label)]` but didn't pin down (a) data-label content, (b) pseudo-element styling, (c) row layout classes, (d) `<thead>` `sr-only` specifics. The plan-brief itself flagged this as the slice's most design-sensitive surface.
- **Fix (Fix A applied)**: Pinned down a concrete mobile spec — `data-label="Nazwa:"` (with trailing colon), full Tailwind class strings for `<table>`/`<thead>`/`<tr>`/`<td>`, `sm:before:content-none` reset on desktop, em-dash for `null` cells. Added a fallback note (visible `<span class="sm:hidden">` sibling) if the arbitrary value proves brittle in Tailwind 4 build.
- **Decision**: FIXED via Fix A

### F3 — Hero `<img>` is the LCP candidate but `fetchpriority="high"` isn't specified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 — `CragPhotos.astro`
- **Detail**: Performance Considerations explicitly identified the crag hero photo as the LCP candidate and pinned the NFR at 800 ms p95. Plan addressed CLS (width/height) and lazy-loaded thumbs but didn't ask the hero `<img>` to declare its priority. `fetchpriority="high"` is a free LCP win.
- **Fix**: Added `fetchpriority="high"` to the hero `<img>` and `decoding="async"` to all images (hero + thumbs) in the CragPhotos contract.
- **Decision**: FIXED

### F4 — Phase 2 / Phase 3 page error-fallback JSX described in prose, not in a clear if/else wireframe

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §2 (region page) + Phase 3 §3 (crag page)
- **Detail**: The contracts hardcoded `region.name` / `crag.name` in the breadcrumbs literal even though the parenthetical "(when region is set)" implied the implementer should fork the JSX. Translating prose into two distinct render branches required interpretation.
- **Fix**: Replaced the prose contract with explicit happy-path / error-path JSX skeletons in both Phase 2 §2 and Phase 3 §3. Each contract now shows the frontmatter `try/catch` data flow and the body's mutually-exclusive `{value ? <Happy/> : <Error/>}` ternary.
- **Decision**: FIXED

<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Crag Map Navigation (S-02) Implementation Plan

- **Plan**: context/changes/crag-map-navigation/plan.md
- **Mode**: Deep
- **Date**: 2026-05-31
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 15/15 paths ✓, 6/6 symbols ✓, brief↔plan ≈ (1 numbering mismatch — see F3)

## Findings

### F1 — Zero-pin post-hydration UI is undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 step 4 (CragMap), §Critical Implementation Details > Single-pin branch
- **Detail**: The plan handles the zero-pin case for the SSR fallback only ("Empty pins → 'Brak opublikowanych skał'" in step 5), but `<CragMap pins={[]}/>` after hydration is undefined: step 4 says no `center`/`zoom` (FitToCrags owns the view); FitToCrags is a no-op for `pins.length === 0`; Leaflet defaults to lat/lng (0,0) zoom 0 without initial view props. On a cold deploy with no published crag, the visitor sees the SSR "Brak..." message briefly, then the island hydrates and replaces it with an empty world map. Manual step 2.5 tests single-pin but never zero-pin.
- **Fix A ⭐ Recommended**: Early return in CragMap for empty pins — `if (pins.length === 0) return <p class="rounded-md border …">Brak opublikowanych skał.</p>;` at the top of `CragMap()` so pre/post-hydration UI is visually identical.
  - Strength: Eliminates the UI jump; one consistent empty state across SSR fallback and hydrated island.
  - Tradeoff: Duplicates empty-state JSX between `CragMapFallbackList.astro` and `CragMap.tsx` (1 element).
  - Confidence: HIGH — matches region page empty-crag pattern (`src/pages/regiony/[region]/index.astro:35-38`).
  - Blind spot: None significant.
- **Fix B**: Provide default center/zoom for the empty case (e.g., Sokoliki center from leaflet-api-reference).
  - Strength: Map always visible even with zero pins.
  - Tradeoff: Shows tiles for content that doesn't exist; hard-coded region constant.
  - Confidence: MEDIUM.
  - Blind spot: First-load tile fetch for a useless map.
- **Decision**: PENDING

### F2 — Stale `#regiony` link in 404 page (blast radius miss)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 step 7 (homepage swap) — not mentioned
- **Detail**: `src/pages/404.astro:19-24` has `<a href="/#regiony">Przejdź do rejonów</a>`. After step 7 retires `#regiony` for `#mapa`, the 404 CTA targets a non-existent fragment and the label no longer matches the landing section. Grep confirms only `index.astro` and `404.astro` reference `#regiony`.
- **Fix**: Add to Phase 1 step 7: update `src/pages/404.astro:19-24` — `href="/#mapa"`, label "Zobacz crągi na mapie".
- **Decision**: PENDING

### F3 — Internal numbering drift across plan body, CSA, and brief

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: §Current State Analysis (last paragraph), §Critical Implementation Details > SSR boundary
- **Detail**: `plan.md:92` says "Phase 1 Success Criterion 1.5" for the grep invariant — Progress has that at 1.6; 1.5 is pre-commit. `plan.md:34` says "manual-success step 1.6 (the map renders pins)" — that is 1.7 in Progress. `plan-brief.md:68` correctly says 1.6 for grep.
- **Fix**: In `plan.md` only: "Success Criterion 1.5" → "1.6"; "manual-success step 1.6" → "1.7".
- **Decision**: PENDING

### F4 — Grep invariant assertion contradicts the grep command

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §Success Criteria > Automated (bullet 6 / Progress 1.6)
- **Detail**: The rg command uses `--type ts` which excludes `.tsx`; `CragMap.tsx` won't appear in results. The parenthetical "the only allowed match is CragMap.tsx" misleads implementers who expect one hit.
- **Fix**: Change assertion to "...returns no matches" (drop parenthetical). Optionally add `--type tsx` and `--glob '!src/components/catalog/CragMap.tsx'`.
- **Decision**: PENDING

### F5 — CragMapFallbackList file has exactly one consumer

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 step 5
- **Detail**: `CragMapFallbackList.astro` is consumed only by `CragMapSection.astro`. Inlining inside `<Fragment slot="fallback">` would save a file; factoring matches `CragCard.astro` decomposition.
- **Fix**: Skip unless fallback grows.
- **Decision**: PENDING

### F6 — PopupBody definition site is ambiguous

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 step 4 (CragMap)
- **Detail**: "Inline component" doesn't specify module scope vs inside `CragMap()`. Nested component definitions may trip `react-compiler/react-compiler` error (`eslint.config.js:58`).
- **Fix**: Specify module top-level `PopupBody` OR inline JSX in `<Popup>`; do not define inside `CragMap` body.
- **Decision**: PENDING

### F7 — "Zero extra Strapi requests" understates cold cache

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: §Key Discoveries; Phase 1 step 6 contract
- **Detail**: Homepage today calls only `listRegions()`. New section adds `listCrags()` on cold cache (first hit after deploy/TTL) — two parallel Strapi requests, not one. Warm-cache claim is correct.
- **Fix**: Soften wording to "no extra requests per warm cache cycle; cold-cache first-hit adds one parallel `listCrags()` call".
- **Decision**: PENDING

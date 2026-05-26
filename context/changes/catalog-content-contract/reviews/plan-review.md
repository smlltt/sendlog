<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Catalog Content Contract (F-01)

- **Plan**: context/changes/catalog-content-contract/plan.md
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: SOUND
- **Findings**: 1 critical, 5 warnings, 2 observations (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Cache backend mechanism not picked

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots / Architectural Fitness
- **Location**: Phase 2 #7 Catalog Cache
- **Detail**: Plan said "short TTL" without picking a Workers cache backend; wrong choice risks Strapi Free quota exhaustion.
- **Fix A ⭐ Recommended**: Cloudflare Cache API (`caches.default`) with ~60s TTL
- **Decision**: FIXED — Fix A applied to Phase 2 #7

### F2 — Strapi i18n / Polish locale not decided

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1
- **Detail**: PRD is Polish-first; schema did not specify locale strategy.
- **Fix (user choice)**: Enable i18n now — `pl` default, `en` secondary; localized `name`, shared `slug`
- **Decision**: FIXED — Catalog Locales subsection, Phase 1 #4 locale config, Progress 1.8

### F3 — Slug uniqueness scope undefined for crags and routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 #1–3
- **Detail**: Route slug had no uniqueness clause; crag scope ambiguous.
- **Fix**: All catalog slugs globally unique for v1; `documentId` remains canonical identity
- **Decision**: FIXED — Phase 1 contracts updated

### F4 — Strapi REST vs GraphQL not chosen

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 #6
- **Detail**: "Content API" was ambiguous for implementer.
- **Fix**: REST v5, `locale=pl`, flat response shape, explicit populate when needed
- **Decision**: FIXED — Phase 2 #6 updated

### F5 — Phase 3 step modifies the plan file itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 #2
- **Detail**: Self-modifying plan step confused implementation scope.
- **Fix**: Move operator runbook to Critical Implementation Details; remove Phase 3 #2
- **Decision**: FIXED — Operator Notes added; Phase 3 renumbered

### F6 — Env var names not committed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #1–2
- **Detail**: "or equivalent" and unnamed vars risk drift from infrastructure-admin.md.
- **Fix**: `STRAPI_API_URL` and `STRAPI_API_TOKEN`
- **Decision**: FIXED — Phase 2 #1–2 and Operator Notes

### F7 — Crag photo type shape unspecified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 #5
- **Detail**: Optional crag photo lacked app-facing type for later S-01.
- **Fix**: `CatalogCrag.photo` shape with absolute CDN URL
- **Decision**: FIXED — Phase 2 #5 updated

### F8 — Error response contract misapplied to internal module

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #6
- **Detail**: AGENTS.md error shape applies to API routes, not library returns.
- **Fix**: Typed throws internally; JSON error shape only on API routes; smoke page inline diagnostics
- **Decision**: FIXED — Phase 2 #6 updated

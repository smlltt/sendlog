# Catalog Crag Photos (Multi) — Plan Brief

> Full plan: `context/changes/catalog-crag-photos-multi/plan.md`
> Parent change: `context/changes/catalog-content-contract/` (F-01, follow-up note in `change.md` lines 14-22)

## What & Why

Upgrade the v1 catalog crag photo from a single optional media reference to an array of media references, so a single crag can carry topo, approach, and general shots together. Realized during F-01 Phase 2 manual verification that one photo per crag forces an artificial choice on admins and pushes the topo/approach distinction into per-route ownership later.

The change also adds `alt` (Strapi `alternativeText`) to `CatalogPhoto` now, while the contract is open, so the next UI consumer gets accessible image labels for free.

## Starting Point

F-01 (`catalog-content-contract`) shipped a working catalog read path: Strapi defines `Region`, `Crag`, `Route` content types, Astro exposes a server-only catalog module (`src/lib/catalog/`) with typed mappers and a 1-hour Cache API TTL, and `/catalog-smoke/regions` proves the read path end-to-end. The current `Crag` schema defines `photo` as `media multiple:false` and the catalog module exposes `CatalogCrag.photo: CatalogPhoto | null`. `listCrags()` is exported but has no consumer yet — the smoke page only renders regions.

## Desired End State

A crag in Strapi carries an array of photos (possibly empty), and the catalog module returns `CatalogCrag.photos: CatalogPhoto[]` with each photo carrying `url`, optional `width`/`height`, and `alt: string | null`. The legacy single-photo field is gone from both Strapi and the Astro types. No public catalog UI is added or changed in this slice — the smoke page stays regions-only and downstream catalog UIs will consume the new shape directly when they're built.

## Key Decisions Made

| Decision                                  | Choice                                                   | Why (1 sentence)                                                                                                                          | Source |
| ----------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Photo metadata shape                      | Add `alt` (Strapi `alternativeText`) only                | Captures the accessibility label admins already maintain without modeling captions or a `kind` enum that v1 has no UI for.                | Plan   |
| Production data migration                 | None — clean schema swap                                 | User confirmed no published production crags carry a photo today, so the rename does not need an expand/contract migration.               | Plan   |
| Photo ordering                            | Strapi admin-managed order                               | Strapi's media picker lets admins drag-reorder; trusting that order means zero mapper logic and gives admins direct control.              | Plan   |
| Strapi rename mechanics                   | Single schema commit (rename + flip `multiple:true`)     | One PR, one deploy, no transient "both fields exist" state — safe because there is no production data to preserve.                        | Plan   |
| Smoke page scope                          | Unchanged (regions only)                                 | Visual proof of the array shape is covered by Strapi admin UI plus the test README; adding a crags smoke page expands scope unnecessarily. | Plan   |
| Empty-array invariant                     | `photos: []` for missing/null/empty upstream             | Always-array contract removes a null-check from every future caller; matches "always present, possibly empty" idiom.                       | Plan   |

## Scope

**In scope:**

- Strapi `crag` schema: rename `photo` → `photos`, flip to `media multiple:true`.
- `CatalogPhoto` adds `alt: string | null` (sourced from Strapi `alternativeText`).
- `CatalogCrag.photo` removed; `CatalogCrag.photos: CatalogPhoto[]` added (always an array).
- `mapPhoto` → `mapPhotos` in `src/lib/catalog/strapi.client.ts`; returns `[]` when missing.
- `listCrags()` `populate` query updated from `"photo"` to `"photos"`.
- `src/lib/catalog/__tests__/README.md` photo-mapping bullets updated to the new array contract.

**Out of scope:**

- Per-photo `kind` enum (topo / approach / general) — would require a separate Strapi component model.
- Photo `caption` field.
- Sorting photos in the mapper (admin order is canonical).
- Migrating existing production media (none to migrate).
- New smoke page for crags, or surfacing photos in the existing `/catalog-smoke/regions`.
- Cache invalidation, stale-while-revalidate, KV cache, or webhook plumbing.
- Adding a test runner or executable tests.

## Architecture / Approach

Two-phase sequence: Strapi schema change first (one file), then the Astro catalog module (types + mapper + populate + test README, four files). The Astro module stays server-only; the Strapi API token never reaches client code. Cache API key changes implicitly because the populated URL changes, so prior F-01 cache entries age out naturally without needing a manual invalidation.

## Phases at a Glance

| Phase                            | What it delivers                                                              | Key risk                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. Strapi Catalog Schema         | `crag.photos` (`media multiple:true`) replaces `crag.photo` in `schema.json`. | Production Strapi CTB is disabled; schema must be authored locally and deployed through Git.                   |
| 2. Astro Catalog Read Contract   | Types, mapper, populate, and test README reflect the array + `alt` shape.     | Renaming `mapPhoto` and the `photo` field must be done in one commit so type-check and runtime stay in sync.  |

**Prerequisites:** F-01 is shipped (`status: implemented`); Strapi Cloud admin is live; local Strapi can run via `cd admin && npm run develop`; same Strapi API token as F-01 is configured in `.dev.vars`.

**Estimated effort:** Less than one focused session; roughly 30-60 minutes including manual verification.

## Open Risks & Assumptions

- Assumes no published production crag currently carries a `photo`. If that turns out to be wrong at implementation time, fall back to expand/contract (add `photos` alongside `photo`, copy data via Strapi script, drop `photo`) rather than silently leaving both fields.
- Local dev Strapi entries with a `photo` set will need to be re-attached as `photos` after pulling this change — the single-commit rename does not preserve the existing media linkage.
- Strapi's admin-managed photo order is implicit; the first UI that needs guaranteed ordering may need to revisit this decision.
- No automated tests will exist to catch a regression in the photo mapping until a test runner is added (tracked in the catalog `__tests__/README.md`).

## Success Criteria (Summary)

- `cd admin && npm run build`, `npm run lint`, `npm run build`, and `npx astro sync` all pass after both phases.
- A Strapi crag with two or more attached photos surfaces in `listCrags()` as a `photos` array of the same length, in Strapi admin order, with absolute Strapi Cloud CDN URLs.
- A crag with zero photos surfaces as `photos: []` (not `null`).
- `STRAPI_API_TOKEN` continues to be invisible from any client-rendered HTML or JS.

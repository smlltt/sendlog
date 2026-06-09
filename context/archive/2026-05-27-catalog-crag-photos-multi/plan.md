# Catalog Crag Photos (Multi) Implementation Plan

## Overview

Upgrade the v1 catalog crag photo field from a single optional media reference to an array of media references, so a crag can carry topo, approach, and general shots together. Extend the app-facing `CatalogPhoto` shape with an `alt` field sourced from Strapi `alternativeText` so future UI consumers get accessible labels without a follow-up rename.

This is a contained follow-up to F-01 (`catalog-content-contract`). The rename `photo → photos` flows through the Strapi schema, the Astro catalog types, the mapper, and the test README. No public catalog UI consumes `listCrags()` yet, so the breaking change is bounded to the catalog module.

## Current State Analysis

The catalog module shipped in F-01 (now archived as `status: implemented`) exposes `CatalogCrag.photo: CatalogPhoto | null` backed by a Strapi `media multiple:false` field. The single-photo shape was sufficient to prove the read contract but became visibly wrong during F-01 Phase 2 manual verification — a crag realistically needs multiple photos (topo, approach, general), and modeling a single optional photo per crag forces that distinction into per-route ownership or external storage later.

Concrete surface that touches the field today:

- `admin/src/api/crag/content-types/crag/schema.json:60-70` — `photo` field, `multiple:false`, non-localized, optional, images-only.
- `src/lib/catalog/types.ts:13-17` — `CatalogPhoto` (`url`, optional `width`, optional `height`).
- `src/lib/catalog/types.ts:31` — `CatalogCrag.photo: CatalogPhoto | null`.
- `src/lib/catalog/strapi.client.ts:20-31` — `StrapiMedia` type (no `alternativeText` yet).
- `src/lib/catalog/strapi.client.ts:39-47` — `StrapiCragRecord.photo?: StrapiMedia | null`.
- `src/lib/catalog/strapi.client.ts:147-154` — `mapPhoto()` function.
- `src/lib/catalog/strapi.client.ts:171` — `mapCrag` call site (`photo: mapPhoto(record.photo)`).
- `src/lib/catalog/strapi.client.ts:209` — `listCrags()` `populate` array contains `"photo"`.
- `src/lib/catalog/__tests__/README.md:12-16` — two bullets describing photo-mapping behavior.
- `src/lib/catalog/index.ts:18` — re-exports `CatalogPhoto` (no change required, but verify after the field rename).

Outside the catalog module, the field has zero consumers:

- `rg "CatalogPhoto|mapPhoto|\.photo|photo:"` returns only the files above plus historical context docs.
- `src/pages/catalog-smoke/regions.astro` renders regions only.
- `listCrags()` and `listRoutes()` are exported but never imported in `src/`.

## Desired End State

- Strapi `crag` schema defines a `photos` field (`media multiple:true`, optional, images-only, non-localized). The legacy `photo` field is gone.
- `CatalogPhoto` carries `url`, optional `width`, optional `height`, and `alt: string | null` mirroring Strapi `alternativeText`.
- `CatalogCrag.photos: CatalogPhoto[]` is always an array (empty when no photos are uploaded), never `null`.
- `mapPhotos()` returns `[]` when the upstream array is missing, null, or empty, and filters out entries without a `url`.
- `listCrags()` populates `photos` (and `region`) on the upstream Strapi request.
- The test README's photo-mapping bullets describe the new array shape, including the empty-array contract and the `alt` field.
- Lint, build, and `npx astro sync` all pass. Strapi local `build` + `develop` succeed; production Strapi rebuilds from Git.

### Key Discoveries

- The follow-up note in `context/changes/catalog-content-contract/change.md:14-22` already lists the four target files and the rename strategy verbatim.
- Strapi Cloud production runs in `start` mode with Content-Type Builder disabled (recorded in F-01's plan `Critical Implementation Details`). The schema change must be made locally and deployed via Git.
- F-01 plan-review (`reviews/plan-review.md:93`) flagged `CatalogCrag.photo` shape as one of the "fix points worth revisiting"; this change resolves that thread.
- The catalog module is server-only (`STRAPI_API_TOKEN` is read via `astro:env/server`), so the type change does not ripple into any client island.
- `CatalogPhoto` already lives in `types.ts` and is re-exported from `index.ts`; the field name on `CatalogCrag` is the only public-facing rename.

## What We're NOT Doing

- Modeling per-photo `kind` tags (topo / approach / general) as an explicit enum — Strapi `media multiple:true` cannot carry per-file metadata without a separate component model.
- Adding `caption` alongside `alt`.
- Sorting photos in the mapper — Strapi's admin-managed media order is the canonical order.
- Migrating existing production media. User confirmed no published production crags currently carry a `photo`; the rename is a clean schema swap.
- Building a `/catalog-smoke/crags` verification page. The smoke page stays regions-only.
- Adding webhook-driven cache invalidation, stale-while-revalidate, or any cache changes. The 1-hour TTL still applies; cache keys change implicitly because the populated URL changes.
- Adding a test runner or executable tests. The test README continues to be the documented future surface.

## Implementation Approach

Make the schema change first so the upstream contract reflects ground truth, then update the Astro mapper and types in one Astro-side commit. Treat the rename as a single atomic schema edit (no transitional "both fields exist" state) — this is safe because no production crag rows carry photos today. Existing local Strapi entries with a `photo` will lose that media linkage after the rename and need to be re-uploaded against `photos`; that is acceptable for development data.

The `alt` field is added now (not deferred) because Strapi already maintains `alternativeText` per media record, and adding it costs one branch in the mapper plus one bullet in the README — strictly cheaper than re-opening this contract later. Width/height stay optional (`?`), `alt` is `string | null` to match the "nullable upstream field" pattern used for `regionId` and `regionSlug`.

## Critical Implementation Details

### Timing & Lifecycle

Strapi Cloud production disables Content-Type Builder, so the schema change must be authored locally via `cd admin && npm run develop`, committed under `admin/src/api/crag/content-types/crag/schema.json`, and deployed through the connected Strapi Cloud project. Confirm `cd admin && npm run build` succeeds locally before pushing.

### State Sequencing

Ship Phase 1 (schema rename) before Phase 2 (Astro contract). Reversing the order would make Phase 2 type-check against a non-existent upstream field name and leave the running site reading the wrong key from Strapi until the next deploy.

### Data Loss Caveat

The single-commit rename does NOT preserve any existing `photo` media linkage. User confirmed production Strapi has no published crag photos to lose; local dev data with a `photo` set will need to be re-attached as `photos` after pulling the change. If this assumption turns out to be wrong at implementation time, fall back to the expand/contract strategy (add `photos` alongside `photo`, copy data, drop `photo`) — but do not silently leave both fields.

## Phase 1: Strapi Catalog Schema

### Overview

Rename the Strapi `crag` field from `photo` to `photos`, flip multiplicity to `true`, and update the content type's description string to match. This is the only file touched in this phase.

### Changes Required

#### 1. Crag Collection Type

**File**: `admin/src/api/crag/content-types/crag/schema.json`

**Intent**: Replace the single optional photo with an array of optional photos so admins can attach topo, approach, and general shots to a single crag without inventing per-route ownership.

**Contract**: Field renamed `photo` → `photos`. `multiple` flips from `false` to `true`. `required`, `allowedTypes: ["images"]`, and the i18n `localized: false` pluginOption remain unchanged. The collection type's `info.description` string updates from "optional photo" to "optional photos". No other attributes (`name`, `slug`, `latitude`, `longitude`, `region`, `routes`) change.

### Success Criteria

#### Automated Verification

- Strapi admin builds successfully: `cd admin && npm run build`
- Strapi local development starts without schema errors: `cd admin && npm run develop`
- Root lint still passes after the schema edit: `npm run lint`

#### Manual Verification

- Local Strapi admin shows the `Crag` content type with a `photos` media field that accepts multiple images.
- The legacy `photo` field is no longer present on the `Crag` form.
- A crag can be created/edited with two or more photos attached and published.
- Strapi `alternativeText` set in the media library propagates to crag photos in the admin UI.
- Production Strapi rebuilds successfully after the schema commit is deployed.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Astro Catalog Read Contract

### Overview

Update the catalog module's types, Strapi record interfaces, mapper, populate query string, and test README to match the new `photos` array shape. Add `alt` to `CatalogPhoto`.

### Changes Required

#### 1. Catalog Types

**File**: `src/lib/catalog/types.ts`

**Intent**: Replace the single-photo field on `CatalogCrag` with an always-present array, and extend `CatalogPhoto` with the accessible-label field admins already maintain in Strapi.

**Contract**:
- `CatalogPhoto` gains `alt: string | null` (mirrors Strapi `alternativeText`; `null` when the admin left it blank). `url`, `width?`, `height?` stay as-is.
- `CatalogCrag.photo: CatalogPhoto | null` is removed and replaced by `CatalogCrag.photos: CatalogPhoto[]` — always an array, never `null`, possibly empty.
- The leading docblock paragraph about canonical identity is unchanged.

#### 2. Strapi Record Shape & Mapper

**File**: `src/lib/catalog/strapi.client.ts`

**Intent**: Reflect the renamed/multi-valued Strapi field on the wire-format types, rewrite the photo mapper to return an array, and update the crag populate query so Strapi sends the new field.

**Contract**:
- `StrapiMedia` gains `alternativeText?: string | null` alongside the existing `url`, `width`, `height`, `formats` fields. No other StrapiMedia field is added or removed.
- `StrapiCragRecord.photo?: StrapiMedia | null` is removed and replaced by `StrapiCragRecord.photos?: StrapiMedia[] | null` (`?` because Strapi may omit the populated key entirely; the mapper must tolerate both `undefined` and `null`).
- `mapPhoto` is renamed to `mapPhotos` with signature `(media: StrapiMedia[] | null | undefined) => CatalogPhoto[]`. It returns `[]` for `undefined`, `null`, or empty input. For each entry it must drop items without a `url` (defensive) and otherwise return `{ url, width? (only when numeric), height? (only when numeric), alt }` where `alt = typeof media.alternativeText === "string" ? media.alternativeText : null`.
- `mapCrag()` calls `mapPhotos(record.photos)` instead of `mapPhoto(record.photo)`.
- `listCrags()` `populate` array changes from `["photo", "region"]` to `["photos", "region"]`. No other populate entries change. `listRoutes()` is untouched.

#### 3. Module Test Coverage Notes

**File**: `src/lib/catalog/__tests__/README.md`

**Intent**: Replace the two single-photo bullets with the new array-shape contract, including the empty-array invariant and the `alt` field, so a future test runner has an accurate target.

**Contract**: Under the `## Mapping` heading, the bullet group "Strapi v5 crag record → `CatalogCrag`" replaces its two photo bullets with:
- `photos` array populated → `CatalogCrag.photos` mirrors entries in upstream order, each with `url`, optional numeric `width`/`height`, and `alt` sourced from `alternativeText` (`null` when absent or blank).
- `photos` absent / `null` / `[]` upstream → `CatalogCrag.photos === []` (always an array, never `null`).
- Entries missing a `url` are filtered out by the mapper.

The `region`-related bullets immediately below stay unchanged. Other sections (Errors, Cache, Known follow-ups) are untouched.

#### 4. Module Entrypoint

**File**: `src/lib/catalog/index.ts`

**Intent**: Verify the re-exports still cover the public surface after the type rename.

**Contract**: No source change. `CatalogPhoto`, `CatalogCrag`, `CatalogReadOptions` re-exports are already correct because the type names did not change — only `CatalogCrag.photo` → `photos`. Confirm by reading the file after Phase 2 to ensure no stale named exports remain.

### Success Criteria

#### Automated Verification

- Astro types are regenerated: `npx astro sync`
- Root lint passes: `npm run lint`
- Production build passes without requiring Strapi secrets in CI: `npm run build`

#### Manual Verification

- With a local Strapi crag carrying two or more photos, calling `listCrags({ bypassCache: true })` (e.g., from an Astro page evaluated in the dev server, or via the smoke regions page's surrounding pattern) returns crags whose `photos` array contains all attached media with their absolute Strapi Cloud CDN URLs.
- A crag with zero photos attached returns `photos: []`, not `null` and not a missing field.
- Strapi `alternativeText` filled in for an image surfaces as a non-null `alt` on the corresponding `CatalogPhoto`; clearing `alternativeText` surfaces as `alt: null`.
- Draft/unpublished crags are not returned by `listCrags()`.
- Browser devtools and rendered HTML do not expose the Strapi API token (confirms no accidental import into client code).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering this change complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

- No automated test runner is configured (`AGENTS.md` → "No test runner is configured"). Intended tests stay documented in `src/lib/catalog/__tests__/README.md`.
- Future coverage to add when a runner lands: empty/missing/null `photos` upstream → `[]`; ordering preserved across mapping; entries missing `url` filtered out; `alt` round-trips both string and null.

### Integration Tests

- `cd admin && npm run build` verifies Strapi schema integrity.
- `npx astro sync`, `npm run lint`, and `npm run build` verify the Astro contract.
- Local Strapi with multiple-photo crag content provides the end-to-end manual check; the existing `/catalog-smoke/regions` page continues to validate that the read path and cache are healthy overall.

### Manual Testing Steps

1. Start local Strapi from `admin/` and confirm the `Crag` content type shows the new `photos` field (and no `photo` field).
2. Create a crag with at least two images attached to `photos` (set `alternativeText` on at least one of them in the media library) and publish it.
3. Start the Astro dev server with valid Strapi env values.
4. From a local Astro page or one-off script that calls `listCrags({ bypassCache: true })`, inspect the returned crag and verify: `photos.length >= 2`, ordering matches Strapi admin order, `alt` is the configured `alternativeText` (or `null`), and the URL is absolute (`https://...strapi`).
5. Edit the crag to remove all photos and confirm `photos` round-trips as `[]`.
6. Confirm `/catalog-smoke/regions` still renders unchanged (no regression in the surrounding catalog read path).
7. Confirm browser devtools never expose `STRAPI_API_TOKEN`.

## Performance Considerations

The catalog read path's quota and latency budget are unchanged. The Strapi `populate=photos` request returns a small array per crag (typically <10 entries), so the response payload grows linearly with attached media but remains well within Cloudflare Worker response limits and the Strapi Cloud Free quota assumed in F-01 (~2,500 req/month at a 1-hour Cache API TTL). No new cache binding, no new TTL, no new memoization.

The Cache API key is the upstream Strapi URL including the query string; renaming the populate entry from `photo` to `photos` produces a different cache key, so existing cached entries from F-01 will not be served stale against the new schema — they age out naturally.

## Migration Notes

No Supabase migration. The Strapi schema change deploys through Strapi Cloud's Git-connected rebuild as documented in F-01. There is no rollback story for catalog content: rolling back the schema commit would restore the `photo` field name and `multiple:false`, but any photos uploaded after the deploy against `photos` would not auto-revert. User confirmed no production crags currently carry media, so the practical rollback is "redeploy the prior commit and re-create test entries."

## References

- Source follow-up note: `context/changes/catalog-content-contract/change.md` (lines 14-22)
- F-01 plan: `context/changes/catalog-content-contract/plan.md`
- F-01 plan-review fix point: `context/changes/catalog-content-contract/reviews/plan-review.md` (line 93)
- Repo rules: `AGENTS.md`
- Catalog types: `src/lib/catalog/types.ts`
- Strapi mapper: `src/lib/catalog/strapi.client.ts`
- Catalog test README: `src/lib/catalog/__tests__/README.md`
- Crag schema: `admin/src/api/crag/content-types/crag/schema.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strapi Catalog Schema

#### Automated

- [x] 1.1 Strapi admin builds successfully: `cd admin && npm run build` — 995a8ce
- [x] 1.2 Strapi local development starts without schema errors: `cd admin && npm run develop` — 995a8ce
- [x] 1.3 Root lint still passes after the schema edit: `npm run lint` — 995a8ce

#### Manual

- [x] 1.4 Local Strapi admin shows the `Crag` content type with a `photos` media field that accepts multiple images. — 995a8ce
- [x] 1.5 The legacy `photo` field is no longer present on the `Crag` form. — 995a8ce
- [x] 1.6 A crag can be created/edited with two or more photos attached and published. — 995a8ce
- [x] 1.7 Strapi `alternativeText` set in the media library propagates to crag photos in the admin UI. — 995a8ce
- [ ] 1.8 Production Strapi rebuilds successfully after the schema commit is deployed.

### Phase 2: Astro Catalog Read Contract

#### Automated

- [x] 2.1 Astro types are regenerated: `npx astro sync` — d7af8a7
- [x] 2.2 Root lint passes: `npm run lint` — d7af8a7
- [x] 2.3 Production build passes without requiring Strapi secrets in CI: `npm run build` — d7af8a7

#### Manual

- [x] 2.4 With a local Strapi crag carrying two or more photos, `listCrags({ bypassCache: true })` returns those crags with a `photos` array containing all attached media and absolute Strapi Cloud CDN URLs. — d7af8a7
- [x] 2.5 A crag with zero photos returns `photos: []` (not `null`, not a missing field). — d7af8a7
- [x] 2.6 Strapi `alternativeText` round-trips as `alt` (`string` when filled, `null` when blank). — d7af8a7
- [x] 2.7 Draft/unpublished crags are not returned by `listCrags()`. — d7af8a7
- [x] 2.8 Browser devtools and rendered HTML do not expose the Strapi API token. — d7af8a7

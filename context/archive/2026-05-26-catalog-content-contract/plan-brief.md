# Catalog Content Contract - Plan Brief

> Full plan: `context/changes/catalog-content-contract/plan.md`
> Roadmap: `context/foundation/roadmap.md`
> PRD: `context/foundation/prd.md`

## What & Why

F-01 defines the curated catalog content contract for SendLog: regions, crags, routes, and the canonical route identity that every later slice will depend on.

This is foundational because public browsing, climb logs, projects, and admin curation all need one shared route identity. The app must never duplicate route identity per user.

## Starting Point

The Astro app currently has auth/starter scaffolding only; catalog code is absent. Strapi is already deployed under `admin/`, but no Region, Crag, or Route content types exist yet.

## Desired End State

Strapi owns published catalog content for v1. Astro can read that content server-side through a typed catalog module, map it into local app contracts, cache it briefly, and show a simple regions smoke page.

Later private Supabase state can reference routes by Strapi `documentId` without copying catalog records.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Catalog source of truth | Strapi Cloud | It matches the deployed admin CMS and keeps catalog curation out of custom Supabase admin work. | Plan |
| Route identity | Strapi `documentId` plus slugs | `documentId` is stable for references, while slugs remain useful for human-readable URLs. | Plan |
| Content depth | Region, crag, route | This matches MVP needs and avoids modeling topo sectors/walls before browsing exists. | Plan |
| Crag media | Optional crag photo | Adds useful visual context without expanding route/photo scope. | Plan |
| Provenance | No explicit source metadata in v1 | Admin discipline is accepted for now; formal topo provenance is out of scope. | Plan |
| Astro contract | Types, server-only client, cache, smoke page | Gives later slices a stable read path without building S-01 early. | Plan |
| Cache freshness | Short TTL | Protects Strapi Free quota while accepting a few minutes of staleness after edits. | Plan |
| Strapi permissions | Published-only reads via Worker secret token | Keeps drafts private and prevents exposing Strapi credentials in the browser. | Plan |

## Scope

**In scope:**

- Strapi content types for Region, Crag, and Route.
- Required route identity contract using Strapi `documentId`.
- Optional photo field on crags.
- Astro server-only Strapi env, client, mapper, types, and short TTL cache.
- Verification-only `/catalog-smoke/regions` page.

**Out of scope:**

- Full public catalog UI.
- Climb logs, projects, and private Supabase state.
- Supabase catalog tables or migrations.
- Topo sectors, walls, ordering, and formal source/provenance tracking.
- Webhook-driven cache invalidation.
- Direct anonymous browser reads from Strapi.

## Architecture / Approach

Strapi is the admin-curated catalog source. Astro reads published Strapi data server-side with a secret token, maps raw responses into `CatalogRegion`, `CatalogCrag`, and `CatalogRoute`, and caches public reads for a short TTL. The browser only sees mapped catalog data, never Strapi credentials.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Strapi Catalog Schema | Region, Crag, and Route content types with relations and crag photo support. | Schema must be created locally because Strapi Cloud production disables Content-Type Builder. |
| 2. Astro Catalog Read Contract | Server-only env, typed catalog module, Strapi mapper, and short TTL cache. | Avoid leaking raw Strapi shapes or secrets into pages/client code. |
| 3. Smoke Route & Verification | `/catalog-smoke/regions` visual proof and build/manual checks. | Keep it clearly verification-only, not the final catalog UX. |

**Prerequisites:** Strapi Cloud admin is live; a Strapi API token must be issued before Astro smoke testing.

**Estimated effort:** About 2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Strapi `documentId` remains the canonical route identity until an explicit future migration changes catalog ownership.
- Short TTL caching means admin edits may take a few minutes to appear.
- No test runner exists, so verification depends on build/lint plus manual smoke tests.
- No explicit topo provenance field means source accuracy relies on admin process for v1.

## Success Criteria (Summary)

- Region, Crag, and Route can be created and published in Strapi.
- Astro can list published regions through the server-only catalog contract.
- Route records expose stable canonical IDs for later climb logs and projects.

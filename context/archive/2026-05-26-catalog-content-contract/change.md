---
change_id: catalog-content-contract
title: Catalog content contract
status: archived
created: 2026-05-26
updated: 2026-05-27
archived_at: 2026-05-27T12:08:51Z
---

## Notes

F-01 z @context/foundation/roadmap.md

### Follow-ups (post-archive)

- **Crag photos as an array.** The v1 catalog contract here ships `Crag.photo` as a single optional media field (Strapi `media multiple:false`) and `CatalogCrag.photo: CatalogPhoto | null`. Realized during Phase 2 manual verification that crags should carry an array of photos instead (topo, approach, general, etc.). Open a follow-up change after F-01 archives that:
  - Renames the Strapi field `photo` → `photos` and flips it to `media multiple:true` (rename avoids losing existing rows during the schema change).
  - Updates `CatalogCrag.photos: CatalogPhoto[]` (always an array, possibly empty).
  - Adjusts `mapPhoto` → `mapPhotos` in `src/lib/catalog/strapi.client.ts` (returns `[]` when missing).
  - Updates `src/lib/catalog/__tests__/README.md` photo-mapping bullets.
  - Phase 3 smoke page renders only regions, so it is not affected; later crag list/detail UIs will consume the new shape directly.
  - Suggested change-id: `catalog-crag-photos-multi`.

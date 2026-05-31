---
change_id: crag-map-navigation
title: Crag map navigation (S-02)
status: archived
created: 2026-05-31
updated: 2026-05-31
archived_at: 2026-05-31T16:06:44Z
---

## Notes

Implementation slice for roadmap **S-02: Crag map navigation** (PRD refs FR-004 / FR-005). The interactive Leaflet map replaces the regions-list section on `/` and navigates from pins to each crag's route list page shipped by S-01.

- Roadmap entry: `context/foundation/roadmap.md` lines 130-141 (S-02).
- PRD refs: FR-004, FR-005 in `context/foundation/prd.md` lines 77-80, plus the documented static-fallback note on line 168.
- Plan: `./plan.md` (full) and `./plan-brief.md` (two-pager).
- Research / pre-plan artifacts (kept in this folder as history; not the plan input):
  - `research.md` — codebase compatibility check for Leaflet + react-leaflet against the SendLog stack.
  - `library-research.md` — option survey across map libraries / fallbacks; short-list that selected Leaflet.
  - `leaflet-api-reference.md` — Context7-sourced API reference for Leaflet + react-leaflet, plus Astro/Vite gotchas.
- Roadmap S-02 unknown resolved here: "Should the interactive map fallback be triggered for v1 if integration becomes a time sink?" → answer: only if the Phase 2 ~4h mobile-cellular tripwire fires, in which case this plan is parked and a sibling change `crag-map-fallback` is opened via `/10x-new` to ship the PRD-named Tier 2 path.
- Folder previously held only investigation artifacts (front matter `change_id: crag-map-navigation-investigation`, `status: research`); promoted to the S-02 implementation folder when `/10x-plan crag-map-navigation` was run on 2026-05-31.

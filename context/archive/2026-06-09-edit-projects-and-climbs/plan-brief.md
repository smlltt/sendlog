# Edit a Logged Climb — Plan Brief

> Full plan: `context/changes/edit-projects-and-climbs/plan.md`

## What & Why

Signed-in climbers can add and delete logged climbs but can't fix one. This change adds **edit** for a climb's date and note, inline on `/historia`, so a fat-fingered date or a note tweak no longer forces a delete + re-add.

> The change-id mentions projects too, but projects are pure binary membership (nothing to edit), so the project half was dropped during planning. **Climbs only.**

## Starting Point

The `climbs` table already ships an `UPDATE` RLS policy (`climbs_update_own`) and an `updated_at` trigger from F-02 — fully update-ready, but unused. The app exposes only `POST`/`DELETE /api/climbs`, a create-only `ClimbLogForm`, and a delete-only `HistoryClimbCard`. `/historia` already carries each climb's `id`, `climbedOn`, and `note` in its DTO.

## Desired End State

Each `/historia` row gets an **Edytuj** button. It expands the row into a pre-filled date+note form (the same form used to log a climb, in edit mode); saving `PATCH`es the change, collapses the row to its updated read view, and shows a brief "changes saved" notice. If the climb was deleted elsewhere, the row drops with a neutral "already removed" notice.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Editable fields | Date + note (not route) | The only two user-supplied fields; route is identity | Plan |
| Surface | `/historia` only | The only place individual climbs are shown | Plan |
| Edit UX | Inline, reuse `ClimbLogForm` (create/edit modes) | One form for add + edit; shared validation + progress | Plan |
| API shape | `PATCH /api/climbs` with full `{ id, climbedOn, note }` | Mirrors existing POST/DELETE; no field-diffing | Plan |
| Climb gone on save | 404 `not_found` → drop row + neutral notice | Honest; reuses existing not_found discipline | Plan |
| "Edited" indicator | None (`updated_at` still recorded) | Matches minimal v1 tone | Plan |
| Post-save | Collapse to view + success notice | Consistent with delete feedback model | Plan |
| Validation | Exactly mirror the create form | One contract for create + edit | Plan |
| No-op save | Allowed (sends PATCH, treated as success) | Simplest; no dirty-tracking | Plan |

## Scope

**In scope:** `updateClimb` helper + `UpdateClimbInput`; `PATCH /api/climbs`; generalized create/edit `ClimbLogForm`; per-row edit state in `HistoryClimbCard`; `climbs.form.edit_*` / `history.edit.*` i18n; verification registry rows.

**Out of scope:** editing projects; editing a climb's route; any migration/schema/RLS change; edit on the crag page; an "edited" badge; future-date restrictions; dirty-checking; a second locale.

## Architecture / Approach

Bottom-up, mirroring the add/delete flows: server helper (`updateClimb`, scoped by `id` + `user_id`, zero rows → `not_found`) → `PATCH` verb reusing the existing `STATUS_FOR_CODE`/`errorBody`/`errors.climbs.*` plumbing → shared `mode: "create" | "edit"` form → history row that owns the edit lifecycle and reconciles the list item from the PATCH response. The page loader and DTOs are unchanged; islands keep the server-only boundary (JSON API only).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server + API | `updateClimb` + `PATCH /api/climbs`, callable contract | Getting `not_found`/ownership scoping right |
| 2. Edit UI | Shared create/edit form + history-row edit + i18n | Form generalization regressing create mode |
| 3. Verification | Progress registry + checklist + green guardrails | Stale/missing registry row failing the guard |

**Prerequisites:** none beyond the shipped S-04/S-05 climb flow; DB already update-ready.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Generalizing `ClimbLogForm` must leave create-mode behavior byte-for-byte unchanged (it's the shipped, guard-registered save path).
- Edit-mode `not_found` must signal "gone" (drop row) distinctly from "saved", unlike delete's silent idempotency.

## Success Criteria (Summary)

- A climber edits a climb's date/note on `/historia` and sees it update in place with confirmation.
- Editing a climb that was removed elsewhere drops the row gracefully rather than erroring.
- `npm run guardrails`, `lint`, and `build` pass; no migration is needed.

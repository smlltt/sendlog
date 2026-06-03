# Delete Climb Log — Plan Brief

> Full plan: `context/changes/delete-climb-log/plan.md`

## What & Why

Ship S-05: a signed-in climber can delete one of their own logged climbs. This completes the PRD's v1 correction model: if the date or note is wrong, the climber deletes the log and re-logs it, without adding edit UI.

## Starting Point

S-04 already shipped climb logging and `/historia`. The data layer already has `deleteClimb(client, id)` and own-row Supabase RLS, so S-05 is mainly an API, history UI, i18n, and verification-docs change.

## Desired End State

On `/historia`, each climb row has a Polish delete action with inline confirmation. Confirming shows `Pending`, calls `DELETE /api/climbs` with JSON `{ id }`, removes the row without a full reload, and shows success or neutral stale-row feedback.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Delete surface | `/historia` rows only | History rows represent individual climb IDs, avoiding ambiguity when a user logged the same route multiple times. |
| API contract | `DELETE /api/climbs` with JSON `{ id }` | Reuses the existing climb API's validation, private-client construction, and structured error mapping. |
| Confirmation | Inline two-step row confirmation | Matches the current lightweight React style without adding a dialog dependency. |
| Success behavior | Remove row and show Polish success | Gives immediate feedback without a full page reload. |
| `not_found` behavior | Remove row and show neutral copy | Preserves privacy and treats stale UI as already matching the user's intended final state. |
| Progress primitive | `Pending` | Delete is a non-form fetch mutation and should be covered by the progress-feedback guardrail. |
| Scope | No edit, route delete, undo, or schema work | Keeps S-05 aligned with FR-011 and the existing hard-delete helper. |

## Scope

**In scope:**

- `DELETE /api/climbs` for individual climb IDs.
- `/historia` row-level delete UI.
- Inline confirmation, pending state, success, neutral stale-row, and error copy.
- Progress registry and beta checklist updates.

**Out of scope:**

- Edit climb log.
- Delete controls on route pages.
- Undo/restore or soft delete.
- Supabase migrations or RLS changes.
- Projects, stats, analytics, or dashboard changes.

## Architecture / Approach

The API route remains the server-only boundary: React calls `/api/climbs`, and the API imports `deleteClimb`. The history page continues loading climb rows server-side, then delegates each row's delete interaction to a small client island that owns confirmation, pending state, and local row removal.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Delete API Contract | Authenticated `DELETE /api/climbs` plus delete-specific error copy/types | Accidentally weakening structured errors or create behavior. |
| 2. History Delete UI | Inline row delete on `/historia` with `Pending` and local row removal | Preserving mobile layout and server-only boundaries. |
| 3. Guardrails + Beta Verification | Progress registry, beta checklist, and verification pass | Docs drifting from the shipped action primitive. |

**Prerequisites:** S-04 route climb log is complete.
**Estimated effort:** ~1-2 focused sessions across 3 phases.

## Open Risks & Assumptions

- The plan assumes climb IDs are UUID strings suitable for zod UUID validation.
- If deleting the final row with per-row islands leaves no full empty state until refresh, the implementation should document that manual behavior and keep the UI visually clear.
- There is still no automated test runner, so API and UI behavior rely on lint/build/guardrails plus manual smoke.

## Success Criteria (Summary)

- A signed-in user can delete one owned climb row from `/historia` without deleting repeat logs for the same route.
- Signed-out, stale, and other-user delete attempts return structured JSON and do not leak private data.
- `npm run lint`, `npm run guardrails`, and `npm run build` pass, and the beta checklist covers the shipped delete action.

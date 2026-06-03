# Delete Climb Log Implementation Plan

## Overview

Ship S-05: a signed-in climber can delete one of their own logged climbs from personal history. The slice completes the PRD's delete-and-relog correction model without adding edit UI, route-page delete controls, undo, or schema changes.

The implementation should reuse the existing private-state delete helper and own-row RLS policy. The visible product change lives on `/historia`: each history row gains an inline two-step delete action, shows progress while the request is in flight, removes the deleted row without a full page reload, and shows Polish success or neutral stale-row feedback.

## Current State Analysis

S-04 already shipped route climb logging and personal history. `/api/climbs` currently exposes a create-only `POST` endpoint with zod validation, request-scoped `createPrivateStateClient`, structured `{ error: { code, message, context } }` responses, and Polish error messages from `src/i18n/ui.ts`.

The data layer already supports the S-05 delete operation. `deleteClimb(client, id)` hard-deletes a climb by `id` and `user_id`, returning `not_found` when the row is absent or not owned by the current user. The Supabase migration already includes an own-row delete policy for `public.climbs`, and multiple climb rows per route are intentionally allowed.

The current history list is server-rendered by `src/components/climbs/HistoryList.astro`. It receives `HistoryClimbItem[]`, including each climb `id`, and renders one row per individual climb. That makes `/historia` the least ambiguous delete surface: deleting from a route-row summary would be unclear when a user has logged the same route multiple times.

## Desired End State

After this plan lands:

- Signed-in users can delete an individual climb row from `/historia`.
- The delete action uses inline two-step confirmation, not a modal or browser `confirm()`.
- The delete request goes through `DELETE /api/climbs` with JSON `{ id }`.
- The row shows visible progress feedback via `Pending` while the delete is in flight.
- On success, the row disappears without a full page reload and a Polish success message remains visible.
- If the API reports `not_found`, the row is also removed and a neutral Polish message explains that the entry was already gone or unavailable.
- API errors keep using the structured response contract.
- `npm run guardrails`, `npm run lint`, and `npm run build` pass; verification docs cover the new shipped delete action.

### Key Discoveries:

- `src/lib/private-state/climbs.ts` already exports `deleteClimb(client, id)`, so no Supabase migration is expected.
- `supabase/migrations/20260531172510_private_user_state.sql` already has `climbs_delete_own`, preserving per-user privacy at the database layer.
- `src/pages/api/climbs.ts` already has the correct API route shape for validation, server-only client construction, and structured error mapping.
- `src/components/climbs/HistoryList.astro` already receives each climb `id`, making `/historia` the natural delete surface.
- `docs/verification/progress-feedback-actions.md` must gain a shipped row for the delete action because it is a user-initiated Supabase mutation that can exceed 2 seconds on cellular.

## What We're NOT Doing

- No edit form. V1 correction remains delete and re-log.
- No route-page delete control. Route rows summarize climbs and can represent multiple logs for the same route.
- No undo or restore. The existing helper is a hard delete.
- No schema, RLS, or migration changes.
- No project-list behavior, auto-removal, stats, analytics, or dashboard redesign.
- No new test runner setup.

## Implementation Approach

Use the existing `src/pages/api/climbs.ts` endpoint as the single JSON mutation surface for climbs. Add a `DELETE` handler beside `POST`; validate `{ id }`, create a request-scoped private-state client from the current Astro context, call `deleteClimb(client, id)`, and map all failures through the same structured error helpers already used by create.

For the UI, keep `/historia` as the only delete surface. Add a small React island around history rows or row actions so the client can show inline confirmation, render `Pending` during the fetch, and remove a row from local state after success. Keep all server-only private-state imports out of React components; the island talks only to `/api/climbs`.

Treat `not_found` as a privacy-preserving, idempotent outcome in the UI: remove the row and show a neutral message. The API should still return a structured 404 with code `not_found`; the client decides that this code means the user's intended final state is already true.

## Critical Implementation Details

### Individual Rows, Not Route Summaries

Deletion must target a concrete climb `id`, not a route id. Multiple logs for the same route are valid, so deleting by route would either be ambiguous or accidentally destructive.

### Server-Only Boundary

React components must not import `@/lib/private-state`. The delete UI receives primitive `HistoryClimbItem` props and calls `DELETE /api/climbs`; the API route is the only place that imports `deleteClimb`.

### Neutral `not_found` UX

The API should preserve `not_found` as a 404 structured error. The UI should handle that code specially by removing the row and showing neutral copy rather than a scary failure, because it covers both stale UI and cross-user/non-owned rows without leaking which case happened.

## Phase 1: Delete API Contract

### Overview

Add the authenticated JSON delete path for individual climb rows, reusing the existing private-state helper, error response format, and Polish i18n strategy.

### Changes Required:

#### 1. Extend climb API imports and schemas

**File**: `src/pages/api/climbs.ts`

**Intent**: Make the existing climb API route support both create and delete mutations while preserving one structured error surface.

**Contract**: Import `deleteClimb` from `@/lib/private-state`. Add a delete schema accepting `{ id: string }`, validated as a UUID if existing climb IDs are UUID strings. Keep `export const prerender = false`.

#### 2. Add `DELETE /api/climbs`

**File**: `src/pages/api/climbs.ts`

**Intent**: Provide the client-side history delete island with a narrow authenticated mutation endpoint.

**Contract**: Export `DELETE: APIRoute`. Read JSON, validate `{ id }`, create the private-state client from `context.request.headers`, `context.cookies`, and `context.locals.user`, then call `deleteClimb(client, id)`. Return a successful JSON response that includes the deleted `id` so the client can reconcile local state; return structured `{ error: { code, message, context } }` for validation, auth, not-found, config, upstream, and unknown failures.

#### 3. Improve delete-specific error messages

**File**: `src/i18n/ui.ts`

**Intent**: Avoid generic climb error copy for expected delete failure modes.

**Contract**: Add Polish keys for `errors.climbs.not_found` and any delete-specific generic failure copy needed by the client. Update `resolveErrorMessage()` in `src/pages/api/climbs.ts` so `not_found` no longer falls through to `errors.climbs.unknown`.

#### 4. Update client-facing climb API types

**File**: `src/components/climbs/types.ts`

**Intent**: Keep the React delete island's request/response/error types free of server-only imports.

**Contract**: Add small DTOs if useful, such as `DeleteClimbResponse` with `{ deleted: { id: string } }`, while keeping `ClimbApiErrorBody` aligned with the API route.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails still pass before UI docs are updated: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "export const DELETE" src/pages/api/climbs.ts` finds the new handler.
- Invalid delete payloads return structured `{ error: { code, message, context } }` JSON.

#### Manual Verification:

- Signed-out `DELETE /api/climbs` returns structured `unauthenticated` JSON, not an HTML redirect.
- Signed-in delete with an owned climb id removes that row from Supabase.
- Signed-in delete with an unknown or other-user climb id returns structured `not_found` JSON without leaking ownership details.
- Existing `POST /api/climbs` save behavior still works.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: History Delete UI

### Overview

Add the visible S-05 behavior on `/historia`: per-row inline confirmation, pending feedback, local row removal, and Polish success/error messages.

### Changes Required:

#### 1. Add a history row delete island

**Files**: `src/components/climbs/HistoryClimbCard.tsx`, `src/components/climbs/index.ts`

**Intent**: Own the client-side state for one history row without moving private-state reads into the browser.

**Contract**: The island receives a `HistoryClimbItem` and translated labels/messages as primitive props. It renders the current row content, an initial delete button, inline confirm/cancel buttons, a `Pending` indicator while `DELETE /api/climbs` is in flight, and `role="alert"` feedback for errors or neutral stale-row outcomes. After a successful delete or handled `not_found`, it removes the row from the rendered list state.

#### 2. Wire the island into the history list

**File**: `src/components/climbs/HistoryList.astro`

**Intent**: Keep the server-rendered history page responsible for data loading while delegating per-row delete interaction to React.

**Contract**: Render the delete-capable row island for each `HistoryClimbItem`, preserving the existing semantic list structure and mobile card layout. Do not import `@/lib/private-state` or `@/lib/catalog` into React components.

#### 3. Add delete UI copy

**File**: `src/i18n/ui.ts`

**Intent**: Keep all new S-05 visible strings Polish-first and guardrail-friendly.

**Contract**: Add keys for delete button label, confirmation prompt, confirm, cancel, pending, success, neutral already-gone message, and user-facing error fallback. Update `/historia` checklist expectations to include these strings.

#### 4. Preserve empty-state behavior after local deletes

**Files**: `src/components/climbs/HistoryList.astro`, `src/components/climbs/HistoryClimbCard.tsx`

**Intent**: Avoid leaving a blank page when the user deletes the last visible climb.

**Contract**: If the implementation owns list state at the list level, show the existing empty-history Polish state once the last row is removed. If each row owns only its own visibility, include a lightweight page-level or list-level success region and accept that the full empty state appears after refresh only if this keeps the edit smaller; document the chosen behavior in the manual verification notes.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass after adding S-05 i18n and progress rows: `npm run guardrails`
- Production build passes: `npm run build`
- `rg "from \"@/lib/private-state\"" src/components` returns no React component imports.
- `rg "window.confirm|confirm\\(" src/components/climbs` returns no browser-native confirmation usage.
- `rg "Pending" src/components/climbs` finds the delete pending primitive.

#### Manual Verification:

- `/historia` shows a Polish delete control for each climb row.
- Tapping delete opens inline confirmation without navigating away.
- Cancel closes confirmation and leaves the row unchanged.
- Confirm shows visible pending feedback within approximately 300 ms and keeps it visible until completion.
- Successful delete removes only the selected row and leaves other climbs, including other logs for the same route, visible.
- A handled `not_found` response removes the stale row and shows neutral Polish copy.
- If the last row is deleted, the chosen empty-state behavior is clear and not visually broken.
- Mobile viewports 375x667, 390x844, and 412x915 render the delete controls without horizontal scrolling or overlapping tap targets.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Guardrails + Beta Verification

### Overview

Make S-05 part of the verification harness and run the automated and manual checks that protect the beta flow.

### Changes Required:

#### 1. Add the delete action to the progress registry

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Ensure CI checks the delete action's pending primitive once S-05 lands.

**Contract**: Add a shipped row for the climb-log delete action, pointing at the file that owns the action, using `Pending` as the primitive and explaining that the request hits Supabase and can exceed 2 seconds on cellular.

#### 2. Update the beta-flow checklist

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: Include S-05 in the manual Polish/mobile/progress verification loop.

**Contract**: Update `/historia` Polish UI expectations to include delete labels, confirmation copy, pending copy, success copy, neutral stale-row copy, and errors. Add a B2 checkbox for the shipped delete progress row. Update the latest run metadata when verification is performed.

#### 3. Record implementation progress

**Files**: `context/changes/delete-climb-log/plan.md`, `context/changes/delete-climb-log/change.md`

**Intent**: Keep the change folder ready for `/10x-implement` and later archive.

**Contract**: As implementation lands, mark `## Progress` items complete with commit SHAs. Keep `change.md` status aligned with the change lifecycle.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Root lint passes: `npm run lint`
- Guardrails pass with the S-05 delete row shipped: `npm run guardrails`
- Production build passes: `npm run build`
- `docs/verification/progress-feedback-actions.md` includes the climb-log delete action as `shipped`.
- `docs/verification/beta-flow-checklist.md` includes a B2 row for the delete action.

#### Manual Verification:

- The beta-flow checklist passes for `/auth/signin`, `/auth/signup`, `/auth/check-email`, route view with inline climb-log save, and `/historia` with delete controls.
- The delete action shows `Pending` feedback within approximately 300 ms on Slow 4G + 4x CPU and remains visible until row removal or visible error.
- `/historia` passes mobile checks at 375x667, 390x844, and 412x915 with delete confirmation open and closed.
- Response-time observations are recorded for route view and `/historia` without turning the aspirational 800 ms target into a hard gate.
- User A cannot delete or infer the existence of User B's climb row.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering S-05 complete. Phase blocks use plain bullets - the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No automated test runner is configured.
- Future component coverage should exercise inline confirmation, cancel, pending state, success row removal, `not_found` neutral handling, and generic error rendering.
- Future API coverage should exercise invalid payload, unauthenticated user, owned-row delete, and `not_found` behavior.

### Integration Tests:

- `npx astro sync`, `npm run lint`, `npm run guardrails`, and `npm run build` are the automated gates after each phase.
- Manual API smoke should exercise `DELETE /api/climbs` with signed-out, owned-row, and missing-row cases.
- The S-05 UI should be verified against at least two climbs on the same route to prove deletion targets one log entry, not the route summary.

### Manual Testing Steps:

1. Start local Supabase and Astro with valid Supabase and Strapi env values.
2. Sign in and create at least two climb logs for the same route.
3. Open `/historia` and confirm both logs appear as separate rows.
4. Delete one row, confirm inline confirmation and pending feedback, and verify only that row disappears.
5. Refresh `/historia` and confirm the deleted row stays gone.
6. Attempt a stale delete for an already-deleted row and confirm neutral copy.
7. Repeat in a second user/session and confirm User A cannot delete or see User B's climbs.
8. Run the beta-flow checklist on mobile/throttled settings and record the latest run.

## Performance Considerations

S-05 adds no new server reads to `/historia` initial load. The new client-side delete action performs one Supabase hard delete through the existing API route. At beta scale, one React island per history row is acceptable; if histories grow large later, pagination or a single list-level island can be planned separately.

The progress-feedback registry treats the delete mutation as potentially slower than 2 seconds on cellular because it crosses the browser, Worker, Supabase auth/session state, and Supabase delete path.

## Migration Notes

No Supabase migration is expected. Existing `public.climbs` rows are deleted hard by id and current user. Rollback is a code revert of the API/UI/docs changes; any rows deleted during testing are intentionally gone and must be re-logged manually if needed.

## References

- Roadmap S-05: `context/foundation/roadmap.md`
- PRD US-01 and FR-011: `context/foundation/prd.md`
- S-04 route climb log plan: `context/changes/route-climb-log/plan.md`
- Private-state helper: `src/lib/private-state/climbs.ts`
- Climb API route: `src/pages/api/climbs.ts`
- History list: `src/components/climbs/HistoryList.astro`
- Climb UI types: `src/components/climbs/types.ts`
- Progress registry: `docs/verification/progress-feedback-actions.md`
- Beta checklist: `docs/verification/beta-flow-checklist.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete API Contract

#### Automated

- [x] 1.1 Astro types regenerate: `npx astro sync`
- [x] 1.2 Root lint passes: `npm run lint`
- [x] 1.3 Guardrails still pass before UI docs are updated: `npm run guardrails`
- [x] 1.4 Production build passes: `npm run build`
- [x] 1.5 `rg "export const DELETE" src/pages/api/climbs.ts` finds the new handler.
- [x] 1.6 Invalid delete payloads return structured `{ error: { code, message, context } }` JSON.

#### Manual

- [x] 1.7 Signed-out `DELETE /api/climbs` returns structured `unauthenticated` JSON, not an HTML redirect.
- [x] 1.8 Signed-in delete with an owned climb id removes that row from Supabase.
- [x] 1.9 Signed-in delete with an unknown or other-user climb id returns structured `not_found` JSON without leaking ownership details.
- [x] 1.10 Existing `POST /api/climbs` save behavior still works.

### Phase 2: History Delete UI

#### Automated

- [ ] 2.1 Astro types regenerate: `npx astro sync`
- [ ] 2.2 Root lint passes: `npm run lint`
- [ ] 2.3 Guardrails pass after adding S-05 i18n and progress rows: `npm run guardrails`
- [ ] 2.4 Production build passes: `npm run build`
- [ ] 2.5 `rg "from \"@/lib/private-state\"" src/components` returns no React component imports.
- [ ] 2.6 `rg "window.confirm|confirm\\(" src/components/climbs` returns no browser-native confirmation usage.
- [ ] 2.7 `rg "Pending" src/components/climbs` finds the delete pending primitive.

#### Manual

- [ ] 2.8 `/historia` shows a Polish delete control for each climb row.
- [ ] 2.9 Tapping delete opens inline confirmation without navigating away.
- [ ] 2.10 Cancel closes confirmation and leaves the row unchanged.
- [ ] 2.11 Confirm shows visible pending feedback within approximately 300 ms and keeps it visible until completion.
- [ ] 2.12 Successful delete removes only the selected row and leaves other climbs, including other logs for the same route, visible.
- [ ] 2.13 A handled `not_found` response removes the stale row and shows neutral Polish copy.
- [ ] 2.14 If the last row is deleted, the chosen empty-state behavior is clear and not visually broken.
- [ ] 2.15 Mobile viewports 375x667, 390x844, and 412x915 render the delete controls without horizontal scrolling or overlapping tap targets.

### Phase 3: Guardrails + Beta Verification

#### Automated

- [ ] 3.1 Astro types regenerate: `npx astro sync`
- [ ] 3.2 Root lint passes: `npm run lint`
- [ ] 3.3 Guardrails pass with the S-05 delete row shipped: `npm run guardrails`
- [ ] 3.4 Production build passes: `npm run build`
- [ ] 3.5 `docs/verification/progress-feedback-actions.md` includes the climb-log delete action as `shipped`.
- [ ] 3.6 `docs/verification/beta-flow-checklist.md` includes a B2 row for the delete action.

#### Manual

- [ ] 3.7 The beta-flow checklist passes for `/auth/signin`, `/auth/signup`, `/auth/check-email`, route view with inline climb-log save, and `/historia` with delete controls.
- [ ] 3.8 The delete action shows `Pending` feedback within approximately 300 ms on Slow 4G + 4x CPU and remains visible until row removal or visible error.
- [ ] 3.9 `/historia` passes mobile checks at 375x667, 390x844, and 412x915 with delete confirmation open and closed.
- [ ] 3.10 Response-time observations are recorded for route view and `/historia` without turning the aspirational 800 ms target into a hard gate.
- [ ] 3.11 User A cannot delete or infer the existence of User B's climb row.

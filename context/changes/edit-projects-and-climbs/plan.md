# Edit a Logged Climb Implementation Plan

## Overview

Let a signed-in climber **edit** one of their own logged climbs — the climb date (`climbed_on`) and the note — inline on `/historia`. Today the app supports add (S-04) and delete (S-05) but has no edit path. This change adds the missing `updateClimb` helper, a `PATCH /api/climbs` verb, and an inline edit UI built by generalizing the existing `ClimbLogForm` into a create/edit form. The route a climb belongs to is identity, not data, and is **not** editable. **No migration** — the `climbs` table already ships the `climbs_update_own` RLS policy and the `updated_at` trigger.

> Scope note: the original change-id (`edit-projects-and-climbs`) anticipated editing projects too. Projects are pure binary membership (`id, user_id, route_id, created_at` — nothing editable), so the project half was dropped during planning. This plan covers climbs only.

## Current State Analysis

What exists today (verified against the codebase at planning time):

- **Data + privacy (DONE, F-02).** `supabase/migrations/20260531172510_private_user_state.sql` created `public.climbs` (`id`, `user_id`, `route_id` text, `climbed_on` date, `note` text null, `created_at`, `updated_at`) with RLS ON and four per-operation `authenticated` policies — **including `climbs_update_own`** (`for update ... using (auth.uid() = user_id) with check (auth.uid() = user_id)`, lines 90-99). A `set_updated_at()` trigger (`climbs_set_updated_at`, lines 135-151) bumps `updated_at` on every update. The DB is fully ready for owned-row edits; nothing in the app uses it.
- **Server helpers (DONE, S-04/S-05).** `src/lib/private-state/climbs.ts` exports `createClimb`, `listClimbs`, `listClimbsByRoute`, `deleteClimb` — **no `updateClimb`**. `deleteClimb` (lines 134-150) is the template for the update's ownership-scoped, zero-rows-→-`not_found` discipline. The raw `ClimbRow` and `CLIMB_COLUMNS` (lines 17-26) already include `updated_at`.
- **Types (DONE).** `src/lib/private-state/types.ts` has `UserClimb` (incl. `updatedAt`), `CreateClimbInput`, and `PrivateStateErrorCode` (incl. `not_found`). No `UpdateClimbInput`.
- **Mutation API (DONE, S-04/S-05).** `src/pages/api/climbs.ts` is `POST` + `DELETE` only. `STATUS_FOR_CODE` (lines 82-91) already maps every code the PATCH needs (`invalid_input: 400`, `unauthenticated: 401`, `unknown_route: 422`, `not_found: 404`, `missing_config: 503`, `upstream_error`/`unknown: 500`). `climbSchema`, `errorBody`, `resolveErrorMessage` (→ `errors.climbs.*`), and the try/catch `PrivateStateError` plumbing are reusable verbatim. `/api/climbs` is intentionally NOT in `PROTECTED_ROUTES` so islands get a JSON `401`, not a redirect.
- **Create form (DONE, S-04).** `src/components/climbs/ClimbLogForm.tsx` owns `climbedOn` + `note` state, `YYYY-MM-DD` validation, `SubmitButton` progress, and posts `{ routeId, climbedOn, note }`. Props today: `{ routeId, defaultClimbedOn, onSaved, onCancel }`. It imports `SubmitButton` (registered for `guardrails:progress`).
- **History list (DONE, S-05).** `src/components/climbs/HistoryClimbCard.tsx` is the list-level island: owns `items`, per-row `idle → confirming → deleting` state, `not_found`-as-idempotent drop, and a shared success/neutral notice. `HistoryClimbItem` (`src/components/climbs/types.ts:88-96`) already carries `id`, `climbedOn`, and `note` — everything the edit form needs to pre-fill.
- **Page loader (DONE).** `src/pages/historia.astro` projects `listClimbs` rows into `HistoryClimbItem`. Edit is entirely client-side, so this file is **untouched**.
- **Verification harness (DONE).** `docs/verification/progress-feedback-actions.md` lists the climb-log save (`SubmitButton`) and delete (`Pending`) rows; `scripts/check-progress.mjs` asserts the listed file imports the named primitive. `docs/verification/beta-flow-checklist.md` is the manual pass.

What is missing (this plan builds it): the `updateClimb` helper + `UpdateClimbInput` type + index export, the `PATCH /api/climbs` handler + schema, the create/edit generalization of `ClimbLogForm`, the per-row edit state in `HistoryClimbCard`, the `climbs.form.edit_*` / `history.edit.*` i18n keys, and the verification-registry rows.

## Desired End State

A signed-in climber on `/historia` sees an **Edytuj** button on each climb row beside the existing delete control. Clicking it expands the row into a date + note form pre-filled with the climb's current values (the same form component used to log a climb, in edit mode). Saving issues `PATCH /api/climbs`, collapses the row back to its read view showing the updated values, and shows a brief "changes saved" notice (mirroring the delete success-notice model). Validation is identical to the create form (required `YYYY-MM-DD` date, optional note, empty note → `null`, max length, no date-range limits). If the climb no longer exists when the edit is saved (e.g. deleted in another tab), the row drops out of the list with a neutral "already removed" notice. No "edited" badge is shown (`updated_at` is still recorded in the DB). `npm run guardrails`, `lint`, and `build` pass.

Verify by: signing in, opening `/historia`, editing a climb's date and note and confirming the row updates in place with a success notice; clearing a note and saving (→ note disappears); deleting a climb in a second tab then saving an edit in the first (→ row drops with neutral copy); and confirming a signed-out `PATCH /api/climbs` returns JSON `401`.

### Key Discoveries:

- The DB is already update-ready: `climbs_update_own` RLS + `climbs_set_updated_at` trigger exist (`supabase/migrations/20260531172510_private_user_state.sql:90-99, 135-151`). **No migration, no production push.**
- `STATUS_FOR_CODE` and all `errors.climbs.*` messages already cover the PATCH's failure surface (`src/pages/api/climbs.ts:82-91, 100-123`) — the PATCH handler is pure plumbing mirroring `POST`/`DELETE`.
- `deleteClimb` (`src/lib/private-state/climbs.ts:134-150`) is the exact ownership + `not_found` template for `updateClimb`; both scope by `.eq("id", id).eq("user_id", client.userId)` and treat zero rows as `not_found`.
- `HistoryClimbItem` already carries `id`/`climbedOn`/`note` (`src/components/climbs/types.ts:88-96`), so the edit form pre-fills from existing props — the page loader and DTO are unchanged.
- The PATCH payload is `{ id, climbedOn, note }` (no `routeId`) — the route is not editable, so `updateClimb` only writes `climbed_on` + `note` and never re-validates the catalog route.
- Reusing `ClimbLogForm` (which imports `SubmitButton`) keeps the `guardrails:progress` gate satisfied for the edit submit without a new primitive.

## What We're NOT Doing

- **No editing of projects** — projects are binary membership with no editable fields; out of scope (see Overview scope note).
- **No editing the climb's route** — route is identity; a misfiled climb is corrected by delete + re-add.
- **No migration, schema, index, RLS, or trigger change** — F-02 already delivered update support.
- **No edit surface on the crag page** — the crag page (`RouteClimbAction`) shows only a per-route summary count, not individual climbs; edit lives on `/historia` only.
- **No "edited" badge/timestamp** — `updated_at` is recorded but not surfaced in the UI.
- **No future-date restriction** — edit mirrors create's validation exactly (future dates remain allowed, as they are for create today).
- **No dirty-checking** — saving an unchanged form is allowed (sends the PATCH, treated as success).
- **No second locale** — Polish-only, consistent with the rest of the app.

## Implementation Approach

Build bottom-up so each layer has a callable contract beneath it:

1. **Server first** (Phase 1): `updateClimb` helper + `UpdateClimbInput` type + `PATCH /api/climbs`, mirroring `deleteClimb`/`createClimb` and the existing API handlers. After this the contract is callable and testable with no UI.
2. **Client** (Phase 2): generalize `ClimbLogForm` into a `mode: "create" | "edit"` form (the choice the user made over a separate edit form), then add an `editing` row state to `HistoryClimbCard` that mounts the form in edit mode, plus the new i18n keys.
3. **Verification** (Phase 3): register the edit action in the progress-feedback registry and beta checklist, and run the full guardrail/lint/build suite.

The shared form switches endpoint, method, payload, and labels on `mode`; create mode is byte-for-byte the current behavior. The history row owns the edit lifecycle and reconciles its list item from the PATCH response, mirroring how it owns the delete lifecycle today.

## Critical Implementation Details

- **`not_found` semantics differ from delete.** For delete, `not_found` is silently idempotent. For edit, a `not_found` means the target is gone and the user's typed changes cannot land — the row must **drop out of the list with a neutral notice** (not a success). The edit form therefore needs a way to signal "gone" to the parent row distinct from "saved" — an `onGone` path used only in edit mode, separate from `onSaved`.
- **The list owns the edited values, not the row.** `HistoryClimbCard` holds `items` at the list level (so last-row deletes fall through to the empty state). Edits must update that list array (a new `handleUpdated(id, { climbedOn, note })`) so the collapsed row re-renders with the new values — the row must not keep a private mutated copy that diverges from the list.

## Phase 1: `updateClimb` Helper + `PATCH /api/climbs`

### Overview

Add the server-side update path: an `UpdateClimbInput` type, an `updateClimb` helper, its index export, and a `PATCH` handler on `/api/climbs` with a zod schema. After this phase the edit contract is callable and testable via `curl`/devtools, even though no UI consumes it.

### Changes Required:

#### 1. `UpdateClimbInput` type

**File**: `src/lib/private-state/types.ts`

**Intent**: Define the input shape for an update so the helper and API share one contract. Route is not editable, so the input carries only the editable fields.

**Contract**: New `UpdateClimbInput { climbedOn: string; note: string | null }`. Place beside `CreateClimbInput` (lines 48-52). `note` is non-optional `string | null` here (the API normalizes an absent note to `null` before calling the helper).

#### 2. `updateClimb` helper

**File**: `src/lib/private-state/climbs.ts`

**Intent**: Update one owned climb's `climbed_on` + `note` and return the refreshed `UserClimb`. Mirror `deleteClimb`'s ownership scoping and zero-rows-→-`not_found` discipline; do **not** re-validate the route (route is unchanged). `updated_at` is bumped by the existing trigger.

**Contract**: `export async function updateClimb(client: PrivateStateClient, id: string, input: UpdateClimbInput): Promise<UserClimb>`. Implementation: `.from("climbs").update({ climbed_on: input.climbedOn, note: input.note }).eq("id", id).eq("user_id", client.userId).select(CLIMB_COLUMNS)` with the same `overrideTypes<ClimbRow[], { merge: false }>()` pattern as the other helpers. Supabase error → `PrivateStateError("upstream_error", ...)`; zero returned rows → `PrivateStateError("not_found", ...)` (RLS collapses "absent" and "not owned" into one outcome). Map the returned row through the existing `rowToClimb`.

#### 3. Index export

**File**: `src/lib/private-state/index.ts`

**Intent**: Re-export `updateClimb` from the private-state public entrypoint alongside the other climb helpers.

**Contract**: Add `updateClimb` to the existing `export { createClimb, deleteClimb, listClimbs, listClimbsByRoute } from "@/lib/private-state/climbs"` line (line 43).

#### 4. `PATCH /api/climbs` handler + schema

**File**: `src/pages/api/climbs.ts`

**Intent**: Add a `PATCH` verb that edits a climb by id, mirroring the `POST`/`DELETE` handler structure (JSON-only body, zod validation, `createPrivateStateClient`, `PrivateStateError` mapping). Returns the updated climb so the island can reconcile without a re-fetch.

**Contract**:
- New `updateClimbSchema = z.object({ id: z.uuid(), climbedOn: <same YYYY-MM-DD regex as climbSchema>, note: z.string().max(NOTE_MAX_LENGTH).nullish() })`.
- `export const PATCH: APIRoute` mirroring `POST`: parse JSON (invalid → `invalid_input`), `safeParse` (issues → `invalid_input`), build client (catch `PrivateStateError`), then `updateClimb(client, parsed.data.id, { climbedOn: parsed.data.climbedOn, note: parsed.data.note ?? null })` → `jsonResponse({ climb }, 200)`. Errors via the existing `errorBody`/`STATUS_FOR_CODE` (no map change needed — `not_found` already → 404).
- Extend the handler-block doc comment (lines 12-54) to document the `PATCH` contract beside `POST`/`DELETE`.

### Success Criteria:

#### Automated Verification:

- Type checking + lint passes: `npm run lint`
- i18n + progress guardrails pass: `npm run guardrails`
- Build passes: `npm run build`

#### Manual Verification:

- `PATCH /api/climbs` with a valid `{ id, climbedOn, note }` while signed in returns `200 { climb }` with the updated values and a bumped `updatedAt`.
- `PATCH` with a non-existent (but well-formed UUID) `id` returns `404 not_found`.
- `PATCH` with a malformed body / bad date returns `400 invalid_input`.
- `PATCH` while signed out returns `401 unauthenticated` (JSON, not a redirect).

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Inline Edit UI (Shared Form + History Row)

### Overview

Generalize `ClimbLogForm` into a create/edit form, then add a per-row `editing` state to `HistoryClimbCard` that mounts the form in edit mode, reconciles the list on save, drops the row on `not_found`, and shows a success notice. Add the new i18n keys. After this phase the full edit loop is usable on `/historia`.

### Changes Required:

#### 1. Generalize `ClimbLogForm` to create/edit

**File**: `src/components/climbs/ClimbLogForm.tsx`

**Intent**: Support both logging a new climb (current behavior) and editing an existing one, sharing the date/note inputs, validation, `SubmitButton` progress, and error handling. Create mode is unchanged; edit mode pre-fills values, submits `PATCH`, and reports a `not_found` as "gone" rather than an inline error.

**Contract**: Convert `ClimbLogFormProps` to a discriminated union on `mode`:
- `{ mode?: "create"; routeId: string; defaultClimbedOn: string; onSaved: (climb: ClimbResponse) => void; onCancel?: () => void }` — unchanged POST behavior; default when `mode` omitted.
- `{ mode: "edit"; climbId: string; initialClimbedOn: string; initialNote: string | null; onSaved: (climb: ClimbResponse) => void; onGone: () => void; onCancel?: () => void }`.

Behavior keyed on mode:
- Initial state: create seeds `climbedOn = defaultClimbedOn`, `note = ""`; edit seeds `climbedOn = initialClimbedOn`, `note = initialNote ?? ""`.
- Submit: create → `POST { routeId, climbedOn, note }`; edit → `PATCH { id: climbId, climbedOn, note }` (note trimmed; empty → `null`, same as create).
- Input element ids: key by `routeId` (create) or `climbId` (edit) so multiple forms on a page keep unique ids.
- Labels: heading/submit text switch by mode using new keys (`climbs.form.edit_heading`, `climbs.form.edit_submit`); reuse `climbs.form.submit_pending`, `climbs.form.date_label`, `climbs.form.note_label`, `climbs.form.note_placeholder`, validation errors, and `climbs.action.collapse` for cancel.
- Edit-mode `not_found`: when the PATCH error body's `code === "not_found"`, call `onGone()` (do not set the inline `serverMessage`). All other errors keep the existing inline-message behavior.
- Keep `SubmitButton` (do not swap) so `guardrails:progress` stays satisfied.

#### 2. History-row edit lifecycle

**File**: `src/components/climbs/HistoryClimbCard.tsx`

**Intent**: Add an `editing` state to each row with an **Edytuj** button beside delete; mount `ClimbLogForm` in edit mode while editing; on save, update the list item and collapse with a success notice; on `not_found`, drop the row with the neutral notice (reusing the existing removal flow).

**Contract**:
- List level: add `handleUpdated(id, patch: { climbedOn: string; note: string | null })` that maps `items` to the updated values and sets a success notice (`history.edit.success`). Reuse the existing `handleRemoved(id, "already_gone")` for the edit-gone case so the neutral notice path is shared.
- Row level: extend `RowState` with `"editing"`. The idle action area gains an Edit button (`history.edit.button`, e.g. a `Pencil` lucide icon) that sets `state = "editing"` and calls `onActivity()`. When `state === "editing"`, render `<ClimbLogForm mode="edit" climbId={climb.id} initialClimbedOn={climb.climbedOn} initialNote={climb.note} onSaved={...} onGone={...} onCancel={() => setState("idle")} />` in place of the read/delete controls.
- `onSaved(updated)` → call `onUpdated(climb.id, { climbedOn: updated.climbedOn, note: updated.note })` then `setState("idle")`. `onGone()` → call `onRemoved(climb.id, "already_gone")`.
- Pass a new `onUpdated` prop from the list into `ClimbRow` (mirrors `onRemoved`).

#### 3. Edit i18n keys

**File**: `src/i18n/ui.ts`

**Intent**: Add the Polish copy for the edit form labels and the history-row edit action/notice, mirroring the `climbs.form.*` and `history.delete.*` families.

**Contract**: New keys:
- `climbs.form.edit_heading` ("Edytuj przejście"), `climbs.form.edit_submit` ("Zapisz zmiany").
- `history.edit.button` ("Edytuj"), `history.edit.success` ("Zmiany zostały zapisane.").
(The edit-gone case reuses `history.delete.already_gone`; PATCH server errors reuse `errors.climbs.*`.) Adding keys to the single dictionary extends the `UiKey` union automatically; ensure each new key is referenced so `guardrails:i18n` finds no orphans.

### Success Criteria:

#### Automated Verification:

- Lint + type check passes: `npm run lint`
- Server-only boundary holds (form/island do not import private-state): `rg "from \"@/lib/private-state\"" src/components` returns no matches
- i18n + progress guardrails pass: `npm run guardrails`
- Build passes: `npm run build`

#### Manual Verification:

- On `/historia`, clicking **Edytuj** opens a pre-filled date+note form; saving updates the row in place and shows the "changes saved" notice without navigation.
- Clearing the note and saving removes the note from the row; editing the date updates the displayed date.
- Cancel discards changes and returns the row to its read view.
- With a climb deleted in another tab, saving an edit drops the row with the neutral "already removed" notice.
- No horizontal scroll at 375px with the edit form open in a row.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Verification Registry + Guardrails

### Overview

Register the new edit action in the progress-feedback source of truth and the beta-flow checklist, then run the full guardrail/lint/build suite and the manual beta pass for the edit flow.

### Changes Required:

#### 1. Progress-feedback registry

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Record the climb-log edit as a >2 s action so `scripts/check-progress.mjs` and the manual checklist cover it.

**Contract**: Add a `shipped` row "Climb-log edit (personal history)" → `src/components/climbs/ClimbLogForm.tsx` → `SubmitButton` (the edit submit reuses the same form/primitive, which the guard already asserts is imported). Rationale column notes the `PATCH /api/climbs` round-trip.

#### 2. Beta-flow checklist

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: Add an edit-climb manual verification line to the climb-log flow section so the pre-beta walkthrough exercises it (mobile, Polish copy, >2 s progress feedback, response time).

**Contract**: Add a checklist row for editing a climb on `/historia` consistent with the existing add/delete rows in that section.

### Success Criteria:

#### Automated Verification:

- Full guardrails pass: `npm run guardrails`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- The beta-flow checklist is walked end-to-end for the edit flow and passes (mobile layout, Polish copy, progress feedback within ~300 ms, acceptable response time).

**Implementation Note**: After automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

No automated test runner is configured in this repo; verification is the guardrail scripts + manual checklist.

### Static / guardrail checks:

- `npm run lint` (type-checked ESLint)
- `npm run guardrails` (i18n coverage + >2 s progress-feedback registry)
- `npm run build`
- `rg "from \"@/lib/private-state\"" src/components` stays empty (server-only boundary)

### Manual testing steps:

1. Sign in; on `/historia` edit a climb's date and note; confirm the row updates in place with the success notice.
2. Clear the note and save; confirm the note row disappears.
3. Open the edit form and Cancel; confirm no change and return to read view.
4. Save an unchanged form; confirm it succeeds and collapses (no-op allowed).
5. Delete the climb in a second tab, then save an edit in the first; confirm the row drops with the neutral "already removed" notice.
6. Sign out; `PATCH /api/climbs`; confirm a JSON `401` (not an HTML redirect).
7. Check 375px viewport: no horizontal scroll with the edit form expanded in a row.

## Performance Considerations

Edit is a single `UPDATE ... where id = ? and user_id = ?` returning one row — served by the table's primary key, no extra round-trips, no catalog re-validation (route unchanged). The history page loader is untouched.

## Migration Notes

None — `20260531172510_private_user_state.sql` already provides the `climbs_update_own` RLS policy and the `climbs_set_updated_at` trigger. No production Supabase push is required for this change.

## References

- DB contract: `supabase/migrations/20260531172510_private_user_state.sql:20-28, 90-99, 135-151`
- Update template (delete sibling): `src/lib/private-state/climbs.ts:134-150`
- API handlers to mirror: `src/pages/api/climbs.ts:59-91, 135-240`
- Create form to generalize: `src/components/climbs/ClimbLogForm.tsx`
- History list island: `src/components/climbs/HistoryClimbCard.tsx`
- Client DTOs: `src/components/climbs/types.ts:28-96`
- i18n families: `src/i18n/ui.ts` (`climbs.form.*`, `history.delete.*`, `errors.climbs.*`)
- Verification: `docs/verification/progress-feedback-actions.md:42-49`, `docs/verification/beta-flow-checklist.md`
- Sibling plan (same patterns): `context/changes/personal-projects-list/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: updateClimb Helper + PATCH /api/climbs

#### Automated

- [x] 1.1 Type checking + lint passes: `npm run lint`
- [x] 1.2 i18n + progress guardrails pass: `npm run guardrails`
- [x] 1.3 Build passes: `npm run build`

#### Manual

- [x] 1.4 PATCH with valid body returns 200 `{ climb }` with updated values + bumped updatedAt
- [x] 1.5 PATCH with non-existent UUID returns 404 `not_found`
- [x] 1.6 PATCH with malformed body / bad date returns 400 `invalid_input`
- [x] 1.7 PATCH signed out returns JSON 401 `unauthenticated`

### Phase 2: Inline Edit UI (Shared Form + History Row)

#### Automated

- [ ] 2.1 Lint + type check passes: `npm run lint`
- [ ] 2.2 Server-only boundary holds: `rg "from \"@/lib/private-state\"" src/components` empty
- [ ] 2.3 i18n + progress guardrails pass: `npm run guardrails`
- [ ] 2.4 Build passes: `npm run build`

#### Manual

- [ ] 2.5 Edytuj opens a pre-filled form; save updates the row in place with success notice
- [ ] 2.6 Clearing the note removes it; editing the date updates the displayed date
- [ ] 2.7 Cancel discards changes and returns to read view
- [ ] 2.8 Climb deleted elsewhere → saving an edit drops the row with neutral notice
- [ ] 2.9 No horizontal scroll at 375px with the edit form open

### Phase 3: Verification Registry + Guardrails

#### Automated

- [ ] 3.1 Full guardrails pass: `npm run guardrails`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Beta-flow checklist walked end-to-end for the edit flow and passes

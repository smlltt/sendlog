# Progress-feedback actions (>2-second cases)

This document is the single source of truth for which user-initiated actions
in the climb-log + auth + route-view flow are designated as ">2 seconds on
cellular" and therefore must show one of the three agreed primitives
within ~300 ms of the trigger.

It is consumed by:

- **`scripts/check-progress.mjs`** — the static guard run by
  `npm run guardrails:progress`. For each row whose file exists today and
  whose Status is `shipped`, the guard asserts that the listed file imports
  the named primitive.
- **`docs/verification/beta-flow-checklist.md`** (Phase 3) — the manual
  pre-beta checklist walks through every `shipped` row to visually confirm
  the primitive appears within ~300 ms and stays until completion.

## How to read the Status column

- `shipped` — the file exists in the repo today; the row is checked on every
  CI run.
- `planned: <slice-id>` — the file does not exist yet; the row is skipped
  by the guard until the named roadmap slice lands, at which point flipping
  Status to `shipped` switches the gate on. No code change required.
- `n/a — <reason>` — the file exists but the action ships without a deferred
  loading state (e.g. fully server-rendered initial paint). The guard skips
  the row; the reason is recorded so the row is not mistaken for stale
  `planned` debt. Flip to `shipped` if a future variant adopts an
  initial-load primitive in the listed file.

## The agreed primitives

| Primitive      | Location                                   | Use when                                                      |
| -------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `SubmitButton` | `src/components/auth/SubmitButton.tsx`     | The action is a form submit (uses `useFormStatus` lifecycle). |
| `Pending`      | `src/components/ui/Pending.tsx`            | Non-form pending UI (deferred fetch, mutation in flight).     |
| `Skeleton`     | `src/components/ui/Skeleton.tsx`           | Initial load placeholder that matches expected content shape. |

## Actions

| Action                              | File(s)                                              | Primitive      | Rationale                                                                  | Status                       |
| ----------------------------------- | ---------------------------------------------------- | -------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Magic-link request                  | `src/components/auth/MagicLinkForm.tsx`              | `SubmitButton` | Form submit lifecycle; may exceed 2 s on cellular while Supabase ack.       | `shipped`                    |
| Climb-log save                      | `src/components/climbs/ClimbLogForm.tsx`             | `SubmitButton` | Form submit; same pattern, hits Supabase + Strapi route lookup.             | `shipped`                    |
| Climb-log edit (personal history)   | `src/components/climbs/ClimbLogForm.tsx`             | `SubmitButton` | Form submit reusing the same form/primitive; `PATCH /api/climbs` round-trip can exceed 2 s on cellular. | `shipped`                    |
| Climb-log delete (personal history) | `src/components/climbs/HistoryClimbCard.tsx`         | `Pending`      | `DELETE /api/climbs` mutation; Worker + Supabase session + hard delete can exceed 2 s on cellular. | `shipped`                    |
| Personal history initial load       | `src/pages/historia.astro`                           | `Skeleton`     | Server-rendered today; row is parked so any future deferred-loading variant lands the skeleton in this same file. | `n/a — server-rendered`      |
| Projects list initial load          | `src/pages/projekty.astro`                           | `Skeleton`     | Server-rendered today; row is parked so any future deferred-loading variant lands the skeleton in this same file. | `n/a — server-rendered`      |
| Projects add/remove toggle (crag row) | `src/components/projects/ProjectAction.tsx`        | `Pending`      | `POST`/`DELETE /api/projects` mutation from the crag-row toggle; Worker + Supabase session can exceed 2 s on cellular. | `shipped`                    |
| Projects list remove                | `src/components/projects/ProjectsListCard.tsx`       | `Pending`      | `DELETE /api/projects` mutation from the `/projekty` list; same hard-delete round-trip as the climb-log delete. | `shipped`                    |

## Adding a new action

1. Identify the file that owns the action (form component, page, island).
2. Import the right primitive from the table above.
3. Add a row here with `Status: shipped`.
4. Re-run `npm run guardrails:progress` locally; expect zero violations.
5. In the next pre-beta cycle, the manual checklist walkthrough will exercise
   the new row automatically.

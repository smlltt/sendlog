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

## The agreed primitives

| Primitive      | Location                                   | Use when                                                      |
| -------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `SubmitButton` | `src/components/auth/SubmitButton.tsx`     | The action is a form submit (uses `useFormStatus` lifecycle). |
| `Pending`      | `src/components/ui/Pending.tsx`            | Non-form pending UI (deferred fetch, mutation in flight).     |
| `Skeleton`     | `src/components/ui/Skeleton.tsx`           | Initial load placeholder that matches expected content shape. |

## Actions

| Action                              | File(s)                                              | Primitive      | Rationale                                                                 | Status            |
| ----------------------------------- | ---------------------------------------------------- | -------------- | ------------------------------------------------------------------------- | ----------------- |
| Magic-link request                  | `src/components/auth/MagicLinkForm.tsx`              | `SubmitButton` | Form submit lifecycle; may exceed 2 s on cellular while Supabase ack.      | `shipped`         |
| Climb-log save                      | `src/components/climbs/ClimbLogForm.tsx`             | `SubmitButton` | Form submit; same pattern, hits Supabase + Strapi route lookup.            | `planned: S-04`   |
| Personal history initial load       | `src/pages/historia.astro`                           | `Skeleton`     | Server-fetched climb list may exceed 2 s on cellular; show row shapes.    | `planned: S-04`   |
| Projects list initial load          | `src/pages/projekty.astro`                           | `Skeleton`     | Server-fetched project list; same initial-paint situation as history.     | `planned: S-06`   |

## Adding a new action

1. Identify the file that owns the action (form component, page, island).
2. Import the right primitive from the table above.
3. Add a row here with `Status: shipped`.
4. Re-run `npm run guardrails:progress` locally; expect zero violations.
5. In the next pre-beta cycle, the manual checklist walkthrough will exercise
   the new row automatically.

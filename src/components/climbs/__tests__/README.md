# Climbs UI module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to
satisfy the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`)
and to record the test surface that should be covered once a runner is
added — Vitest plus React Testing Library is the likely candidate given
the Vite/Astro toolchain. See `src/lib/private-state/__tests__/README.md`
and `src/components/auth/__tests__/README.md` for matching precedents.

End-to-end verification of the S-04 flow today is the manual smoke list
in `context/changes/route-climb-log/plan.md` Phase 2 plus the matching
rows in `docs/verification/beta-flow-checklist.md`.

## `ClimbLogForm` (`ClimbLogForm.tsx`)

- Default render uses the `defaultClimbedOn` prop verbatim — no
  `new Date().toISOString().slice(0, 10)` inside the component. The
  parent computes today's UTC date server-side via `formatDate(new Date())`
  so that server-rendered HTML and the hydrated client agree.
- Saving with a valid date and an empty note posts
  `{ routeId, climbedOn, note: null }` (empty string → `null`), receives
  201, and calls `onSaved(climb)` exactly once with the server-returned
  row.
- Saving with a valid date and a non-empty note trims whitespace before
  posting; an all-whitespace note becomes `null`.
- An empty `climbedOn` shows `t("climbs.form.error_date_required")` and
  does NOT issue a fetch.
- A date that does not match `^\d{4}-\d{2}-\d{2}$` shows
  `t("climbs.form.error_date_invalid")` and does NOT issue a fetch.
- A 4xx response from `/api/climbs` surfaces `error.message` from the
  structured body as an inline alert; the form stays open and pending
  is cleared.
- A 5xx response surfaces the same way (the API endpoint always returns
  the structured `{ error: { code, message, context } }` shape).
- A `fetch` rejection (e.g. offline) surfaces
  `t("climbs.form.error_network")` and clears the pending state.

## `RouteClimbAction` (`RouteClimbAction.tsx`)

- `count === 0` renders the "no climbs yet" hint and the "log climb"
  button as the collapsed state.
- `count > 0` renders the pluralized count and the latest climb date in
  Polish; clicking the row's primary action expands the form to log
  another climb (FR-009: multiple climbs per route are supported).
- After `onSaved`, the internal summary state increments `count`,
  updates `latestClimbedOn` to the returned row's `climbedOn` if it is
  later (or the row is the first), and collapses the form back to the
  indicator. No page navigation.
- The component never imports `@/lib/private-state`. The only path back
  to the server is the form's `POST /api/climbs` call.

## `/api/climbs` (`src/pages/api/climbs.ts`)

- `POST` with valid `{ routeId, climbedOn }` and no note → 201 with
  `{ climb: UserClimb }` mirroring the helper return.
- `POST` with malformed JSON → 400 with
  `{ error: { code: "invalid_input", message, context: { reason } } }`.
- `POST` with missing `routeId` → 400 with
  `{ error: { code: "invalid_input", ..., context: { issues } } }`
  including the zod path "routeId".
- `POST` with a `climbedOn` like `"06/02/2026"` or `"2026-6-2"` → 400
  (the regex requires `^\d{4}-\d{2}-\d{2}$`).
- `POST` while signed out → 401 with `code: "unauthenticated"`. The
  endpoint is NOT wrapped by `PROTECTED_ROUTES` because we want a JSON
  response, not an HTML sign-in redirect.
- `POST` with an unknown `routeId` → 422 with `code: "unknown_route"`.
- Supabase env unset → 503 with `code: "missing_config"`.
- Any other server failure → 500 with `code: "upstream_error"` or
  `code: "unknown"`; raw Supabase / Strapi error text never appears in
  `message` — only in `context` for server logs.
- Response headers always set `Content-Type: application/json; charset=utf-8`.

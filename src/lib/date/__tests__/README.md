# Date module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to
satisfy the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`)
and to record the test surface that should be covered once a runner is
added — Vitest is the likely candidate given the Vite/Astro toolchain. See
`src/lib/auth/__tests__/README.md` and
`src/lib/private-state/__tests__/README.md` for matching precedents.

End-to-end verification of the UTC contract today is the manual smoke list
in `context/changes/route-climb-log/plan.md` Phase 2 (`climbed_on` defaults
to today's UTC `YYYY-MM-DD` value) plus the `npx astro sync` / lint /
guardrails / build chain.

## `formatDate(input)` (`index.ts`)

- `formatDate(new Date("2026-06-02T00:00:00Z"))` → `"2026-06-02"`
  (happy path; today's UTC calendar date for a climb default).
- `formatDate(new Date("2026-06-02T08:00:00Z"))` → `"2026-06-02"`
  (the `YYYY-MM-DD` slice ignores time-of-day; both 00:00Z and 08:00Z on
  the same UTC day map to the same date).
- `formatDate(new Date("2026-06-02T22:00:00-04:00"))` → `"2026-06-03"`
  (timezone boundary: a local time that crosses midnight UTC must land on
  the next UTC day, not the previous local day).
- `formatDate(new Date("2026-06-02T01:00:00+04:00"))` → `"2026-06-01"`
  (symmetric timezone boundary: a local time east of UTC that crosses
  back across midnight UTC must land on the previous UTC day).
- `formatDate("2026-06-02")` → `"2026-06-02"` (already-formatted string
  round-trips unchanged; protects Supabase `date`-column values from
  silent UTC normalization on read-back).
- `formatDate("2026-06-02T08:00:00Z")` → `"2026-06-02"` (full ISO
  timestamp string is coerced through `new Date(...)` and sliced).
- `formatDate(1748822400000)` → `"2026-06-02"` (numeric milliseconds
  input, matching `Date.now()` / Supabase `created_at_ms` shapes).
- `formatDate("not-a-date")` → throws `RangeError("formatDate: invalid date input")`.
- `formatDate(NaN)` → throws `RangeError("formatDate: invalid date input")`
  (defensive floor; production call sites should validate input before
  this helper, e.g. zod on the API route).

## Known follow-ups (out of scope for v1)

- A `parseUtcDate(input)` companion that returns a `Date` instead of a
  string, for cases where the caller needs to do arithmetic before
  display. The S-04 flow only writes the date through to Supabase and
  reads it back as a string, so the helper is not needed yet.
- Internationalized display formatting (e.g. "2 czerwca 2026" instead of
  `2026-06-02`) for history rows that want a friendlier label. Deferred
  until a second locale lands; until then, the `YYYY-MM-DD` shape is
  unambiguous and locale-neutral.

/**
 * Date module — public entrypoint.
 *
 * The repo rule in `AGENTS.md` mandates UTC for all date operations and
 * forbids ad hoc `new Date().toISOString().slice(0, 10)` calls in UI or
 * server code. `formatDate()` is the single helper every caller should
 * route through.
 *
 * Contract
 *
 * - Returns a `YYYY-MM-DD` UTC date string.
 * - Suitable for Postgres `date` columns (e.g. `climbs.climbed_on`) and
 *   for the HTML `<input type="date">` value attribute (both expect the
 *   same `YYYY-MM-DD` shape).
 * - String inputs that already look like a `YYYY-MM-DD` UTC date are
 *   returned unchanged so callers can safely pass round-trip values from
 *   Supabase back through the helper without losing precision or shifting
 *   them across a timezone boundary.
 * - All other inputs are coerced through `new Date(input)` and rendered
 *   via `toISOString().slice(0, 10)` to guarantee UTC. We intentionally
 *   do NOT use `toLocaleDateString` — that would format in the runtime's
 *   local timezone and silently break for users in non-UTC zones.
 *
 * Throws
 *
 * - `RangeError("formatDate: invalid date input")` if the coerced `Date`
 *   is `Invalid Date` (e.g. `formatDate("not-a-date")`). Callers should
 *   validate user input (e.g. zod) before passing it here; the throw is
 *   a defensive floor for misuse, not a user-facing error path.
 */

import type { FormatDateInput } from "@/lib/date/types";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(input: FormatDateInput): string {
  // Short-circuit a string that already conforms to `YYYY-MM-DD`. Routing
  // it through `new Date(...).toISOString()` would re-interpret it as
  // midnight UTC and then re-serialize — correct, but a no-op that the
  // call site can skip. More importantly, it avoids a tiny rounding
  // surface for edge inputs and keeps Supabase round-trip values stable.
  if (typeof input === "string" && DATE_ONLY_PATTERN.test(input)) {
    return input;
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("formatDate: invalid date input");
  }
  return date.toISOString().slice(0, 10);
}

export type { FormatDateInput } from "@/lib/date/types";

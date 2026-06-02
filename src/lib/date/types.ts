/**
 * Date module — public types.
 *
 * The single accepted input type for `formatDate(...)`. Keeping it as an
 * alias here (rather than inlining `Date | string | number` at every call
 * site) lets future code distinguish "a value that `formatDate()` can
 * normalize" from arbitrary date-ish inputs that need extra parsing or
 * timezone handling first.
 *
 * - `Date` — the common case (e.g. `formatDate(new Date())` for today's
 *   UTC calendar date).
 * - `string` — ISO 8601 strings or other forms accepted by the `Date`
 *   constructor (e.g. `"2026-06-02T08:00:00Z"`). Strings that already look
 *   like a `YYYY-MM-DD` UTC date are returned unchanged.
 * - `number` — milliseconds since the Unix epoch (e.g.
 *   `formatDate(climbRow.created_at_ms)`).
 */
export type FormatDateInput = Date | string | number;

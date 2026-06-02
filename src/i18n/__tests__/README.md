# `src/i18n/__tests__` — intended coverage

No test runner is configured in this repo (see [`AGENTS.md`](../../../AGENTS.md) and [`package.json`](../../../package.json)). This directory exists to satisfy the repo module-structure rule (`index.ts`, `types.ts` or equivalent, `__tests__/`) and to record the test surface that should be covered once a runner is added — Vitest is the likely candidate given the Vite/Astro toolchain.

The runtime side of this module is intentionally tiny (the lookup is one object access plus an optional `replaceAll` loop) so the testable surface is small and mostly about invariants you'd otherwise rely on TypeScript to enforce.

## `getTranslations` (`utils.ts`)

- `getTranslations()` defaults to `defaultLang` (`"pl"`). Returned `t(key)` returns the matching string from `ui.pl`.
- `getTranslations("pl")` returns the same lookup as the default-args case (no fork).
- `t("auth.signin.heading")` returns the Polish heading verbatim (regression sentinel: prevents accidental dictionary trimming).
- `t("…")` is typed as `(key: UiKey) => string`. A nonexistent key (e.g. `t("auth.signin.no_such_key")`) is a compile-time error — there is no runtime fallback because we intentionally do not want to ship missing-translation strings to users.

The Astro i18n recipe calls this helper `useTranslations`, but the `use*` prefix is reserved for React Hooks. Calling a `use*` function in Astro frontmatter or any non-component module is blocked by `react-hooks/rules-of-hooks` — `getTranslations` keeps the same signature without colliding with the hook convention.

## `format` (`utils.ts`)

- `format("{count} skały", { count: 3 })` → `"3 skały"`.
- `format("Zdjęcie {n} z {m}", { n: 1, m: 5 })` → `"Zdjęcie 1 z 5"`.
- `format("brak placeholderów", { count: 1 })` → `"brak placeholderów"` (no-op when the template has no placeholders).
- `format("{count} {count}", { count: 3 })` → `"3 3"` (`replaceAll`, not `replace`; both occurrences substituted).
- Missing param (`format("{count}", {})`) returns the template unchanged. Intentional: silent passthrough beats throwing in a UI render path; the static guard catches the literal `{count}` if it ever ships to a user-facing string.

## Single-locale invariant

- The dictionary has exactly one top-level key (`pl`). When a second locale is added (e.g. `en`), the same key set must exist on the new branch — TypeScript's `as const` plus `UiKey = keyof ui.pl` will surface any missing key as a build error in every call site that uses it.

## Dictionary completeness

- Every `t("…")` call site in the codebase resolves to a key that exists in `ui.pl`. This is enforced at the type level today; once a runner lands, a sweep test that grep-extracts every `t("…")` from `src/**` and asserts the key set matches `Object.keys(ui.pl)` will catch dictionary entries that have lost their last consumer (dead translations).

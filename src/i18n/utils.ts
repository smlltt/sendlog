/**
 * Translation helper — mirrors the official Astro i18n recipe
 * (https://docs.astro.build/en/recipes/i18n/) in single-locale form.
 *
 * `getTranslations(lang?)` returns a typed `t(key)` lookup against `ui[lang]`.
 * With only one locale today, `lang` defaults to `defaultLang` and the
 * function collapses to a flat object access — O(1), zero overhead, callable
 * identically from `.astro` frontmatter, React islands, and `.ts` helpers.
 *
 * Naming deviation from the Astro recipe: the recipe exports
 * `useTranslations`, but the `use*` prefix is reserved in React-land for
 * Hooks. `react-hooks/rules-of-hooks` blocks calling a `use*` function at
 * the top level of an Astro frontmatter or server module — exactly where
 * our callers live. `getTranslations` is the closest neutral name that
 * keeps the signature identical to the recipe.
 *
 * Parameter interpolation (e.g. `{count}`, `{n}`, `{m}`) is intentionally
 * left as a thin call-site concern; for one locale a regex-replace inside a
 * small per-namespace helper (see `pluralizeCrags` in
 * `src/components/catalog/CragMapSection.astro`) is plenty without pulling in
 * a format library. When a second locale lands, swap in an ICU-style helper
 * in one place.
 */

import { defaultLang, ui, type UiKey, type UiLang } from "@/i18n/ui";

export type TranslateFn = (key: UiKey) => string;

export function getTranslations(lang: UiLang = defaultLang): TranslateFn {
  const dict = ui[lang];
  return (key) => dict[key];
}

/**
 * Substitute `{name}` placeholders in a translated string. Kept small and
 * locale-agnostic on purpose; consumers that need plural rules wrap this in
 * a per-domain helper rather than encoding rule families here.
 */
export function format(template: string, params: Record<string, string | number>): string {
  let out = template;
  for (const [name, value] of Object.entries(params)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

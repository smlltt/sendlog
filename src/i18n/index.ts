/**
 * i18n module — public entrypoint.
 *
 * Single-locale Polish today. Consumers import `getTranslations` to obtain a
 * typed `t(key)` and (when needed) `format(template, params)` for
 * placeholder substitution. The dictionary itself lives in `./ui` and is the
 * source of truth enforced by `scripts/check-i18n.mjs`.
 */

export { defaultLang, type UiKey, type UiLang } from "@/i18n/ui";
export { getTranslations, format, type TranslateFn } from "@/i18n/utils";

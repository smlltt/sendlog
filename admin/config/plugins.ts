import type { Core } from '@strapi/strapi';

// Strapi 5 ships i18n in core, so an explicit `enabled: true` block is unnecessary.
// The locale catalog (which locales exist + which is default) lives in the database
// and is seeded by `src/index.ts#bootstrap` plus the `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE`
// env var on first boot. See `.env.example`.
const config = ({ env: _env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({});

export default config;

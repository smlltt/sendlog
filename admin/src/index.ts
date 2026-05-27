import type { Core } from '@strapi/strapi';

const CATALOG_DEFAULT_LOCALE = 'pl';

const CATALOG_LOCALES = [
  { code: 'pl', name: 'Polski (pl)' },
  { code: 'en', name: 'English (en)' },
] as const;

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureCatalogLocales(strapi);
    await ensureDefaultCatalogLocale(strapi);
  },
};

async function ensureCatalogLocales(strapi: Core.Strapi) {
  // Use the lower-level db query rather than the i18n service to avoid the
  // admin-permission-sync validation error that surfaces when locales are
  // created from bootstrap. See https://github.com/strapi/strapi/issues/13244
  // and https://github.com/strapi/strapi/issues/20253.
  const localeQuery = strapi.db.query('plugin::i18n.locale');

  for (const { code, name } of CATALOG_LOCALES) {
    try {
      const existing = await localeQuery.findOne({ where: { code } });
      if (existing) continue;

      await localeQuery.create({ data: { code, name } });
      strapi.log.info(`[catalog] Seeded i18n locale: ${code}`);
    } catch (error) {
      strapi.log.warn(
        `[catalog] Failed to seed locale ${code}: ${(error as Error).message}. ` +
          `Add it manually in Settings → Internationalization if needed.`
      );
    }
  }
}

async function ensureDefaultCatalogLocale(strapi: Core.Strapi) {
  // The default locale lives in the plugin store under `default_locale`, not on
  // the locale row itself (Strapi 5 dropped the `isDefault` column). We enforce
  // `pl` as the catalog default per the catalog content contract; admins can
  // still flip it via Settings → Internationalization but it will revert on
  // restart until that decision is reflected here.
  const pluginStore = strapi.store({ environment: '', type: 'plugin', name: 'i18n' });
  const currentDefault = (await pluginStore.get({ key: 'default_locale' })) as string | undefined;

  if (currentDefault === CATALOG_DEFAULT_LOCALE) return;

  try {
    await pluginStore.set({ key: 'default_locale', value: CATALOG_DEFAULT_LOCALE });
    strapi.log.info(
      `[catalog] Set default i18n locale to ${CATALOG_DEFAULT_LOCALE} (was: ${currentDefault ?? 'unset'})`
    );
  } catch (error) {
    strapi.log.warn(
      `[catalog] Failed to set default locale: ${(error as Error).message}. ` +
        `Set it manually in Settings → Internationalization.`
    );
  }
}

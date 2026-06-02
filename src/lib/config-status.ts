import { SUPABASE_URL, SUPABASE_KEY, STRAPI_API_URL, STRAPI_API_TOKEN } from "astro:env/server";
import { getTranslations } from "@/i18n";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

const t = getTranslations();

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: t("errors.config.supabase_missing"),
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: t("errors.config.supabase_docs_label"),
  },
  {
    name: "Strapi",
    configured: Boolean(STRAPI_API_URL && STRAPI_API_TOKEN),
    message: t("errors.config.strapi_missing"),
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);

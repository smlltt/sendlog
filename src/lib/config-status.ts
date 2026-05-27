import { SUPABASE_URL, SUPABASE_KEY, STRAPI_API_URL, STRAPI_API_TOKEN } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "Strapi",
    configured: Boolean(STRAPI_API_URL && STRAPI_API_TOKEN),
    message: "Strapi nie jest skonfigurowany — katalog (regiony, skały, drogi) jest niedostępny.",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);

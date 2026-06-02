/**
 * Polish (single-locale) UI dictionary — the source of truth for every visible
 * string in the climb-log + auth + route-view flow.
 *
 * Follows the official Astro i18n recipe
 * (https://docs.astro.build/en/recipes/i18n/) in a deliberately minimal
 * shape: one locale, no routing layer, flat namespaced keys with TypeScript
 * literal types so `t("…")` autocompletes and typos fail the build.
 *
 * Conventions
 *
 * - Namespaces (dot-separated): `auth.*`, `catalog.*`, `common.*`, `errors.*`.
 * - Values are plain strings. Runtime interpolation (e.g. `{count}` in plural
 *   helpers, `{n}`/`{m}` in numbered photo captions) is performed at the call
 *   site via simple `String.prototype.replace`; we intentionally avoid a
 *   format-library dependency for one locale.
 * - Adding a second locale later means defining the same key set under a new
 *   top-level key (e.g. `en`) and widening `defaultLang`. No call sites need
 *   to change because `t(key)` already takes a typed key off `ui.pl`.
 *
 * The static guard in `scripts/check-i18n.mjs` enforces that user-facing
 * files in the audited scope route their visible strings through `t()` and
 * therefore through this file.
 */

export const defaultLang = "pl" as const;

export const ui = {
  pl: {
    // Common / chrome
    "common.app_title": "SendLog — katalog polskich rejonów wspinaczkowych",
    "common.loading": "Ładowanie",
    "common.notice_label": "Uwaga:",
    "common.docs_link_default": "Dokumentacja",

    // Homepage
    "home.page_title": "SendLog",
    "home.heading": "SendLog",
    "home.lead": "Polski katalog wspinaczkowych rejonów.",
    "home.body":
      "Przeglądaj rejony, skały i trasy bez zakładania konta. Treść jest publikowana przez administratora i widoczna dla każdego, kto chce zaplanować wyjazd albo poznać polskie skały.",
    "home.map_link": "Zobacz skały na mapie",

    // 404
    "not_found.page_title": "Nie znaleziono strony",
    "not_found.heading": "Nie znaleziono",
    "not_found.body": "Wygląda na to, że ta strona nie istnieje albo została przeniesiona.",
    "not_found.home_link": "Wróć na stronę główną",
    "not_found.regions_link": "Przejdź do rejonów",

    // Dashboard
    "dashboard.page_title": "Panel",
    "dashboard.heading": "Panel",
    "dashboard.welcome": "Witaj",
    "dashboard.auth_only": "Ta strona jest dostępna tylko dla zalogowanych użytkowników.",
    "dashboard.signout": "Wyloguj",

    // Auth — /auth/signin
    "auth.signin.page_title": "Zaloguj się",
    "auth.signin.heading": "Zaloguj się w SendLog",
    "auth.signin.intro":
      "Podaj swój adres email, a wyślemy Ci jednorazowy link logowania. Nowy użytkownik? Konto utworzymy automatycznie.",
    "auth.signin.email_label": "Email",
    "auth.signin.email_required": "Email jest wymagany",
    "auth.signin.email_invalid": "Podaj prawidłowy adres email",
    "auth.signin.submit": "Wyślij link logowania",
    "auth.signin.submit_pending": "Wysyłanie linku…",

    // Auth — /auth/check-email
    "auth.check_email.page_title": "Sprawdź swoją skrzynkę",
    "auth.check_email.heading": "Sprawdź swoją skrzynkę",
    "auth.check_email.body":
      "Właśnie wysłaliśmy link logowania. Otwórz go na tym urządzeniu, aby dokończyć logowanie. Link jest jednorazowy i wkrótce wygaśnie.",
    "auth.check_email.retry_link": "Nie dotarł email? Poproś o kolejny link",

    // Auth — server-resolved error messages (keyed by AuthErrorCode)
    "errors.auth.missing_config": "Logowanie jest chwilowo niedostępne. Spróbuj ponownie później.",
    "errors.auth.invalid_email": "Podaj prawidłowy adres email.",
    "errors.auth.magic_link_failed": "Nie udało się wysłać linku logowania. Spróbuj ponownie.",
    "errors.auth.invalid_or_expired_link": "Ten link logowania jest nieprawidłowy lub wygasł. Poproś o nowy poniżej.",

    // Config-status banner (Layout)
    "errors.config.supabase_missing": "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    "errors.config.supabase_docs_label": "Zobacz instrukcję konfiguracji",
    "errors.config.strapi_missing":
      "Strapi nie jest skonfigurowany — katalog (regiony, skały, drogi) jest niedostępny.",

    // Catalog — crag page
    "catalog.crag.coordinates_label": "Współrzędne",
    "catalog.crag.routes_heading": "Trasy",
    "catalog.crag.error_page_title": "Błąd",
    "catalog.crag.load_error_heading": "Nie udało się załadować crągu",
    "catalog.crag.region_fallback": "Rejon",
    "catalog.crag.open_routes": "Otwórz trasy",

    // Catalog — region page
    "catalog.region.crags_heading": "Skały w tym rejonie",
    "catalog.region.empty": "Brak opublikowanych skał w tym rejonie.",
    "catalog.region.error_page_title": "Błąd",
    "catalog.region.load_error_heading": "Nie udało się załadować rejonu",

    // Catalog — map / crag list
    "catalog.map.heading": "Skały",
    "catalog.map.crag_count_one": "1 crąg",
    "catalog.map.crag_count_few": "{count} skały",
    "catalog.map.crag_count_many": "{count} skał",
    "catalog.map.empty": "Brak opublikowanych skał.",

    // Catalog — routes table
    "catalog.routes.empty": "Brak tras dla tej skały.",
    "catalog.routes.column_name": "Nazwa",
    "catalog.routes.column_grade": "Skala",
    "catalog.routes.column_type": "Typ",
    "catalog.routes.column_year": "Rok poprowadzenia",
    "catalog.routes.column_log": "Twoje przejścia",
    "catalog.routes.cell_name_label": "Nazwa:",
    "catalog.routes.cell_grade_label": "Skala:",
    "catalog.routes.cell_type_label": "Typ:",
    "catalog.routes.cell_year_label": "Rok poprowadzenia:",
    "catalog.routes.cell_log_label": "Twoje przejścia:",
    "catalog.routes.year_missing": "—",

    // Climbs — page-level signed-out CTA on the crag route page
    "climbs.signin_cta.body": "Zaloguj się, aby śledzić swoje przejścia tras na tej skale.",
    "climbs.signin_cta.link": "Zaloguj się",

    // Climbs — diagnostic when private-state load fails on the crag page
    "climbs.diagnostic.load_failed": "Nie udało się wczytać twoich przejść. Katalog jest dostępny poniżej.",

    // Climbs — per-route action (collapsed / expanded states)
    "climbs.action.log_button": "Dodaj przejście",
    "climbs.action.add_another": "Dodaj kolejne przejście",
    "climbs.action.collapse": "Anuluj",
    "climbs.action.none_logged": "Brak zapisanych przejść",
    "climbs.action.indicator_count_one": "1 przejście",
    "climbs.action.indicator_count_few": "{count} przejścia",
    "climbs.action.indicator_count_many": "{count} przejść",
    "climbs.action.indicator_latest": "ostatnie {date}",

    // Climbs — inline form (date + note + submit)
    "climbs.form.heading": "Nowe przejście",
    "climbs.form.date_label": "Data przejścia",
    "climbs.form.note_label": "Notatka (opcjonalnie)",
    "climbs.form.note_placeholder": "np. styl, partner, warunki",
    "climbs.form.submit": "Zapisz przejście",
    "climbs.form.submit_pending": "Zapisywanie…",
    "climbs.form.success": "Zapisano przejście.",
    "climbs.form.error_date_required": "Data jest wymagana.",
    "climbs.form.error_date_invalid": "Podaj prawidłową datę w formacie YYYY-MM-DD.",
    "climbs.form.error_network": "Brak połączenia z serwerem. Spróbuj ponownie.",

    // Climbs — server-resolved error messages (keyed by API error code)
    "errors.climbs.missing_config": "Zapis przejść jest chwilowo niedostępny. Spróbuj ponownie później.",
    "errors.climbs.unauthenticated": "Sesja wygasła. Zaloguj się ponownie, aby zapisać przejście.",
    "errors.climbs.unknown_route": "Nie znaleziono tej drogi w katalogu. Odśwież stronę i spróbuj ponownie.",
    "errors.climbs.upstream_error": "Nie udało się zapisać przejścia. Spróbuj ponownie za chwilę.",
    "errors.climbs.invalid_input": "Nieprawidłowe dane formularza. Sprawdź datę i spróbuj ponownie.",
    "errors.climbs.unknown": "Wystąpił nieoczekiwany błąd podczas zapisywania przejścia.",

    // History — /historia (page + dashboard entry + row chrome)
    "history.page_title": "Historia przejść",
    "history.heading": "Historia przejść",
    "history.lead": "Twoje zapisane przejścia, najnowsze na górze.",
    "history.empty_heading": "Brak zapisanych przejść",
    "history.empty_body": "Wybierz drogę z katalogu, aby zapisać pierwsze przejście.",
    "history.empty_cta": "Przeglądaj rejony",
    "history.load_error": "Nie udało się wczytać historii przejść. Spróbuj odświeżyć stronę.",
    "history.row.date_label": "Data:",
    "history.row.grade_label": "Wycena:",
    "history.row.crag_label": "Skała:",
    "history.row.note_label": "Notatka:",
    "history.row.open_crag": "Otwórz skałę",
    "history.row.crag_unavailable": "Niedostępne",

    // Dashboard — entry point copy (added for Phase 3 in the same dictionary)
    "dashboard.history_link": "Otwórz historię przejść",

    // Catalog — photo gallery (placeholders: {n}, {m})
    "catalog.photos.aria_photo_n_of_m": "Zdjęcie {n} z {m}",
    "catalog.photos.show_photo_n_of_m": "Pokaż zdjęcie {n} z {m}",

    // Catalog — error alert
    "catalog.errors.missing_config_title": "Brak konfiguracji Strapi",
    "catalog.errors.missing_config_message":
      "Strapi nie jest skonfigurowany. Ustaw STRAPI_API_URL i STRAPI_API_TOKEN w .dev.vars (lokalnie) lub jako sekrety Workera (produkcja).",
    "catalog.errors.catalog_error_title": "Błąd odczytu katalogu",
    "catalog.errors.catalog_error_message": "Nie udało się pobrać danych ze Strapi. Spróbuj ponownie za chwilę.",
    "catalog.errors.unknown_error_title": "Wystąpił nieoczekiwany błąd.",
    "catalog.errors.unknown_error_message": "Spróbuj odświeżyć stronę.",

    // Catalog — header / footer
    "catalog.header.signout": "Wyloguj",
    "catalog.header.signin": "Zaloguj się",
    "catalog.header.breadcrumbs_aria": "Okruszki",
    "catalog.footer.tagline": "SendLog — katalog wspinaczkowy. Treść zarządzana przez administratora.",
    "catalog.footer.home_link": "Powrót na stronę główną",
  },
} as const;

export type UiLang = keyof typeof ui;
export type UiKey = keyof (typeof ui)[typeof defaultLang];

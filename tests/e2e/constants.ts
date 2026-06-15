/** Deterministic mailbox for passwordless auth e2e — local Mailpit only. */
export const E2E_TEST_EMAIL = "e2e-auth@example.com";

/**
 * Second deterministic mailbox for two-user isolation specs (user B). Distinct
 * from `E2E_TEST_EMAIL` so each user resolves to its own Supabase identity and
 * its own Mailpit inbox — required to prove cross-user data isolation.
 */
export const E2E_TEST_EMAIL_B = "e2e-isolation-b@example.com";

/** Seeded catalog fixture crag: a crag page with at least one loggable route. */
export const FIXTURE_CRAG_PATH = "/regiony/rzedkowice/mala-gran";

/** Seeded catalog fixture route name on `FIXTURE_CRAG_PATH`. */
export const FIXTURE_ROUTE_NAME = "test route";

/** Local Supabase email capture UI (Mailpit on current CLI; legacy docs call this Inbucket). */
export const INBUCKET_BASE_URL = "http://127.0.0.1:54324";

export const APP_BASE_URL = "http://127.0.0.1:3000";

/** Mirrors `PROTECTED_ROUTES` in `src/middleware.ts` (excluding test-only smoke route). */
export const PROTECTED_ROUTES = ["/dashboard", "/historia", "/projekty"] as const;

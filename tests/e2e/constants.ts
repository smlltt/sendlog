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

/**
 * Seeded catalog fixture route on `FIXTURE_CRAG_PATH`. These constants are an
 * independent oracle for the locally seeded Strapi catalog: public catalog
 * specs compare the rendered route row against these values directly, never
 * against data fetched through the app's own Strapi client during the test.
 * That independence is what lets the route-list fidelity test catch a silent
 * field-drop or transform regression (test-plan risk #6).
 *
 * Changing the local seed (route name, grade, type, year) requires deliberately
 * updating these constants in the same change — a failing assertion here means
 * either a real regression or seed drift, and both deserve a human decision.
 */
export const FIXTURE_ROUTE_NAME = "test route";

/** Seeded route grade as rendered in the crag route table (`route.grade`). */
export const FIXTURE_ROUTE_GRADE = "6a";

/** Seeded route type as rendered in the crag route table (`route.type`). */
export const FIXTURE_ROUTE_TYPE = "sport";

/**
 * Seeded route year display as rendered in the crag route table. When the seed
 * has a `yearSet`, this is the year string; the missing-year branch
 * (`catalog.routes.year_missing`) is covered separately by the spec if needed.
 */
export const FIXTURE_ROUTE_YEAR = "2005";

/** Local Supabase email capture UI (Mailpit on current CLI; legacy docs call this Inbucket). */
export const INBUCKET_BASE_URL = "http://127.0.0.1:54324";

export const APP_BASE_URL = "http://127.0.0.1:3000";

/** Mirrors `PROTECTED_ROUTES` in `src/middleware.ts` (excluding test-only smoke route). */
export const PROTECTED_ROUTES = ["/dashboard", "/historia", "/projekty"] as const;

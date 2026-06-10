/** Deterministic mailbox for passwordless auth e2e — local Mailpit only. */
export const E2E_TEST_EMAIL = "e2e-auth@example.com";

/** Local Supabase email capture UI (Mailpit on current CLI; legacy docs call this Inbucket). */
export const INBUCKET_BASE_URL = "http://127.0.0.1:54324";

export const APP_BASE_URL = "http://127.0.0.1:3000";

/** Mirrors `PROTECTED_ROUTES` in `src/middleware.ts` (excluding test-only smoke route). */
export const PROTECTED_ROUTES = ["/dashboard", "/historia", "/projekty"] as const;

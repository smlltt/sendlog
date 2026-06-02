/**
 * Auth module — public types and error code surface.
 *
 * `AuthErrorCode` is the stable identifier carried in `?error=<code>` query
 * strings between `/api/auth/magic-link`, `/auth/confirm`, and the signin
 * page. The string passed to users is resolved through `AUTH_ERROR_MESSAGES`
 * so phrasing changes in one place.
 *
 * Server-only by convention: every consumer lives behind an Astro page or
 * API route. Importing this module from a client island is allowed (no
 * secrets, no runtime deps), but the DTOs are shaped for server validation.
 */

import { getTranslations, type UiKey } from "@/i18n";

export type AuthErrorCode = "missing_config" | "invalid_email" | "magic_link_failed" | "invalid_or_expired_link";

// Each AuthErrorCode resolves through the i18n dictionary so error phrasing
// changes in one place (`src/i18n/ui.ts`). The map is built at module load —
// cheap, deterministic, and avoids per-request `useTranslations()` calls in
// the redirect helper.
const AUTH_ERROR_KEYS: Record<AuthErrorCode, UiKey> = {
  missing_config: "errors.auth.missing_config",
  invalid_email: "errors.auth.invalid_email",
  magic_link_failed: "errors.auth.magic_link_failed",
  invalid_or_expired_link: "errors.auth.invalid_or_expired_link",
};

const t = getTranslations();

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing_config: t(AUTH_ERROR_KEYS.missing_config),
  invalid_email: t(AUTH_ERROR_KEYS.invalid_email),
  magic_link_failed: t(AUTH_ERROR_KEYS.magic_link_failed),
  invalid_or_expired_link: t(AUTH_ERROR_KEYS.invalid_or_expired_link),
};

/**
 * Verified Supabase `EmailOtpType` used by this app's token-hash flow.
 *
 * `signInWithOtp` magic-link tokens verify as `magiclink` per the Supabase
 * server-side auth tutorial. The Supabase email template, the confirm-route
 * guard, and the Supabase configuration checklist must all use this value
 * consistently. See `context/changes/passwordless-auth-flow/research.md`.
 */
export const MAGIC_LINK_OTP_TYPE = "magiclink" as const;
export type MagicLinkOtpType = typeof MAGIC_LINK_OTP_TYPE;

export interface MagicLinkRequestInput {
  email: string;
  next: string;
}

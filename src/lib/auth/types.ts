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

export type AuthErrorCode = "missing_config" | "invalid_email" | "magic_link_failed" | "invalid_or_expired_link";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing_config: "Sign-in is temporarily unavailable. Please try again later.",
  invalid_email: "Enter a valid email address.",
  magic_link_failed: "We couldn't send your sign-in link. Please try again.",
  invalid_or_expired_link: "That sign-in link is invalid or has expired. Request a new one below.",
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

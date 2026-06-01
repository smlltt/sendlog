/**
 * Auth module — public entrypoint.
 *
 * Centralizes the small contracts that the passwordless flow needs in more
 * than one place: a path-only `next` sanitizer, the default post-login path,
 * stable user-facing error codes/messages, and the verified Supabase
 * `EmailOtpType` for the token-hash magic-link callback. Middleware, the
 * `/api/auth/magic-link` route, and the `/auth/confirm` route all import
 * from here so URL handling stays consistent.
 *
 * Deep imports into `redirect.ts` or `types.ts` are discouraged — consume
 * the surface re-exported below.
 */

export {
  AUTH_ERROR_MESSAGES,
  MAGIC_LINK_OTP_TYPE,
  type AuthErrorCode,
  type MagicLinkOtpType,
  type MagicLinkRequestInput,
} from "@/lib/auth/types";
export {
  DEFAULT_NEXT_PATH,
  buildCheckEmailRedirect,
  buildSignInRedirect,
  resolveAuthErrorMessage,
  sanitizeNextPath,
} from "@/lib/auth/redirect";

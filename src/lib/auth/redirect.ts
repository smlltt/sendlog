/**
 * Path-only redirect helpers shared by the magic-link request endpoint, the
 * `/auth/confirm` callback, and middleware protected-route gating.
 *
 * The single rule we enforce here: `next` is accepted only as a same-origin
 * path beginning with a single `/`. Absolute URLs, protocol-relative URLs
 * (`//evil.example`), backslash tricks, control characters, oversize values,
 * and empty values all fall back to `DEFAULT_NEXT_PATH`. This avoids an
 * open redirect through the magic-link callback while still preserving the
 * user's original protected-route intent.
 */

import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "@/lib/auth/types";

export const DEFAULT_NEXT_PATH = "/";

const MAX_NEXT_LENGTH = 2000;

// Intentionally rejecting CR/LF and other control characters in `next` so
// the value cannot inject extra headers through the `Location:` response.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function sanitizeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return DEFAULT_NEXT_PATH;
  const value = raw.trim();
  if (value.length === 0 || value.length > MAX_NEXT_LENGTH) return DEFAULT_NEXT_PATH;
  if (!value.startsWith("/")) return DEFAULT_NEXT_PATH;
  if (value.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (value.startsWith("/\\")) return DEFAULT_NEXT_PATH;
  if (CONTROL_CHARS.test(value)) return DEFAULT_NEXT_PATH;
  return value;
}

export function buildSignInRedirect(options: { next?: string | null; error?: AuthErrorCode }): string {
  const params = new URLSearchParams();
  if (options.error) {
    params.set("error", options.error);
  }
  const next = sanitizeNextPath(options.next);
  if (next !== DEFAULT_NEXT_PATH) {
    params.set("next", next);
  }
  const qs = params.toString();
  return qs.length > 0 ? `/auth/signin?${qs}` : "/auth/signin";
}

export function buildCheckEmailRedirect(next: string): string {
  const sanitized = sanitizeNextPath(next);
  if (sanitized === DEFAULT_NEXT_PATH) {
    return "/auth/check-email";
  }
  return `/auth/check-email?next=${encodeURIComponent(sanitized)}`;
}

export function resolveAuthErrorMessage(code: string | null | undefined): string | null {
  if (typeof code !== "string" || code.length === 0) return null;
  if (Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, code)) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return null;
}

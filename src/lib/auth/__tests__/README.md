# Auth module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to
satisfy the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`)
and to record the test surface that should be covered once a runner is
added — Vitest is the likely candidate given the Vite/Astro toolchain. See
`src/lib/private-state/__tests__/README.md` for the matching precedent.

End-to-end verification of the auth contract today is the manual smoke list
documented in `context/changes/passwordless-auth-flow/plan.md` Phases 1 and
3 — local Supabase + Inbucket, then live email delivery.

## `sanitizeNextPath` (`redirect.ts`)

- `sanitizeNextPath("/dashboard")` → `"/dashboard"` (happy path; preserves
  the requested protected route).
- `sanitizeNextPath("/dashboard?tab=climbs")` → `"/dashboard?tab=climbs"`
  (path + query is allowed; `next` is a same-origin URL fragment).
- `sanitizeNextPath(null | undefined | "" | "   ")` → `"/"` (no usable hint,
  fall back to the default post-login path).
- `sanitizeNextPath("dashboard")` → `"/"` (must start with `/`; bare paths
  could be interpreted relative to the current page and are not safe).
- `sanitizeNextPath("//evil.example/path")` → `"/"` (protocol-relative URL
  is the canonical open-redirect vector and must always fall back).
- `sanitizeNextPath("/\\evil.example/path")` → `"/"` (backslash trick — some
  browsers normalize `\` to `/`, so `/\foo` resolves like `//foo`).
- `sanitizeNextPath("https://evil.example/")` → `"/"` (absolute URLs are
  external; never honor them).
- `sanitizeNextPath("/dashboard\nSet-Cookie: x=y")` → `"/"` (control chars
  including CR/LF are stripped via reject-and-fallback to prevent header
  injection through the `Location` redirect path).
- `sanitizeNextPath("/" + "a".repeat(3000))` → `"/"` (oversize values are
  rejected to keep the redirect URL bounded).

## `buildSignInRedirect` (`redirect.ts`)

- `buildSignInRedirect({})` → `"/auth/signin"`.
- `buildSignInRedirect({ next: "/dashboard" })` →
  `"/auth/signin?next=%2Fdashboard"` (the same-origin `next` is preserved
  through the redirect so the user lands back on the protected route after
  passwordless confirmation).
- `buildSignInRedirect({ error: "invalid_or_expired_link" })` →
  `"/auth/signin?error=invalid_or_expired_link"` (stable code on the URL,
  resolved to a friendly message in the page render).
- `buildSignInRedirect({ next: "//evil.example", error: "magic_link_failed" })`
  drops the malicious `next` and keeps only the error code on the URL.

## `buildCheckEmailRedirect` (`redirect.ts`)

- `buildCheckEmailRedirect("/dashboard")` →
  `"/auth/check-email?next=%2Fdashboard"` (so the retry link on the
  check-email page can preserve the original protected-route target).
- `buildCheckEmailRedirect("/")` → `"/auth/check-email"` (no `next` query
  when the sanitized value collapses to the default).
- `buildCheckEmailRedirect("//evil.example")` → `"/auth/check-email"`
  (sanitizer drops the unsafe value before the URL is built).

## `resolveAuthErrorMessage` (`redirect.ts`)

- `resolveAuthErrorMessage(null)` / `resolveAuthErrorMessage("")` → `null`.
- `resolveAuthErrorMessage("invalid_email")` → user-facing message from
  `AUTH_ERROR_MESSAGES`.
- `resolveAuthErrorMessage("unknown_code")` → `null` (unknown codes do not
  echo arbitrary strings into the page — the page falls back to no banner
  rather than reflecting attacker-controlled query params).

## Magic-link API contract (`/api/auth/magic-link`)

- Missing/invalid `email` → redirect to
  `/auth/signin?error=invalid_email[&next=...]` (zod-validated before any
  Supabase call).
- Supabase env unset (`createClient` returns `null`) → redirect to
  `/auth/signin?error=missing_config[&next=...]`.
- `signInWithOtp` error → redirect to
  `/auth/signin?error=magic_link_failed[&next=...]`.
- Happy path → 303 redirect to `/auth/check-email[?next=...]` with the
  sanitized `next` preserved on the retry link.
- `emailRedirectTo` is built as an absolute same-origin URL with path
  `/auth/confirm` and `next` query encoded, so the Supabase template can
  append `&token_hash={{ .TokenHash }}&type=magiclink` to `{{ .RedirectTo }}`.

## Confirm-route contract (`/auth/confirm`)

- Missing `token_hash` or mismatched `type` → redirect to
  `/auth/signin?error=invalid_or_expired_link[&next=...]`.
- `verifyOtp` error → redirect to
  `/auth/signin?error=invalid_or_expired_link[&next=...]` (no leak of the
  raw Supabase error string into the URL).
- Happy path → redirect to the sanitized `next` path (defaults to `/`),
  with the new session cookies written through `@supabase/ssr`'s `setAll`
  on the same response.
- External `next` (absolute URL, `//host/...`, etc.) is dropped by the
  sanitizer and the user lands on `/` instead.

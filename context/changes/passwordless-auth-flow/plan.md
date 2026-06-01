# Passwordless Auth Flow Implementation Plan

## Overview

Ship S-03 as an SSR-first Supabase magic-link flow. A visitor enters an email address, Supabase sends a passwordless link that lands on this app's `/auth/confirm` server route, and that route verifies the `token_hash`, writes session cookies through `@supabase/ssr`, and redirects the visitor to a safe same-origin destination.

This replaces the user-facing password signup/signin flow with one unified email-only entry point. Password routes should not remain visible as a second auth mode.

## Current State Analysis

The app already has Supabase SSR session wiring and middleware-resolved `Astro.locals.user`. Current auth is email/password: `/auth/signup` renders `SignUpForm`, `/auth/signin` renders `SignInForm`, and `/api/auth/{signup,signin}` call `signUp` / `signInWithPassword`. Signout is already POST-based and can remain.

Passwordless research confirmed the key SSR constraint: Supabase's default hash-fragment magic-link flow is wrong for this app. The email template must use `{{ .TokenHash }}` and point to a server route, because the server route is what lets `verifyOtp({ token_hash, type })` set cookies before redirect.

## Desired End State

A visitor can request a magic link from `/auth/signin`, open the email, and become signed in without entering a password. If they originally tried to open a protected route, middleware preserves a path-only `next` value and the callback returns them there after verification. Invalid or expired links redirect back to `/auth/signin` with a friendly recoverable error.

The visible signup path is unified with signin: first-time users are auto-created by `signInWithOtp` using `shouldCreateUser: true`. The old password form is no longer part of the user-facing flow.

### Key Discoveries:

- Existing Supabase SSR client writes auth cookies through Astro cookies in `src/lib/supabase.ts:5-23`; the confirm route should reuse this path.
- Middleware already resolves `Astro.locals.user` and protects route prefixes in `src/middleware.ts:6-24`; it needs path-only `next` preservation when redirecting to signin.
- Current auth API routes are redirect/form-post based in `src/pages/api/auth/signup.ts:4-20` and `src/pages/api/auth/signin.ts:4-20`, not JSON APIs.
- Existing auth forms validate only on the client in `src/components/auth/SignInForm.tsx:18-40` and `src/components/auth/SignUpForm.tsx:22-55`; the new server endpoint should add zod validation per repo convention.
- There is no test runner in `package.json:5-13`; verification is lint/build plus local and live manual smoke.
- Roadmap S-03 defines the outcome as "visitor can request a sign-in link, become signed in, and sign out" in `context/foundation/roadmap.md:143-154`.

## What We're NOT Doing

- OTP code entry UI or `/api/auth/otp/verify`.
- A separate passwordless signup page with different behavior from signin.
- Keeping password inputs visible in the UI.
- Database migrations or Supabase schema changes.
- New private-state behavior, climb logging, project lists, or dashboard redesign.
- A general auth module refactor beyond helpers needed for this flow.
- A test runner setup.

## Implementation Approach

Add the server auth contract first: dependency validation, a small auth helper surface, `POST /api/auth/magic-link`, `GET /auth/confirm`, and middleware `next` preservation. Then replace the React password forms with an email-only magic-link request form and update auth pages around it. Finish with Supabase project configuration and live smoke verification because the flow depends on email templates and redirect allowlists outside the repo.

## Critical Implementation Details

### Token hash callback

The Supabase magic-link email template must use the token-hash callback contract, not `{{ .ConfirmationURL }}`. Build `emailRedirectTo` as an absolute same-origin URL whose path/query are `/auth/confirm?next=<encoded sanitized path>`, always including the `next` query param even when it is `/`, then configure the template link as `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<verified EmailOtpType>`. Before implementing the confirm-route guard, verify whether the local Supabase project accepts `magiclink` or `email` for this token-hash flow, then use that single value consistently in the app, Supabase template, and configuration checklist.

### Redirect safety

`next` is accepted only as a same-origin path beginning with `/`. Absolute URLs, protocol-relative URLs, empty values, and suspicious values fall back to `/`. This avoids an open redirect while preserving the user's original protected-route intent.

### Password route retirement

The visible UI should have one auth mode. Existing password route files can remain briefly for a conservative rollback path, but they should not remain linked by pages or forms after this plan lands. If kept, their behavior should steer users to the passwordless page rather than silently continuing password signup/signin.

## Phase 1: Server-Side Passwordless Auth Contract

### Overview

Install the server pieces that send magic links, verify callback links, and preserve safe post-login destinations. This phase should leave the old UI mostly intact while making the passwordless backend path callable.

### Changes Required:

#### 1. Add zod dependency

**File**: `package.json`

**Intent**: Support server-side validation in the new auth API route using the repository's stated zod convention.

**Contract**: Add `zod` as a runtime dependency via the package manager. Lockfile changes are expected from the install command.

#### 2. Auth helper module

**Files**: `src/lib/auth/index.ts`, `src/lib/auth/types.ts`, `src/lib/auth/redirect.ts`, `src/lib/auth/__tests__/README.md`

**Intent**: Centralize small auth-specific contracts so middleware, API routes, and the confirm route handle `next` and errors consistently without duplicating ad hoc URL logic.

**Contract**: Export a path-only redirect sanitizer, a default post-login path (`/`), user-facing error codes/messages, and any DTO types needed by the magic-link route. The module follows the repo module structure rule with `index.ts`, `types.ts`, and `__tests__/`.

#### 3. Magic-link request endpoint

**File**: `src/pages/api/auth/magic-link.ts`

**Intent**: Accept an email-only form POST, ask Supabase to send a magic link, and redirect the user to a check-email page.

**Contract**: Export `const prerender = false` and `POST`. Read `email` and optional `next` from `FormData`, validate with zod, sanitize `next` to a path-only value, create the request-scoped Supabase client, then call `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })`. Build `emailRedirectTo` as an absolute same-origin `/auth/confirm?next=<encoded sanitized path>` URL so the Supabase template can append `&token_hash={{ .TokenHash }}&type=<verified EmailOtpType>` to `{{ .RedirectTo }}`. On validation/config/Supabase errors, redirect to `/auth/signin?error=...`; on success, redirect to `/auth/check-email?next=<encoded sanitized path>` so retry links can preserve the original protected-route target.

#### 4. Magic-link confirm route

**File**: `src/pages/auth/confirm.ts`

**Intent**: Verify the token hash from Supabase and establish the cookie-backed session on the server before redirecting.

**Contract**: Export `const prerender = false` and `GET`. Read `token_hash`, `type`, and optional `next`; require `token_hash` and the verified email OTP type emitted by the configured template; call `supabase.auth.verifyOtp({ type, token_hash })`; on success redirect to the sanitized `next` path or `/`; on failure redirect to `/auth/signin?error=...`.

#### 5. Middleware protected-route next preservation

**File**: `src/middleware.ts`

**Intent**: When an unauthenticated visitor hits a protected route, send them to signin with a safe return target.

**Contract**: Keep `Astro.locals.user` behavior unchanged. For protected routes, redirect to `/auth/signin?next=<current path + query>` using the auth helper's sanitizer/encoder. Do not include origin, protocol, hash fragments, or external URLs.

#### 6. Existing auth API route flags and retirement stance

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Bring touched auth API routes in line with the SSR route convention and prevent stale password forms from being the long-term path.

**Contract**: Add `const prerender = false` to all auth API routes. Keep `signout` behavior. For password `signin` / `signup`, either mark them as temporary legacy endpoints in comments and leave unlinked until removal, or change them to redirect users to the passwordless signin page with a friendly message. The implementer should choose the smaller edit that best preserves rollback while ensuring no visible UI depends on them.

### Success Criteria:

#### Automated Verification:

- Dependency install updates `package.json` and lockfile cleanly.
- Astro types regenerate: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `rg "prerender = false" src/pages/api/auth` shows the auth API routes export the flag.

#### Manual Verification:

- Posting a valid email to `/api/auth/magic-link` in local dev redirects to the check-email page.
- The Supabase `EmailOtpType` for this token-hash flow is verified locally and recorded consistently before the confirm-route guard is finalized.
- Supabase local Inbucket receives a magic-link email whose URL points to `/auth/confirm` and includes `token_hash`, the verified `type`, and a path-only `next`.
- Opening the local magic link signs the user in and redirects to `/` when no `next` was requested.
- Opening a protected route while signed out redirects to `/auth/signin?next=...`; after magic-link confirmation the user returns to that protected path.
- Invalid, missing, expired, or reused token links redirect to `/auth/signin` with a friendly error.
- Attempts to use an external `next` URL fall back to `/`.
- Opening `/private-state-smoke` while signed out preserves `next` through passwordless signin and renders after callback with `Astro.locals.user` intact.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Unified Auth UI

### Overview

Replace the user-facing email/password signup and signin forms with one email-only magic-link request flow. This makes passwordless auth the product path without changing signout or protected-route gating.

### Changes Required:

#### 1. Email-only magic-link form

**File**: `src/components/auth/MagicLinkForm.tsx`

**Intent**: Provide the single React island form for requesting a passwordless link.

**Contract**: Accept `serverError?: string | null` and `next?: string | null`. Maintain the existing form styling patterns and reusable components (`FormField`, `ServerError`, `SubmitButton`). Validate email client-side, include a hidden sanitized `next` value when present, and POST to `/api/auth/magic-link`.

#### 2. Signin page rewrite

**File**: `src/pages/auth/signin.astro`

**Intent**: Make `/auth/signin` the unified "sign in or create account" entry point.

**Contract**: Render `MagicLinkForm`, read `error` and `next` from query params, and update copy to explain that SendLog sends a one-time sign-in link. Remove password-specific labels and signup link copy. Keep the current auth shell unless the implementer needs a small copy/layout adjustment for clarity.

#### 3. Signup page retirement

**File**: `src/pages/auth/signup.astro`

**Intent**: Avoid presenting signup as a separate password-based concept now that first-time users are auto-created by the magic-link flow.

**Contract**: Either redirect `/auth/signup` to `/auth/signin` with explanatory copy/query state, or render the same `MagicLinkForm` with signup-oriented heading text. In both cases, read and sanitize any incoming `next` value, then preserve it through the redirect query or the `MagicLinkForm` props. The page must not render password fields.

#### 4. Check-email page

**File**: `src/pages/auth/check-email.astro`

**Intent**: Give the user a clear landing page after requesting a magic link.

**Contract**: Reuse the visual language of `confirm-email.astro` but update copy for passwordless signin: "Check your email", explain the link is single-use, and link back to `/auth/signin?next=<encoded sanitized path>` to request another link when a safe `next` value is present. Do not put the submitted email address in the URL or render it from query string state; use generic copy unless a later flash/session mechanism can display a masked address without leaking it into logs or browser history.

#### 5. Confirm-email page cleanup

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Remove or repurpose the old password-signup confirmation page so it does not describe an obsolete flow.

**Contract**: If still reachable from legacy password endpoints, make its copy generic enough not to conflict with passwordless auth. If no route uses it after Phase 2, either redirect it to `/auth/check-email` or leave it as a compatibility page with updated wording.

#### 6. Remove password form dependencies from visible auth

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: Prevent future readers from mistaking old password forms for the active auth path.

**Contract**: Delete these components if no route imports them after the page rewrites, or keep them only if the password API routes remain intentionally available for temporary rollback. In either case, `rg "SignInForm|SignUpForm" src/pages src/components` should prove they are not part of the visible passwordless flow.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `rg "type=\"password\"|PasswordToggle|SignInForm|SignUpForm" src/pages/auth src/components/auth` returns no active password-field usage in the visible auth pages.
- `rg "/api/auth/magic-link" src/pages/auth src/components/auth` finds the new form wiring.

#### Manual Verification:

- `/auth/signin` shows one email field and no password field.
- `/auth/signup` no longer shows a password signup form and clearly points users into the same passwordless flow.
- Submitting an invalid email shows client-side validation before POST.
- Submitting a valid email shows the check-email page, preserving a safe `next` value on the retry link when one was requested.
- Server-side validation errors and Supabase errors render as friendly messages on `/auth/signin`.
- Existing signout forms on dashboard/catalog pages still POST to `/api/auth/signout` and sign the user out.
- Auth pages remain usable on a 375x667 mobile viewport with no horizontal scrolling.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Configuration and Live Verification

### Overview

Finish the change by documenting and verifying the Supabase-side settings that code cannot enforce: email provider, redirect allowlist, magic-link email template, and production/staging behavior.

### Changes Required:

#### 1. Supabase configuration checklist

**File**: `context/changes/passwordless-auth-flow/supabase-config.md`

**Intent**: Capture the exact Supabase dashboard settings required for local, staging, and production magic links.

**Contract**: Document Email provider enablement, Site URL, Redirect URLs for local and deployed origins, the verified `EmailOtpType`, and the Magic Link email template using `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<verified EmailOtpType>`. Include a local dev smoke recipe that starts Supabase, copies local credentials into `.env` and `.dev.vars`, runs Astro on the same origin as the local Supabase Auth `site_url` (`http://127.0.0.1:3000` unless the Supabase redirect config is intentionally changed), opens local Inbucket at `http://127.0.0.1:54324`, and verifies the callback URL/cookies/`next` behavior. Note that production smoke requires real email delivery.

#### 2. Auth README or test notes

**File**: `src/components/auth/__tests__/README.md`

**Intent**: Record intended future coverage for the auth UI now that no test runner exists.

**Contract**: Add or update the README to name future tests for email validation, server error rendering, hidden `next` preservation, no password fields, expired-link recovery copy, and signout continuity.

#### 3. Project README auth route docs

**File**: `README.md`

**Intent**: Keep repository onboarding aligned with the new passwordless product flow.

**Contract**: Update the Auth routes section so it describes `/auth/signin` as the magic-link request page, `/auth/signup` as unified with signin or redirected there, `/auth/check-email` as the post-request page, and `/auth/confirm` as the token-hash callback. Remove email/password wording from the visible route descriptions. Also check `context/changes/deployment/deployment-plan.md`; if it remains active guidance, update stale email/password auth wording there, otherwise treat it as historical planning context and do not use it as auth source-of-truth.

#### 4. Live smoke checklist

**File**: `context/changes/passwordless-auth-flow/plan.md`

**Intent**: Make production/staging smoke verification an explicit completion gate, matching the user's selected verification depth.

**Contract**: Progress items below include live smoke for: requesting a link, receiving real email, confirming the callback includes `token_hash`, the verified `type`, and the sanitized `next`, confirming the callback sets cookies, returning to a protected route via `next`, rejecting external `next`, handling an expired/reused link, and signout after passwordless signin.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate after any final file changes: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `context/changes/passwordless-auth-flow/supabase-config.md` exists and includes `{{ .RedirectTo }}`, `{{ .TokenHash }}`, the verified `EmailOtpType`, `/auth/confirm`, local redirect URL, deployed redirect URL placeholders, local Inbucket URL, and the local dev server command/origin used for smoke testing.
- `README.md` Auth routes describe the magic-link flow and no longer describe visible auth as email/password.

#### Manual Verification:

- Local Supabase/Inbucket magic-link flow works end-to-end.
- Staging or production Supabase sends a real magic-link email using the `RedirectTo` + `TokenHash` template.
- Opening the deployed email link signs the user in and lands on `/` when no protected route was requested.
- Opening a protected deployed URL while signed out, then completing magic-link auth, returns the user to that protected path.
- A reused or expired deployed magic link redirects to `/auth/signin` with friendly recovery copy.
- A malicious deployed link with external `next` does not redirect off-origin.
- Passwordless-signed-in users can sign out from existing signout surfaces.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering S-03 complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No automated test runner is configured.
- Future UI coverage belongs in `src/components/auth/__tests__/README.md`.
- Future helper coverage should verify path-only `next` sanitization, invalid email validation, and auth error message mapping.

### Integration Tests:

- `npx astro sync`, `npm run lint`, and `npm run build` are the automated gates after each phase.
- Local Supabase/Inbucket verifies the callback, cookie write, and protected-route return path before touching deployed config.
- Staging/production smoke verifies the Supabase dashboard template and redirect allowlist.

### Local Development Smoke Setup:

1. Start local Supabase with `npx supabase start`.
2. Copy the local `SUPABASE_URL` and anon key printed by the Supabase CLI into `.env` and `.dev.vars`.
3. Keep the app origin aligned with Supabase Auth redirect settings. By default, `supabase/config.toml` uses `site_url = "http://127.0.0.1:3000"`, so run the app with `npm run dev -- --host 127.0.0.1 --port 3000` unless the local Supabase redirect config is intentionally changed to the default Astro dev origin.
4. Open local Inbucket at `http://127.0.0.1:54324` to inspect passwordless emails.
5. Confirm the local Magic Link email template appends `token_hash` and the verified `EmailOtpType` to `{{ .RedirectTo }}` before treating callback failures as app bugs.

### Manual Testing Steps:

1. Configure local Supabase and start the app with valid Supabase env vars.
2. Visit `/auth/signin`, submit an email, and confirm the check-email page renders.
3. Open the email in local Inbucket and confirm the link points to `/auth/confirm` with `token_hash`.
4. Open the link and confirm the app sets a session and redirects correctly.
5. Sign out, open `/dashboard`, confirm redirect to signin with `next`, request a new link, and confirm the callback returns to `/dashboard`.
6. Try an expired or already-used link and confirm friendly recovery copy.
7. Repeat the happy path against staging or production using a real inbox.

## Performance Considerations

The request and callback routes perform one Supabase auth call each and no catalog/private-state work. There is no expected performance risk beyond email delivery latency, which is external to the app. The UI remains one small React form island and removes password-toggle interactivity from the active flow.

## Migration Notes

No database migration is required. Supabase dashboard configuration is required outside the repo: Email provider, Site URL, Redirect URLs, and Magic Link email template. Rollback is a code revert plus restoring the old Supabase email template if production has already switched to the `TokenHash` callback.

## References

- Related research: `context/changes/passwordless-auth-flow/research.md`
- Change metadata: `context/changes/passwordless-auth-flow/change.md`
- Roadmap S-03: `context/foundation/roadmap.md`
- Existing Supabase client: `src/lib/supabase.ts`
- Existing middleware: `src/middleware.ts`
- Existing password auth API routes: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`
- Existing auth pages and forms: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server-Side Passwordless Auth Contract

#### Automated

- [x] 1.1 Dependency install updates `package.json` and lockfile cleanly.
- [x] 1.2 Astro types regenerate: `npx astro sync`
- [x] 1.3 Lint passes: `npm run lint`
- [x] 1.4 Production build passes: `npm run build`
- [x] 1.5 `rg "prerender = false" src/pages/api/auth` shows the auth API routes export the flag.

#### Manual

- [x] 1.6 Posting a valid email to `/api/auth/magic-link` in local dev redirects to the check-email page.
- [x] 1.7 The Supabase `EmailOtpType` for this token-hash flow is verified locally and recorded consistently before the confirm-route guard is finalized.
- [x] 1.8 Supabase local Inbucket receives a magic-link email whose URL points to `/auth/confirm` and includes `token_hash`, the verified `type`, and a path-only `next`.
- [x] 1.9 Opening the local magic link signs the user in and redirects to `/` when no `next` was requested.
- [x] 1.10 Opening a protected route while signed out redirects to `/auth/signin?next=...`; after magic-link confirmation the user returns to that protected path.
- [x] 1.11 Invalid, missing, expired, or reused token links redirect to `/auth/signin` with a friendly error.
- [x] 1.12 Attempts to use an external `next` URL fall back to `/`.
- [x] 1.13 Opening `/private-state-smoke` while signed out preserves `next` through passwordless signin and renders after callback with `Astro.locals.user` intact.

### Phase 2: Unified Auth UI

#### Automated

- [ ] 2.1 Astro types regenerate: `npx astro sync`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Production build passes: `npm run build`
- [ ] 2.4 `rg "type=\"password\"|PasswordToggle|SignInForm|SignUpForm" src/pages/auth src/components/auth` returns no active password-field usage in the visible auth pages.
- [ ] 2.5 `rg "/api/auth/magic-link" src/pages/auth src/components/auth` finds the new form wiring.

#### Manual

- [ ] 2.6 `/auth/signin` shows one email field and no password field.
- [ ] 2.7 `/auth/signup` no longer shows a password signup form and clearly points users into the same passwordless flow.
- [ ] 2.8 Submitting an invalid email shows client-side validation before POST.
- [ ] 2.9 Submitting a valid email shows the check-email page, preserving a safe `next` value on the retry link when one was requested.
- [ ] 2.10 Server-side validation errors and Supabase errors render as friendly messages on `/auth/signin`.
- [ ] 2.11 Existing signout forms on dashboard/catalog pages still POST to `/api/auth/signout` and sign the user out.
- [ ] 2.12 Auth pages remain usable on a 375x667 mobile viewport with no horizontal scrolling.

### Phase 3: Configuration and Live Verification

#### Automated

- [ ] 3.1 Astro types regenerate after any final file changes: `npx astro sync`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Production build passes: `npm run build`
- [ ] 3.4 `context/changes/passwordless-auth-flow/supabase-config.md` exists and includes `{{ .RedirectTo }}`, `{{ .TokenHash }}`, the verified `EmailOtpType`, `/auth/confirm`, local redirect URL, deployed redirect URL placeholders, local Inbucket URL, and the local dev server command/origin used for smoke testing.
- [ ] 3.5 `README.md` Auth routes describe the magic-link flow and no longer describe visible auth as email/password.

#### Manual

- [ ] 3.6 Local Supabase/Inbucket magic-link flow works end-to-end.
- [ ] 3.7 Staging or production Supabase sends a real magic-link email using the `RedirectTo` + `TokenHash` template.
- [ ] 3.8 Opening the deployed email link signs the user in and lands on `/` when no protected route was requested.
- [ ] 3.9 Opening a protected deployed URL while signed out, then completing magic-link auth, returns the user to that protected path.
- [ ] 3.10 A reused or expired deployed magic link redirects to `/auth/signin` with friendly recovery copy.
- [ ] 3.11 A malicious deployed link with external `next` does not redirect off-origin.
- [ ] 3.12 Passwordless-signed-in users can sign out from existing signout surfaces.

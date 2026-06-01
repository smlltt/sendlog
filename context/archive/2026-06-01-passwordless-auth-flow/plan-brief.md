# Passwordless Auth Flow — Plan Brief

> Full plan: `context/changes/passwordless-auth-flow/plan.md`
> Research: `context/changes/passwordless-auth-flow/research.md`

## What & Why

Ship S-03: a visitor can request a sign-in link, become signed in, and sign out without a password. The current scaffold uses email/password, while the PRD and roadmap call for passwordless auth before the main private climb-log flow.

## Starting Point

Supabase SSR sessions are already wired through `src/lib/supabase.ts` and `src/middleware.ts`; protected routes read `Astro.locals.user`. The current auth UI and API routes are password-based (`signin`, `signup`, `signout`), and no automated test runner exists.

## Desired End State

`/auth/signin` is the single email-only auth entry point. The user submits an email, receives a Supabase magic link, opens `/auth/confirm?token_hash=...&type=<verified EmailOtpType>&next=...`, and lands signed in with cookies set server-side. First-time users are auto-created; password fields are no longer visible.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Credential form | Magic link only | It is the smallest SSR-correct path and avoids code-entry UI for v1. | Plan |
| Signup/signin model | Unified flow with `shouldCreateUser: true` | Fastest beta path: one form covers first-time and returning users. | Plan |
| Password auth | Replace in visible UI | Matches PRD passwordless direction while allowing conservative route retirement. | Plan |
| Callback strategy | `{{ .TokenHash }}` to `/auth/confirm` | Required for server-side cookie writing in Astro SSR. | Research |
| Redirect handling | Same-origin path-only `next` | Preserves protected-route intent without open-redirect risk. | Plan |
| Error UX | Redirect back to signin with friendly errors | Matches the existing form-post auth pattern. | Plan |
| Verification | Local plus staging/production smoke | Supabase email template and redirect allowlist cannot be proven by code alone. | Plan |

## Scope

**In scope:**

- `POST /api/auth/magic-link`
- `GET /auth/confirm`
- Path-only `next` helper and middleware preservation
- Unified email-only auth form
- `/auth/check-email` landing page
- Password form retirement from visible UI
- Supabase configuration checklist and live smoke sign-off

**Out of scope:**

- OTP code entry
- Separate signup flow
- Database migrations
- Private-state, climb-log, or projects UI
- Test runner setup

## Architecture / Approach

The app stays server-first: form POST sends the email via Supabase, the email link returns to an Astro server route, and `verifyOtp` writes cookies through the existing `@/lib/supabase` SSR client. Middleware preserves protected-route intent as a sanitized path-only `next`, and the auth UI becomes one React island around an email field.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server-Side Passwordless Auth Contract | Magic-link API, confirm route, redirect helper, middleware `next` preservation | Open redirect or incorrect Supabase callback template |
| 2. Unified Auth UI | Email-only signin/signup surface and check-email page | Leaving stale password UI reachable |
| 3. Configuration and Live Verification | Supabase config docs plus local and deployed smoke checks | Dashboard/email configuration drift outside the repo |

**Prerequisites:** Supabase project access for email templates and redirect allowlist updates.
**Estimated effort:** ~2 focused sessions across 3 phases, plus live smoke time once deployed config is available.

## Open Risks & Assumptions

- Production smoke requires access to the live Supabase Auth configuration and a real inbox.
- The Supabase `EmailOtpType` for the token-hash callback must be verified locally before finalizing the confirm-route guard and dashboard template.
- Existing password API routes may stay briefly for rollback, but they must not remain visible or documented as the active flow.
- No automated test runner exists, so the plan relies on lint/build and manual auth smoke.
- Supabase rate limits may need temporary adjustment during local or production testing.

## Success Criteria (Summary)

- A user can request a magic link, open it, and become signed in without a password.
- A protected route preserves a safe `next` path through signin and rejects external redirects.
- Local Inbucket and staging/production email flows both pass, including expired/reused link recovery and signout.

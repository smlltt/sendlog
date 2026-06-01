# `src/components/auth/__tests__` — intended coverage

No test runner is configured in this repo (per [`AGENTS.md`](../../../../AGENTS.md) and [`package.json`](../../../../package.json)), so the auth UI is verified through manual smoke against local Supabase/Inbucket and the production Supabase project. When a runner is added, the following cases should be the first coverage targets — they encode the invariants the passwordless flow depends on.

## `MagicLinkForm.tsx`

- **Email validation** — submitting an empty value or an obviously invalid value (`foo`, `foo@`, `@bar`) surfaces a client-side error and does not POST to `/api/auth/magic-link`.
- **Server error rendering** — when the page passes `serverError` (e.g., `invalid_email`, `missing_config`, `magic_link_failed`), the form renders the friendly message from `AUTH_ERROR_MESSAGES` (see [`src/lib/auth/types.ts`](../../../lib/auth/types.ts)), not the raw code.
- **Hidden `next` preservation** — when the page passes a non-default `next` value, the form serializes it into a hidden input named `next` so the POST round-trip preserves the original protected-route intent.
- **No password fields** — the rendered form contains zero `<input type="password">` elements. This is the smoke that prevents a regression back to the password UI.
- **Submit-button busy state** — the submit button is disabled while the form is mid-submit so a double-click cannot fire two `signInWithOtp` calls.

## Auth pages (`signin.astro`, `signup.astro`, `check-email.astro`)

- **`/auth/signin` query mapping** — when `?error=<code>` is present, the page passes it to `MagicLinkForm` and the friendly message renders. Unknown codes do not blow up the page.
- **`/auth/signin` `next` round-trip** — when `?next=/dashboard` is present, the hidden `next` input is populated and the value survives the POST → check-email round-trip back to the retry link.
- **`/auth/signup` parity** — `/auth/signup` either redirects to `/auth/signin` (preserving any `next`) or renders the same `MagicLinkForm`. Either way, no password field is present.
- **`/auth/check-email` retry link** — when a safe `next` value was requested, the retry link points at `/auth/signin?next=<encoded>`; when none was requested, the retry link points at `/auth/signin` without a `next` query.
- **Expired-link recovery copy** — when the confirm route redirects back with an `expired` / `invalid` style error code, `/auth/signin` renders the recovery message rather than the generic "missing config" message.

## Signout continuity

- **Dashboard / catalog signout forms** still POST to `/api/auth/signout` and respond with a redirect that clears the auth cookies. Coverage should assert that a passwordless-signed-in user can sign out through the existing surfaces without code changes.

## Notes for whoever adds the runner

- Astro `.astro` components are server-rendered; the recommended pattern for testing them is the [Astro Container API](https://docs.astro.build/en/reference/container-reference/) introduced in Astro 4+. React islands like `MagicLinkForm` can be tested in isolation with `@testing-library/react`.
- Whatever runner is chosen, wire it into `package.json` `scripts` and the CI workflow at [`.github/workflows/ci.yml`](../../../../.github/workflows/ci.yml) so the manual smoke recipe in [`context/changes/passwordless-auth-flow/supabase-config.md`](../../../../context/changes/passwordless-auth-flow/supabase-config.md) can shrink over time.

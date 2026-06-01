# Supabase Configuration — Passwordless Auth Flow

This checklist captures the Supabase-side settings that must be in place for the passwordless magic-link flow to work end-to-end. Code in this repo cannot enforce these — they live in `supabase/config.toml` for local dev and in the Supabase Dashboard for the deployed project.

> The verified `EmailOtpType` for this token-hash flow is **`magiclink`**. Use that exact string in the app (`verifyOtp({ type: "magiclink", token_hash })`), in the email template (`&type=magiclink`), and everywhere else you reference it.

## 1. Local development

### 1.1 Local Supabase project

Configured in [`supabase/config.toml`](../../../supabase/config.toml):

| Setting | Value | Notes |
| --- | --- | --- |
| `[auth].site_url` | `http://127.0.0.1:3000` | App must run on the same origin. |
| `[auth].additional_redirect_urls` | `["https://127.0.0.1:3000"]` | Path-only `next` does not need extra entries — only the origin matters for Supabase's allowlist. |
| `[auth.email].enable_signup` | `true` | `signInWithOtp({ shouldCreateUser: true })` requires this. |
| `[auth.email].enable_confirmations` | `false` | Magic links do not need the separate "confirm email" step. |
| `[auth.email.template.magic_link].subject` | `"Your SendLog sign-in link"` | |
| `[auth.email.template.magic_link].content_path` | `"./supabase/templates/magic_link.html"` | Custom template using `{{ .TokenHash }}` — required for SSR. |

### 1.2 Magic link email template

[`supabase/templates/magic_link.html`](../../../supabase/templates/magic_link.html) must contain the token-hash callback link. The link MUST be exactly:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">
  Sign in to SendLog
</a>
```

The default Supabase template uses `{{ .ConfirmationURL }}`, which sends the user to the Supabase-hosted `/verify` endpoint and only puts the session into the URL hash fragment — that is incompatible with this app's SSR cookie flow. The `{{ .RedirectTo }}` value is built by the app at `/api/auth/magic-link` as `http://127.0.0.1:3000/auth/confirm?next=<encoded sanitized path>`, so appending `&token_hash=...&type=magiclink` produces the full callback URL that lands on `/auth/confirm`.

### 1.3 Local dev smoke recipe

1. Start the local Supabase stack (requires Docker):

   ```bash
   npx supabase start
   ```

2. Copy the local credentials printed by the CLI into both `.env` (Node tooling) and `.dev.vars` (Cloudflare local dev):

   ```bash
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_KEY=<anon key from supabase status>
   ```

3. Run the Astro dev server on the same origin as Supabase's `site_url`:

   ```bash
   npm run dev -- --host 127.0.0.1 --port 3000
   ```

   The default `npm run dev` origin is not `http://127.0.0.1:3000`, so passing the flags above is required unless `supabase/config.toml`'s `site_url` is intentionally changed.

4. Open the local Inbucket inbox at `http://127.0.0.1:54324` to inspect outgoing magic-link emails.

5. Walk the happy path:
   - Visit `http://127.0.0.1:3000/auth/signin`, submit a valid email — page redirects to `/auth/check-email`.
   - In Inbucket, open the latest email and inspect the link. The URL MUST start with `http://127.0.0.1:3000/auth/confirm?` and include `token_hash=...`, `type=magiclink`, and a `next=...` query param (even if `next` is just `/`).
   - Click the link in Inbucket. The browser should arrive at `/` (or the encoded `next` value if one was requested), with the Supabase auth cookies set.
   - In DevTools, confirm cookies named `sb-*-auth-token` were written for `127.0.0.1`.

6. Walk the protected-route preservation path:
   - Sign out, then open `http://127.0.0.1:3000/dashboard`. The middleware should redirect to `/auth/signin?next=%2Fdashboard`.
   - Submit your email, open the new email in Inbucket, and click the link. The callback should land on `/dashboard`, not `/`.

7. Walk the failure paths:
   - Reuse a magic link by clicking it twice — the second click should redirect to `/auth/signin` with a friendly recovery message.
   - Manually edit a magic link's `next` value to `https://evil.example` and open it — the callback should ignore the external URL and land on `/`.

Production smoke (Section 3) requires real email delivery and cannot be exercised against the local Inbucket stack.

## 2. Deployed Supabase project (staging / production)

The hosted Supabase project must be configured through the Supabase Dashboard. The deployed Worker URL recorded in [`context/changes/deployment/deployment-plan.md`](../deployment/deployment-plan.md) is `https://sendlog.samuel-liotta.workers.dev`; substitute your own subdomain if it differs.

### 2.1 Auth provider

Dashboard → Authentication → Providers → Email:

- **Enable email provider** — on.
- **Confirm email** — off (magic-link flow auto-creates users via `signInWithOtp({ shouldCreateUser: true })`; the separate confirmation step is not required).
- **Allow new users to sign up** — on.

### 2.2 URL configuration

Dashboard → Authentication → URL Configuration:

| Field | Value |
| --- | --- |
| **Site URL** | `https://sendlog.<your-subdomain>.workers.dev` |
| **Redirect URLs** (allow-list) | `https://sendlog.<your-subdomain>.workers.dev/**` |

If you also smoke-test against a preview deployment, add the preview origin's `/**` glob to the allow-list. The app builds the callback URL from the request's own origin, so any origin you want to test from must appear in this list.

### 2.3 Magic Link email template

Dashboard → Authentication → Email Templates → Magic Link:

- **Subject**: `Your SendLog sign-in link`
- **Body**: copy the contents of [`supabase/templates/magic_link.html`](../../../supabase/templates/magic_link.html). The link tag MUST be:

  ```html
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">
    Sign in to SendLog
  </a>
  ```

- Do NOT use the default `{{ .ConfirmationURL }}` template. It routes through Supabase's hosted `/verify` endpoint and writes the session into a URL fragment, which the SSR cookie flow cannot read.

## 3. Production smoke checklist

After the Dashboard settings above are saved, exercise the deployed flow with a real inbox:

1. Open `https://sendlog.<your-subdomain>.workers.dev/auth/signin`, submit an email you control, and confirm the check-email page renders.
2. Open the magic-link email in your inbox. The link MUST point at `https://sendlog.<your-subdomain>.workers.dev/auth/confirm?...` and include `token_hash`, `type=magiclink`, and a `next` query param.
3. Click the link. The browser should land on `/` and the page should reflect a signed-in user.
4. Sign out, open a protected URL (`/dashboard`), confirm the redirect to `/auth/signin?next=%2Fdashboard`, request a new link, and confirm the callback returns you to `/dashboard`.
5. Reuse the link (click it a second time) — the page should redirect back to `/auth/signin` with friendly recovery copy.
6. Manually edit the email link's `next` query value to `https://evil.example` and open it — the callback must ignore the external value and land on `/`.
7. From a passwordless-signed-in session, exercise the existing signout surface (dashboard form posts to `/api/auth/signout`) and confirm the user is signed out.

Each item above maps to a row in the Phase 3 Manual section of [`plan.md`'s `## Progress`](./plan.md#progress).

## 4. Rollback

To revert the Supabase side without changing app code:

1. Restore the default Supabase Magic Link template (`{{ .ConfirmationURL }}` body).
2. Re-enable any password-based provider settings you previously disabled.
3. Leave Site URL and Redirect URLs unchanged — they remain valid for any future flow.

App-side rollback is a code revert; no migration is required.

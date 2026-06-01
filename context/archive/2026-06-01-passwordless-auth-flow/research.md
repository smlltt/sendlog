---
change_id: passwordless-auth-flow
artifact: research
source: Context7 MCP (/websites/supabase, /supabase/ssr)
created: 2026-06-01
---

# Passwordless signup/login flow with Supabase

Research notes pulled from Supabase docs via Context7 (`/websites/supabase`, `/supabase/ssr`) on 2026-06-01. Framed against this repo's stack: **Astro 6 SSR on Cloudflare Workers + `@supabase/ssr` cookie sessions + middleware-resolved `context.locals.user`**.

## TL;DR

- **One call covers both signup and signin**: `supabase.auth.signInWithOtp({ email, options })`. With the default `shouldCreateUser: true`, Supabase auto-creates the user on first attempt; with `false` it only signs in existing users.
- **You pick the credential form via the email template**: `{{ .ConfirmationURL }}` → magic link; `{{ .Token }}` → 6-digit code; `{{ .TokenHash }}` → custom server-side verification URL. Magic link and OTP share the same implementation.
- **For server-rendered apps (us), do not use the default hash-fragment flow.** Override the email template so the link points at a server route like `/auth/confirm?token_hash=...&type=magiclink&next=/dashboard`. That route calls `supabase.auth.verifyOtp({ type, token_hash })`, which writes the session cookies via `@supabase/ssr`'s `setAll` and then redirects to `next`.
- `signInWithOtp` supports **PKCE when email is used**.
- **Auth provider config**: enable Email provider; set Site URL; add the callback URL (e.g. `https://app.example/auth/confirm`) and any post-login `next` targets to Redirect URLs.

---

## 1. Initiating the flow — `signInWithOtp`

Sends either a magic link or a one-time code to the user's email (or phone). Same method handles both **signup** (first-time) and **signin** (returning), gated by `shouldCreateUser`.

### Signature (JS)

```ts
const { data, error } = await supabase.auth.signInWithOtp({
  email: "user@example.com",
  options: {
    shouldCreateUser: true,        // default: true — set false for "login only"
    emailRedirectTo: "https://app.example/auth/confirm?next=/dashboard",
    // captchaToken?: string
    // data?: Record<string, any>  // attached as user_metadata on signup
  },
});
```

Key behaviours documented:

- If the user does not exist and `shouldCreateUser !== false`, the user is created. Otherwise the call returns without sending an email.
- `emailRedirectTo` controls where the magic link lands (must be in the project's Redirect URLs allowlist; the magic link's default destination is `SITE_URL`).
- For email, **PKCE flow is supported automatically**.

### Magic link vs. OTP code — picked in the email template

Same `signInWithOtp` call; the email template (Auth → Email Templates → "Magic Link") decides what the user receives:

| Template variable        | What the user gets                            | Verification flow                                  |
| ------------------------ | --------------------------------------------- | -------------------------------------------------- |
| `{{ .ConfirmationURL }}` | Clickable magic link (default)                | Hash-fragment client flow (`#access_token=...`) — **don't use for SSR** |
| `{{ .Token }}`           | 6-digit numeric code pasted into your UI      | Client calls `verifyOtp({ email, token, type })`   |
| `{{ .TokenHash }}`       | Clickable link to **your own** server route   | Server calls `verifyOtp({ token_hash, type })` — **recommended for SSR / this app** |

For an SSR app on Cloudflare Workers with cookie sessions, use `{{ .TokenHash }}` and build a server route — that's the only way the session cookies get written on the server in the same request that redirects the user.

---

## 2. Verifying — `verifyOtp`

Exchanges the token (or token hash) for a session. Same method covers all email flows; `type` selects which.

### Signature

```ts
const { data, error } = await supabase.auth.verifyOtp({
  type: "magiclink",       // EmailOtpType
  token_hash: "abc123...", // from URL when using {{ .TokenHash }}
  // OR:
  // email: "user@example.com",
  // token: "123456",      // when user pastes a 6-digit code
});
```

### `EmailOtpType` values

| Type            | When to use                                                         |
| --------------- | ------------------------------------------------------------------- |
| `signup`        | First-ever email confirmation after `signUp` (password flow)        |
| `magiclink`     | Passwordless login via magic link / OTP for **existing** users      |
| `email`         | Email OTP generic (paired with `signInWithOtp` for some flows)      |
| `invite`        | Invitation accepted by a new user                                   |
| `recovery`      | Password reset confirmation                                         |
| `email_change`  | Confirming a change to the user's email address                     |

The official Supabase guide ("Server-Side Auth → Login with Magic Link") uses `type=magiclink` for a unified passwordless link sent by `signInWithOtp`.

---

## 3. Server-side callback route (the SSR-correct pattern)

Documented for Next.js and SvelteKit in the Supabase docs; the pattern translates 1:1 to Astro API routes.

### Reference handler (SvelteKit, from docs)

```ts
// src/routes/auth/confirm/+server.js
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/account";

  const redirectTo = new URL(url);
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirectTo.searchParams.delete("next");
      redirect(303, redirectTo);
    }
  }

  redirectTo.pathname = "/auth/error";
  redirect(303, redirectTo);
};
```

### Astro adaptation (sketch — fits this repo)

```ts
// src/pages/auth/confirm.ts  — must export `const prerender = false`
import type { APIRoute } from "astro";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Invalid or expired link")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect(next);
};
```

Notes specific to this repo (per `AGENTS.md`):

- `prerender = false` is **mandatory** under `output: "server"`.
- `createClient` from `@/lib/supabase` already wires `getAll`/`setAll` into `AstroCookies`, so `verifyOtp`'s session-write goes through the same response cookies the redirect sets — no manual cookie plumbing needed.
- Use the existing structured error format on the way back to the user (`{ error: { code, message, context } }`) if you choose to surface errors as JSON instead of redirect query params.
- File naming: `confirm.ts` is fine since it lives in `src/pages/` (Astro routing), but any extracted helper should follow the `feature.handler.ts` dot-convention.

---

## 4. SSR cookie integration — what `@supabase/ssr` does for you

From `/supabase/ssr` (`createServerClient`):

- **One client per request.** Do not share across requests.
- **Lazy session load**: cookies are read on the first `getUser()` / `getSession()` / auth call. So `verifyOtp` will read existing cookies (if any) and then push the new session via `setAll`.
- **`setAll` is what writes the session.** When `verifyOtp` succeeds, the new tokens are handed to `setAll`, which in this repo calls `cookies.set(name, value, options)` on Astro's `AstroCookies`. The cookies land on the redirect response.
- **Default cookie name** is `sb-{project-ref}-auth-token`; default encoding `base64url`.
- **Token refresh is also handled via `setAll`** — same middleware-driven path the current app already uses for password-based sessions.

Server-side, `autoRefreshToken` and `detectSessionInUrl` are always disabled — confirming that the **hash-fragment magic-link flow is incompatible with SSR-only Supabase clients**. We must use the `token_hash` + server callback variant.

---

## 5. Supabase project configuration checklist

1. **Auth → Providers → Email**: enabled. Optionally disable "Enable email confirmations" if you want the very first `signInWithOtp` to create + log in the user in a single round trip (otherwise `signup` confirmation runs first; default behavior is fine for most apps).
2. **Auth → URL Configuration**:
   - `Site URL`: production origin (e.g. `https://sendlog.app`).
   - `Redirect URLs`: allowlist the callback URL pattern, e.g. `https://sendlog.app/auth/confirm` and `http://localhost:4321/auth/confirm` for local dev. Also list any post-login `next` targets if you redirect cross-origin.
3. **Auth → Email Templates → "Magic Link"**: replace
   ```html
   <a href="{{ .ConfirmationURL }}">Log In</a>
   ```
   with the server-side variant:
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard">
     Log in to sendlog
   </a>
   ```
   - If you want OTP **codes** in addition (or instead), edit the template to include `{{ .Token }}` and build a small "enter the code" form that POSTs to a server route calling `verifyOtp({ email, token, type: "email" })`.
4. **Rate limits** (Auth → Rate Limits): the default OTP/magic-link send rate is conservative; bump it for testing if needed. Magic-link tokens are single-use and short-lived (default ~1 hour, configurable in Auth settings).

---

## 6. Mapping onto the existing sendlog auth surface

Current state (from `src/pages/api/auth/` and `src/pages/auth/`):

- `POST /api/auth/signup` — `signUp({ email, password })`
- `POST /api/auth/signin` — `signInWithPassword({ email, password })`
- `POST /api/auth/signout` — `signOut()`
- Pages: `signin.astro`, `signup.astro`, `confirm-email.astro`
- Middleware: `src/middleware.ts` populates `context.locals.user`, gates `PROTECTED_ROUTES`.

Drop-in shape for passwordless (no migration needed — additive):

| Route                          | Purpose                                                      | Supabase call                                              |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `POST /api/auth/magic-link`    | Send magic-link email (signup-or-signin)                     | `signInWithOtp({ email, options: { emailRedirectTo } })`   |
| `GET /auth/confirm`            | Verify `token_hash` and establish session                    | `verifyOtp({ type, token_hash })`                          |
| (optional) `POST /api/auth/otp/verify` | Verify pasted 6-digit code                          | `verifyOtp({ email, token, type: "email" })`               |
| `auth/signin.astro`            | Add an email-only "Send magic link" form                     | (POSTs to `/api/auth/magic-link`)                          |
| `auth/check-email.astro`       | "We sent you a link" landing page (reuse `confirm-email.astro` UX) | n/a                                                        |

If keeping both password and passwordless flows, no schema changes are needed — both write to `auth.users` in Supabase.

---

## 7. Open questions / decisions for `/10x-frame` or `/10x-plan`

1. **Magic link only, OTP code only, or both?** Magic link is simpler; OTP code is friendlier on devices that open the link in a different browser than the one that initiated the flow (a real problem on iOS / desktop email clients).
2. **Signup gating** — keep `shouldCreateUser: true` (one-tap account creation) or `false` (require a separate explicit signup that creates the row server-side first)?
3. **Deprecate password auth** entirely, or run both in parallel? Roadmap currently shows password-based flow.
4. **Email template variants** — Supabase has separate templates for "Confirm signup", "Magic Link", "Invite User", "Reset Password", "Change Email Address". If we want a unified server-side callback, **all** templates we use must point at `/auth/confirm` with the right `type=`.
5. **`next` parameter handling** — sign it / restrict to same-origin to avoid open-redirect on the confirm route.
6. **Cloudflare Workers specifics** — `verifyOtp` is a plain `fetch` against the GoTrue server, so no Workers-only caveats expected. Confirm SUPABASE_URL is reachable from Workers (it is — already in production for password flow).
7. **Local dev** — Supabase local stack (`npx supabase start`) ships a fake SMTP at `http://localhost:54324` (Inbucket); magic-link emails land there automatically.

---

## Sources

- `/websites/supabase` → `docs/guides/auth/auth-email-passwordless`, `docs/reference/javascript/initializing`, `docs/guides/getting-started/tutorials/with-nextjs`, `docs/guides/getting-started/tutorials/with-sveltekit`, `docs/reference/swift/*` (cross-language reference for `signInWithOtp` / `verifyOtp` signature)
- `/supabase/ssr` → `_autodocs/api-reference/createServerClient.md`, `_autodocs/types.md` (cookie / SSR semantics)

---
change_id: passwordless-auth-flow
title: Passwordless auth flow
status: implementing
created: 2026-06-01
updated: 2026-06-01
archived_at: null
---

## Notes

- Context7 research captured in `research.md` (Supabase docs + `@supabase/ssr` reference, fetched 2026-06-01).
- Key takeaway: for this SSR app, use `signInWithOtp` + a custom `{{ .TokenHash }}` email template + a server route at `/auth/confirm` that calls `verifyOtp({ type, token_hash })`. Avoid the default hash-fragment magic-link flow.
- Open decisions parked in research §7 — pick those before `/10x-plan`.

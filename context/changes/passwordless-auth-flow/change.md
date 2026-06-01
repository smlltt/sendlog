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
- Phase 3 manual item **3.7** (deployed Supabase real-email smoke) is intentionally deferred to a post-merge follow-up: the deployed Worker only picks up the new flow after the auto-deploy CI job lands on `main`, and the Supabase Dashboard side of `supabase-config.md` must be applied before the smoke is meaningful. Tick 3.7 + run the `/10x-implement` epilogue (flip `status: implemented`, land the trailing edits) once the post-merge smoke passes against `https://sendlog.samuel-liotta.workers.dev`.

---
change_id: passwordless-auth-flow
title: Passwordless auth flow
status: archived
created: 2026-06-01
updated: 2026-06-01
archived_at: 2026-06-01T14:27:02Z
---

## Notes

- Context7 research captured in `research.md` (Supabase docs + `@supabase/ssr` reference, fetched 2026-06-01).
- Key takeaway: for this SSR app, use `signInWithOtp` + a custom `{{ .TokenHash }}` email template + a server route at `/auth/confirm` that calls `verifyOtp({ type, token_hash })`. Avoid the default hash-fragment magic-link flow.
- Open decisions parked in research §7 — pick those before `/10x-plan`.
- Phase 3 manual item **3.7** (deployed Supabase real-email smoke) was confirmed after the merge-to-main auto-deploy and Supabase Dashboard configuration landed against `https://sendlog.samuel-liotta.workers.dev`.

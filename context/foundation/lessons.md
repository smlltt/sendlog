# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Push Supabase migrations to production after every schema change

- **Context**: Any change under `supabase/migrations/*.sql` in this repo (tables, RLS, triggers for private-state / climbs / projects).
- **Problem**: Local `supabase start` applies migrations automatically; hosted production does not. If migrations are only merged in git, PostgREST returns `PGRST205` (table not in schema cache) and `/api/climbs` and other private-state writes fail with `upstream_error` while local dev still works.
- **Rule**: After adding or changing a migration, link the production Supabase project and push before considering the slice done: `npx supabase link --project-ref <ref>` (or interactive `npx supabase link`), then `npx supabase migration list`, `npx supabase db push --dry-run`, then `npx supabase db push`. Project ref is the dashboard Reference ID or the subdomain in `SUPABASE_URL`.
- **Applies to**: plan, plan-review, implement, impl-review

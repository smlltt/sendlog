# Repository Guidelines

sendlog is an Astro 6 SSR app on Cloudflare Workers with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui (new-york style).

## Tripwires

### Shared with `CLAUDE.md` (update both if changed)

- API routes under `src/pages/api/` must export `const prerender = false` — `output: "server"` in @astro.config.mjs still requires the per-route flag.
- Never concatenate Tailwind class strings — use `cn()` from `@/lib/utils` (clsx + tailwind-merge).
- No Next.js directives (`"use client"`, etc.) in React components.
- `SUPABASE_URL` / `SUPABASE_KEY` are server-only secrets (see @astro.config.mjs `env.schema`); never read them from client code.
- New Supabase tables: enable RLS with granular per-operation, per-role policies. Migration filenames: `YYYYMMDDHHmmss_short_description.sql` in `supabase/migrations/`.

### Canonical here (do not duplicate into `CLAUDE.md`)

- **Error response format**: Use `{ error: { code, message, context } }` object, never `{ error: string }`.
- **File naming**: Use `feature.handler.ts` pattern (dot separator), not `featureHandler.ts`.
- **Import convention**: Use absolute imports from `@/` prefix exclusively — no relative paths like `../../`.
- **Module structure**: Every module must have `index.ts`, `types.ts`, and `__tests__/` directory.
- **Date handling**: Always use UTC and the `formatDate()` helper — never raw `new Date().toISOString()`.

## Build, Test, and Development Commands

- `npm run dev` — start dev server (Cloudflare workerd).
- `npm run build` — production build via `@astrojs/cloudflare`.
- `npm run lint` / `npm run lint:fix` — ESLint, type-checked (@eslint.config.js).
- `npm run format` — Prettier with astro + tailwind plugins.
- `npm run guardrails` — static checks for i18n coverage and >2s progress-feedback primitives (CI runs this between lint and build). See @docs/verification/beta-flow-checklist.md for the matching manual checklist.
- `npx astro sync` — regenerate `.astro/types.d.ts`; CI runs this before lint.
- `npm run test:e2e` — Playwright e2e suite (local-only, not in CI yet). Run `npm run test:e2e:install` once for the Chromium binary.

No unit/integration test runner is configured; e2e is the only automated test layer. The e2e suite needs local Supabase running (`npx supabase start`, Docker) and a seeded Strapi catalog containing the fixture crag/route used by `tests/e2e/seed.spec.ts`. Two-user isolation specs additionally require two distinct test mailboxes (`E2E_TEST_EMAIL`, `E2E_TEST_EMAIL_B`) and serial execution (`workers: 1`, already set in `playwright.config.ts`) for Mailpit mailbox isolation and shared-DB cleanup ordering.

## Project Structure

- `src/pages/` — Astro pages and API routes; auth handlers at `src/pages/api/auth/{signin,signup,signout}.ts`.
- `src/components/{ui,auth}/` — UI islands; add shadcn/ui via `npx shadcn@latest add [name]`.
- `src/layouts/`, `src/lib/` (`supabase.ts`, `utils.ts`), `src/middleware.ts` (gates `PROTECTED_ROUTES`).
- `supabase/` — local config; migrations under `supabase/migrations/`.
- Path alias `@/*` → `./src/*` (@tsconfig.json). Shared types live in `src/types.ts`.

## Coding Style & Naming Conventions

- Prettier rules: `@.prettierrc.json`.
- ESLint config: `@eslint.config.js`. Prefix unused vars with `_`.
- Astro for static content/layout, React only when interactive. Extract hooks to `src/components/hooks/`.
- API routes export uppercase `GET` / `POST` and validate input with zod.

## Commit & Pull Request Guidelines

- Pre-commit (@.husky/pre-commit) runs `lint-staged`: `eslint --fix` on `*.{ts,tsx,astro}`, `prettier --write` on `*.{json,css,md}`. Do not bypass with `--no-verify`.
- CI (@.github/workflows/ci.yml): `npm ci` → `npx astro sync` → `npm run lint` → `npm run guardrails` → `npm run build` on push/PR to `main`. Requires `SUPABASE_URL` and `SUPABASE_KEY` repo secrets.
- Commit convention not yet established (3 commits in history); use short, imperative subjects until one is set.

## Environment & Deploy

- Node 22.14.0 (@.nvmrc).
- Copy `.env.example` → `.env` (Node) or `.dev.vars` (Cloudflare local; gitignored). Local Supabase: `npx supabase start` (needs Docker).
- Deploy: `npx wrangler deploy`. Set secrets via `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY`.


---
bootstrapped_at: 2026-05-25T12:41:58Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: sendlog
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: sendlog
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

SendLog is a small, after-hours web app with public catalog browsing, passwordless auth, private climb logs, and a 3-week MVP target, so the recommended TypeScript web starter keeps the build compact while bundling Astro, React, Supabase, Tailwind, and Cloudflare deployment defaults. `shadcn/ui` should be layered on top of the starter's Tailwind setup for polished reusable UI primitives rather than bare utilities alone. Strapi Cloud free tier is the planned admin/content-management layer for curated catalog data; it sits beside the main Astro app, while Supabase remains the starter's auth and application data foundation unless the implementation later consolidates catalog storage.
```

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| ------ | ----- | -------- | ----- |
| npm package | not run | n/a | `cmd_template` starts with `git clone`, so no npm create package was derived. |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-05-17T10:33:39Z | fresh | from card.docs_url |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted

**CLI output notes**: `npm install` completed with Node engine warnings for local Node `v22.12.0` where some ESLint packages require `^20.19.0 || ^22.13.0 || >=24`. npm also reported 10 vulnerabilities, captured below by the post-scaffold audit.

### Move log

```text
deleted .bootstrap-scaffold/.git
moved .env.example
moved .github
moved .gitignore
moved .husky
moved .nvmrc
moved .prettierrc.json
moved .vscode
moved CLAUDE.md
moved README.md
moved astro.config.mjs
moved components.json
moved eslint.config.js
moved node_modules
moved package-lock.json
moved package.json
moved public
moved src
moved supabase
moved tsconfig.json
moved wrangler.jsonc
```

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0
**Audit exit code**: 1 (npm exits non-zero when vulnerabilities are present)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive)
  - Range: `5.6.3 - 5.8.0`
  - Via: Svelte devalue: DoS via sparse array deserialization (https://github.com/advisories/GHSA-77vg-94rm-hx3p)
  - Fix: available

#### MODERATE findings

- **@astrojs/check** (direct)
  - Range: `>=0.9.3`
  - Via: @astrojs/language-server
  - Fix: @astrojs/check 0.9.2
- **@astrojs/language-server** (transitive)
  - Range: `>=2.14.0`
  - Via: volar-service-yaml
  - Fix: @astrojs/check 0.9.2
- **@cloudflare/vite-plugin** (transitive)
  - Range: `<=0.0.0-fff677e35 || 0.0.7 - 1.37.2`
  - Via: miniflare; wrangler; ws
  - Fix: available
- **miniflare** (transitive)
  - Range: `<=0.0.0-fff677e35 || 3.20250204.0 - 4.20260518.0`
  - Via: ws
  - Fix: available
- **volar-service-yaml** (transitive)
  - Range: `<=0.0.70`
  - Via: yaml-language-server
  - Fix: @astrojs/check 0.9.2
- **wrangler** (direct)
  - Range: `<=0.0.0-kickoff-demo || 3.108.0 - 4.93.0`
  - Via: miniflare
  - Fix: available
- **ws** (transitive)
  - Range: `8.0.0 - 8.20.0`
  - Via: ws: Uninitialized memory disclosure (https://github.com/advisories/GHSA-58qx-3vcg-4xpx)
  - Fix: available
- **yaml** (transitive)
  - Range: `2.0.0 - 2.8.2`
  - Via: yaml is vulnerable to Stack Overflow via deeply nested YAML collections (https://github.com/advisories/GHSA-48c2-rrv3-qjmp)
  - Fix: @astrojs/check 0.9.2
- **yaml-language-server** (transitive)
  - Range: `1.11.1-08d5f7b.0 - 1.21.1-f1f5a94.0 || 1.22.1-0ae5603.0 - 1.22.1-fc5f874.0`
  - Via: yaml
  - Fix: @astrojs/check 0.9.2

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| ---- | ----- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.

## Addendum: Strapi sidecar scaffold

Bootstrapper v1 is single-starter per hand-off; `tech-stack.md` carried only `10x-astro-starter` in its frontmatter, while Strapi was named in the body prose ("Strapi Cloud free tier is the planned admin/content-management layer ... sits beside the main Astro app"). To keep the project complete, Strapi was scaffolded as a sidecar after the chain-mode run, outside the formal bootstrapper flow. Not in the starter registry — manual scaffold.

**Scaffolded at**: 2026-05-25T12:52:28Z
**Tool**: `create-strapi-app` v5.46.1 (npm package time.modified 2026-05-23T01:03:41Z, fresh)
**Strapi repo recency**: `strapi/strapi` last pushed 2026-05-25T12:24:21Z (fresh)
**Resolved invocation**: `npx --yes create-strapi-app@latest admin --quickstart --skip-cloud --no-run --use-npm`
**Strategy**: native subdir (CLI creates `admin/` and scaffolds into it)
**Exit code**: 0
**Placement decision**: `admin/` subdirectory (matches the "admin/content-management layer" wording in the hand-off and the "sits beside the main Astro app" placement)
**Nested git**: Strapi auto-ran `git init` inside `admin/`; that `admin/.git/` was removed so a future root-level repo strategy is not blocked by a nested repo

### Post-scaffold audit (admin/)

**Tool**: `npm audit --json` (run from `admin/`)
**Summary**: 0 CRITICAL, 13 HIGH, 19 MODERATE, 2 LOW
**Direct vs transitive**: 0/3/0/0 direct of total 0/13/19/2
**Audit exit code**: 1 (npm exits non-zero when vulnerabilities are present)

#### CRITICAL findings

None.

#### HIGH findings

- **@strapi/plugin-cloud** (direct)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-alpha.0`
  - Via: @strapi/admin; @strapi/design-system; @strapi/strapi
  - Fix: @strapi/plugin-cloud 5.9.0
- **@strapi/plugin-users-permissions** (direct)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=4.1.8`
  - Via: @strapi/design-system; @strapi/strapi; grant
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **@strapi/strapi** (direct)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=4.6.0-alpha.0`
  - Via: @strapi/admin; @strapi/content-manager; @strapi/content-releases
  - Fix: @strapi/strapi 4.26.1
- **@strapi/admin** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=4.6.0-alpha.0`
  - Via: @strapi/data-transfer; @strapi/design-system; @strapi/permissions
  - Fix: @strapi/strapi 4.26.1
- **@strapi/content-manager** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-beta.6`
  - Via: @strapi/admin; @strapi/design-system; @strapi/types
  - Fix: @strapi/strapi 4.26.1
- **@strapi/content-releases** (transitive)
  - Range: `*`
  - Via: @strapi/admin; @strapi/content-manager; @strapi/design-system
  - Fix: @strapi/strapi 4.26.1
- **@strapi/content-type-builder** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-beta.6`
  - Via: @strapi/admin; @strapi/design-system; qs
  - Fix: @strapi/strapi 4.26.1
- **@strapi/design-system** (transitive)
  - Range: `>=1.20.0-typescript.0`
  - Via: lodash
  - Fix: @strapi/plugin-cloud 5.9.0
- **@strapi/email** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-beta.6`
  - Via: @strapi/admin; @strapi/design-system
  - Fix: @strapi/strapi 4.26.1
- **@strapi/i18n** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-beta.6`
  - Via: @strapi/admin; @strapi/content-manager; @strapi/design-system
  - Fix: available
- **@strapi/review-workflows** (transitive)
  - Range: `*`
  - Via: @strapi/admin; @strapi/content-manager; @strapi/design-system
  - Fix: available
- **@strapi/upload** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=5.0.0-beta.6`
  - Via: @strapi/admin; @strapi/design-system; qs
  - Fix: available
- **lodash** (transitive)
  - Range: `<=4.17.23`
  - Via: lodash vulnerable to Code Injection via `_.template` imports key names (https://github.com/advisories/GHSA-r5fr-rjxr-66jc); lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit` (https://github.com/advisories/GHSA-f23m-r3pf-42rh)
  - Fix: @strapi/plugin-cloud 5.9.0

#### MODERATE findings

- **@rushstack/node-core-library** (transitive)
  - Range: `5.0.0 - 5.20.2`
  - Via: ajv
  - Fix: available
- **@rushstack/terminal** (transitive)
  - Range: `0.11.1 - 0.22.2`
  - Via: @rushstack/node-core-library
  - Fix: available
- **@rushstack/ts-command-line** (transitive)
  - Range: `4.21.1 - 5.3.2`
  - Via: @rushstack/terminal
  - Fix: available
- **@strapi/core** (transitive)
  - Range: `*`
  - Via: @strapi/admin; @strapi/permissions; @strapi/types
  - Fix: available
- **@strapi/data-transfer** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=4.6.0-alpha.0`
  - Via: @strapi/types; ws
  - Fix: @strapi/strapi 4.26.1
- **@strapi/permissions** (transitive)
  - Range: `>=4.14.0-alpha.0`
  - Via: qs
  - Fix: @strapi/strapi 4.26.1
- **@strapi/types** (transitive)
  - Range: `<=0.0.0-next.ffc36acb308febe288f1a31b62cbbb75b286585c || >=4.14.0`
  - Via: @strapi/permissions
  - Fix: @strapi/strapi 4.26.1
- **@vitejs/plugin-react-swc** (transitive)
  - Range: `<=3.7.1`
  - Via: vite
  - Fix: available
- **ajv** (transitive)
  - Range: `7.0.0-alpha.0 - 8.17.1`
  - Via: ajv has ReDoS when using `$data` option (https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)
  - Fix: available
- **esbuild** (transitive)
  - Range: `<=0.24.2`
  - Via: esbuild enables any website to send any requests to the development server and read the response (https://github.com/advisories/GHSA-67mh-4wv8-2f99)
  - Fix: @strapi/strapi 4.26.1
- **grant** (transitive)
  - Range: `>=4.0.0`
  - Via: jwk-to-pem; request-oauth
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **koa-session** (transitive)
  - Range: `5.11.0 - 7.0.0`
  - Via: uuid
  - Fix: available
- **purest** (transitive)
  - Range: `>=4.0.0`
  - Via: request-multipart; request-oauth
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **qs** (transitive)
  - Range: `6.11.1 - 6.15.1`
  - Via: qs has a remotely triggerable DoS: qs.stringify crashes with TypeError on null/undefined entries in comma-format arrays when encodeValuesOnly is set (https://github.com/advisories/GHSA-q8mj-m7cp-5q26)
  - Fix: @strapi/strapi 4.26.1
- **request-multipart** (transitive)
  - Range: `*`
  - Via: uuid
  - Fix: available
- **request-oauth** (transitive)
  - Range: `*`
  - Via: uuid
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **uuid** (transitive)
  - Range: `<11.1.1`
  - Via: uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided (https://github.com/advisories/GHSA-w5hq-g745-h8pq)
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **vite** (transitive)
  - Range: `<=6.4.1`
  - Via: Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling (https://github.com/advisories/GHSA-4w7w-66w2-5vf9); esbuild
  - Fix: @strapi/strapi 4.26.1
- **ws** (transitive)
  - Range: `8.0.0 - 8.20.0`
  - Via: ws: Uninitialized memory disclosure (https://github.com/advisories/GHSA-58qx-3vcg-4xpx)
  - Fix: @strapi/strapi 4.26.1

#### LOW / INFO findings

- **elliptic** (transitive)
  - Range: `*`
  - Via: Elliptic Uses a Cryptographic Primitive with a Risky Implementation (https://github.com/advisories/GHSA-848j-6mx2-7j84)
  - Fix: @strapi/plugin-users-permissions 5.9.0
- **jwk-to-pem** (transitive)
  - Range: `*`
  - Via: elliptic
  - Fix: @strapi/plugin-users-permissions 5.9.0

### Notes for the user

- `admin/.env` was generated by the Strapi CLI with random APP_KEYS, JWT_SECRET, etc. Treat it as local-dev only; production secrets should land in Strapi Cloud or your secret manager, not in source control.
- Database defaults to SQLite at `admin/.tmp/data.db`. Swap to PostgreSQL in `admin/config/database.ts` before pointing at Strapi Cloud or any shared environment.
- The Astro app (root) and Strapi app (`admin/`) each have their own `node_modules/` and `package.json`. They do not share a workspace today; if you later want pnpm/npm workspaces, that is a follow-up refactor.
- Strapi was scaffolded as a sidecar outside the bootstrapper registry. If you want it formally tracked, add a `strapi-admin` (or similar) entry to `/skills/10x-tech-stack-selector/references/starter-registry.yaml` and a matching `cwd_strategy` row in `bootstrapper-config.yaml`, then a future re-run can flow through the registry.

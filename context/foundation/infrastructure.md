---
project: sendlog
researched_at: 2026-05-25T14:45:00Z
recommended_platform: Cloudflare Workers + Static Assets
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR + React 19 islands
  runtime: Cloudflare Workers
---

## Recommendation

**Deploy on Cloudflare Workers + Static Assets.**

Cloudflare is the best fit for this MVP because the repository is already configured for `@astrojs/cloudflare` v13, Workers Static Assets, `wrangler` 4.x, `nodejs_compat`, and `output: "server"`. The interview constraints do not require persistent processes, global edge is not mandatory but still useful, and external services are acceptable, so Cloudflare's zero-container, CLI-first deployment path wins on speed, cost, and operational simplicity.

The admin/content-management app is treated as an external dependency for this decision. The current plan in `context/foundation/tech-stack.md` is Strapi Cloud for curated catalog content; self-hosting or replacing that admin surface should be handled as a separate infrastructure decision if the plan changes.

## Platform Comparison

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers + Static Assets | Pass | Pass | Pass | Pass | Pass | 5/5 |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4.5/5 |
| Netlify | Partial | Pass | Pass | Partial | Pass | 4/5 |
| Railway | Pass | Pass | Pass | Pass | Partial | 4.5/5 |
| Render | Pass | Pass | Pass | Pass | Pass | 5/5 |
| Fly.io | Partial | Partial | Partial | Partial | Partial | 2.5/5 |

Cloudflare scores highest for this repo despite Render's nominal 5/5 because Cloudflare is the only platform that matches the already-selected adapter and runtime without converting the app to `@astrojs/node`. Workers Static Assets is the canonical path for new Astro 6 Cloudflare deployments; Pages still exists, but new platform features are Workers-first.

Vercel is a strong fallback. It has excellent CLI support, agent-readable docs, and a reliable Astro adapter, but the project would need an adapter switch to `@astrojs/vercel`, explicit EU region config such as `fra1`, and extra care around Supabase SSR cookie handling on Node serverless. Vercel MCP is Public Beta, so it is a weaker agent-ops signal than Cloudflare's current MCP surface.

Netlify has a good Astro story and GA MCP, but SSR runs on Lambda-style functions with cold starts, there is no CLI rollback, and the 2026 300-credit free cap can be consumed by frequent production deploys. It remains a credible fallback but is not better than Cloudflare for this app.

Railway and Render both work for Astro SSR through `@astrojs/node`, but that would replace the current Cloudflare adapter path with a Node web-service model. Railway has strong DX but only Amsterdam for EU; Render has Frankfurt and a solid MCP server, but free web services sleep after inactivity and paid production starts at the web-service tier.

Fly.io is technically capable and useful if full Node/Docker control or persistent processes become important. For this MVP, it adds Dockerfile, `fly.toml`, machine sizing, always-on billing, and more operational surface without solving a current requirement.

### Shortlisted Platforms

#### 1. Cloudflare Workers + Static Assets (Recommended)

Cloudflare wins because it is already the target runtime in the codebase and keeps the MVP deployment path small: `npm run build`, `wrangler deploy`, Workers secrets, and Workers Observability. The free tier comfortably covers the expected 10k-100k monthly requests, and `astro dev` now runs workerd via the Cloudflare Vite plugin, so local runtime fidelity is strong without a separate `wrangler dev` loop.

#### 2. Vercel

Vercel is the best fallback if Cloudflare-specific runtime issues block progress. Its Astro adapter defaults to Node serverless, the Hobby tier is ample for MVP traffic, and docs are highly agent-readable. The gap is migration work: replace the Cloudflare adapter, configure EU region placement, avoid Edge runtime for Supabase auth middleware, and accept Beta MCP.

#### 3. Netlify

Netlify is the third option because it has a strong agent-native MCP story and good Astro support. The weaker points are operational: SSR cold starts, no CLI rollback, a newly changed credit model, and less alignment with the current Cloudflare-oriented starter.

## Anti-Bias Cross-Check: Cloudflare Workers + Static Assets

### Devil's Advocate - Weaknesses

1. Astro 6 is still marked beta in Cloudflare framework guidance, so exact adapter behavior may change faster than a stable framework path.
2. Workers is not full Node.js. `nodejs_compat` helps Supabase SSR, but packages with dynamic `require`, native modules, or unsupported Node APIs can still fail on workerd.
3. Pages-to-Workers convergence means older Cloudflare tutorials can give wrong commands or config for `@astrojs/cloudflare` v13.
4. The Workers free tier has a 3 MB Worker bundle limit; React islands, Supabase, maps, and future dependencies could push the SSR bundle toward that limit.
5. Supabase and Strapi Cloud remain external network calls, so edge deployment does not remove upstream latency for auth, database, or catalog admin operations.

### Pre-Mortem - How This Could Fail

Six months after launch, the decision fails because the team follows a mix of old Pages tutorials and new Workers Static Assets docs, creating a brittle deploy script that behaves differently from local dev. A map or UI dependency pulls in a Node-only transitive package that passes lint but breaks in workerd. Meanwhile, the SSR bundle grows beyond the free tier limit, forcing an unplanned paid-tier or dependency-trimming sprint. Supabase auth mostly works, but cookie refresh behavior around magic links is under-tested, so beta users occasionally hit double-login or expired-session flows at the crag. Because the app has very low traffic, these failures appear sporadically and are hard to reproduce, making the platform feel unreliable even though the root causes are config drift and missing runtime tests.

### Unknown Unknowns

- `astro dev` now runs workerd through the Cloudflare Vite plugin; older advice to use `wrangler dev` for local fidelity may be redundant or misleading.
- Deploying to Cloudflare environments requires building with `CLOUDFLARE_ENV=<env> astro build` before `wrangler deploy --env <env>`.
- The Cloudflare adapter may default image handling to Cloudflare Images bindings; image transformations can introduce separate usage costs if the catalog later becomes image-heavy.
- `wrangler secret put` immediately after deploy can race; update secrets before deploy.
- Moving from Supabase or Strapi Cloud to Cloudflare-native D1/R2/KV later is a schema and content migration, not a simple hosting switch.

## Operational Story

- **Preview deploys**: GitHub Actions can run `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build` for PR validation. Cloudflare preview deployments can be added later via Wrangler environments or Cloudflare's Git integration; protect public preview URLs with Cloudflare Access if real catalog/admin data appears there.
- **Secrets**: `SUPABASE_URL` and `SUPABASE_KEY` stay server-only. Local development uses `.dev.vars`; production uses `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY`. Rotate by setting the new secret first, deploying, then revoking the old credential in Supabase.
- **Rollback**: Use `wrangler deployments list` to identify the previous version and `wrangler rollback <VERSION_ID>` to revert the Worker. Database migrations and Supabase data changes do not roll back automatically.
- **Approval**: An agent may run read-only checks, build, lint, view logs, and prepare deploy commands. A human should approve production deploys, secret rotation, DNS changes, Supabase migrations, and any destructive catalog/admin action.
- **Logs**: Use `wrangler tail` for live runtime logs and Cloudflare Workers Observability for queryable logs and metrics. With MCP configured, use Cloudflare docs and observability servers for read-only investigation before making deployment changes.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Astro 6 / adapter behavior shifts before the stack fully stabilizes | Devil's advocate / Research finding | M | M | Pin versions, keep `@astrojs/cloudflare` release notes in review, and run `npm run build` before every deploy. |
| Workerd incompatibility from a dependency | Devil's advocate / Pre-mortem | M | H | Prefer edge-compatible packages, test auth and route handlers locally with `astro dev`, and verify production with a smoke request after deploy. |
| Outdated Pages guidance causes bad deployment setup | Devil's advocate / Unknown unknowns | M | M | Treat Workers Static Assets as canonical; avoid `pages deploy` tutorials for this repo. |
| Worker bundle exceeds the free tier limit | Devil's advocate / Pre-mortem | L | M | Watch build output and dependency growth; split heavy interactive UI into client islands only when needed; move to paid Workers if justified. |
| Supabase SSR auth cookie issues | Pre-mortem / Research finding | M | H | Keep auth routes server-rendered, avoid caching responses with `Set-Cookie`, and add manual magic-link sign-in smoke tests. |
| External Supabase or Strapi latency dominates request time | Devil's advocate / Unknown unknowns | M | M | Put Supabase in an EU region, cache public catalog reads where safe, and keep Strapi Cloud out of latency-critical route logging paths. |
| Cloudflare image transformation costs surprise the project later | Unknown unknowns | L | M | Decide explicitly whether to use Cloudflare Images; keep MVP route/catalog data text-first unless images are needed. |
| Secret update race during deploy | Unknown unknowns / Research finding | L | H | Update Workers secrets before deploying code that depends on them; verify with `wrangler tail` after deploy. |
| Admin app deployment scope expands beyond Strapi Cloud | User clarification / Research finding | M | M | Keep Strapi Cloud as an external dependency for this decision; run a separate admin deployment decision before self-hosting Strapi. |

## Getting Started

1. Confirm Cloudflare account auth locally with `npx wrangler whoami`; if needed, run `npx wrangler login`.
2. Rename the Worker in `wrangler.jsonc` from the starter value to the production project name before first deploy.
3. Set production secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
4. Run `npm run build` locally; Astro 6 with `@astrojs/cloudflare` v13 builds the Worker and static assets for the current `wrangler.jsonc`.
5. Deploy with `npx wrangler deploy`, then verify the public catalog page, magic-link sign-in callback, and a logged-in route action while watching `npx wrangler tail`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
- Self-hosted Strapi or alternative admin-app deployment

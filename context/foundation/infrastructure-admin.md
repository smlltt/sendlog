---
project: sendlog
scope: admin-cms
researched_at: 2026-05-25T15:01:00Z
recommended_platform: Strapi Cloud (Free)
runner_up: Self-hosted Strapi v5 on a managed PaaS
context_type: mvp
tech_stack:
  language: TypeScript / Node 22
  framework: Strapi v5
  runtime: Strapi Cloud (managed)
related_decisions:
  - context/foundation/infrastructure.md  # user-facing app on Cloudflare Workers
---

## Recommendation

**Deploy the admin/content-management app on Strapi Cloud (Free plan).**

SendLog is explicitly non-commercial and an MVP, so the Strapi Cloud Free plan's non-commercial license is acceptable, and the included quota fits a single admin curating a small Sokoliki catalog. The user already has Strapi familiarity, the platform is fully managed (no persistent process for the user to operate), and Strapi Cloud owns the CMS database and media as preferred — keeping admin content separate from Supabase application data.

The Astro user-facing app on Cloudflare Workers (see `context/foundation/infrastructure.md`) reads catalog content from Strapi Cloud's REST/GraphQL API and is expected to cache it aggressively at the edge so admin reads stay well below the Free quota.

## Platform Comparison

This admin decision evaluated two completed research paths. Four additional options (Sanity, Contentful, Directus Cloud, Supabase-backed custom admin) were intentionally not researched in depth because the project is non-commercial MVP and the Strapi Cloud Free plan is already a known good fit; they remain available as future alternatives if Strapi Cloud later breaks.

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Strapi Cloud (Free) | Partial | Pass | Pass | Partial | Partial | 3.5/5 |
| Self-hosted Strapi on Render/Railway/Fly | Pass | Pass | Pass | Pass | Partial | 4.5/5 |
| Sanity, Contentful, Directus, Supabase admin | not evaluated | not evaluated | not evaluated | not evaluated | not evaluated | n/a |

Self-hosted Strapi scores higher on the agent-friendly criteria because the underlying PaaS (Fly, Railway, or Render) has a strong CLI, deploy API, and observability story. The reason it is the runner-up rather than the recommendation is operational: it adds a persistent Node process plus a database to operate, contradicts the answer "no persistent admin process required," carries an admin-takeover CVE history that demands aggressive patching, and requires external object storage (R2/S3) because Railway and Fly have ephemeral disks. For a non-commercial MVP, that ops burden is not justified.

### Shortlisted Platforms

#### 1. Strapi Cloud Free (Recommended)

- Fully managed Strapi v5 with admin UI, REST/GraphQL, Postgres, media + CDN, Git-based deploys.
- Non-commercial Free plan is permanent and fits SendLog's stated non-commercial MVP scope.
- EU-West region available for Polish admins; region is immutable at project creation.
- Docs are unusually agent-readable (published `llms.txt`, `llms-full.txt`, `llms-code.txt`, and `AGENTS.md`).
- CLI is limited to `login` / `logout` / `deploy`; rollback, env vars, and runtime logs are dashboard-only.
- Free quota in current GA is small (about 2,500 requests/month), but the Astro Worker is expected to edge-cache catalog reads so this is unlikely to be the binding constraint.

#### 2. Self-hosted Strapi v5 on a managed PaaS (Fallback)

- Strapi v5.46.1 is current GA; v6 is not out yet, so v5 is the right floor.
- Approximate MVP cost: about $5-13/mo across Fly, Railway, or Render, including small managed Postgres and object storage.
- Railway's Amsterdam region is the closest EU option for Polish admin latency.
- Mandatory hard requirements on day one: HTTPS plus `proxy: { koa: true }` (admin login fails silently otherwise), Cloudflare R2 or S3 for uploads (local disk is ephemeral on Railway and Fly), and prompt patching for admin-takeover CVEs (e.g., GHSA-rjg2-95x7-8qmx fixed in 5.37.0).
- Useful as a fallback if Strapi Cloud Free becomes blocking (license change, quota change, missing capability), but should not be adopted preemptively.

#### 3. Other CMS options (not evaluated)

Sanity, Contentful, Directus Cloud, and a Supabase-backed custom admin path were considered as candidates but the research subagents for each were aborted before completing. The user's reasoning: non-commercial MVP scope means Strapi Cloud Free is sufficient and a broader comparison is not justified at this stage. If Strapi Cloud Free becomes blocking later, those options should be researched at that time rather than now.

## Anti-Bias Cross-Check: Strapi Cloud Free

### Devil's Advocate - Weaknesses

1. The Free plan license is non-commercial; the day SendLog adds donations, ads, or any paid feature, the license is violated and the project must move to Essential (~$180/yr) or migrate off Strapi Cloud.
2. The Free quota in current GA is roughly 2,500 requests/month; without edge caching in the Astro Worker, even a small audience can exhaust the quota and break the public catalog.
3. The Strapi Cloud region is selected at project creation and cannot be changed later — picking the wrong region locks in admin latency for the life of the project.
4. Free-tier cold starts can make admin edits slow or feel unreliable for short sessions, which is exactly the after-hours pattern this MVP uses.
5. CLI coverage is narrow (deploy only); rollback, env vars, and runtime logs are dashboard-first, so an agent cannot complete the full ops loop unattended.
6. Strapi v6 has not shipped yet; choosing managed v5 today means accepting Strapi Cloud's managed major-version upgrade timeline when v6 lands.
7. Media library has no managed backup beyond Strapi's standard infrastructure; assets are not snapshotted by you.
8. Direct database access is restricted on the current Strapi Cloud infra (a migration is publicly planned for 2026), so schema-level debugging and ad-hoc SQL are not options.

### Pre-Mortem - How This Could Fail

Six months in, the SendLog admin quietly drifts toward something commercial — a donation button, a Patreon link, or "premium" photos — and silently violates the Strapi Cloud Free non-commercial license, forcing an unplanned upgrade or migration. Meanwhile, the public catalog gains a small audience and the Astro Worker is not caching Strapi reads aggressively enough, so the 2,500 request/month Free quota is exhausted mid-month and the catalog starts returning empty data right when climbers visit. The region was chosen reactively at signup and turns out to add 200-300 ms to every admin edit. A custom plugin to import a paper topo PDF was attempted, but restricted plugin build steps and no direct DB access made it a manual web form. Cold starts hit every morning before the user opens the admin, making editorial flow frustrating. When the user finally decides to migrate off, the export covers structured content but not the curated media or carefully crafted plugin code, blocking a clean exit.

### Unknown Unknowns

- Strapi Cloud's documentation includes `llms.txt`, `llms-full.txt`, `llms-code.txt`, and `AGENTS.md`, so the docs are unusually agent-friendly, but the dashboard-first CLI gap means an agent still cannot fully drive Strapi Cloud — it must rely on admin REST or guided dashboard work.
- Strapi v6 will eventually ship; on Strapi Cloud, the upgrade is managed but on Strapi's timeline, not yours.
- Astro on Cloudflare Workers calling Strapi Cloud is cross-vendor: Worker EU to Strapi Cloud EU-West is acceptable but not edge-local, so Worker cache plus KV/Cache API is needed to amortize the calls.
- Community MCP servers (devels-ai, VirtusLab) exist but are unofficial and tend to lag Strapi major releases, so MCP-first ops should not be assumed.
- Strapi Cloud's media library is not separately backed up; protecting content requires scripted exports via the Content API on a cadence.

## Operational Story

- **Preview deploys**: Strapi Cloud deploys from a connected Git branch. Preview environments are configured in the Strapi Cloud dashboard, not the CLI. Cloud previews are private by Strapi Cloud auth; do not put production secrets on a preview project.
- **Secrets**: Strapi Cloud environment variables live in the project dashboard and are not editable from CLI in current GA. The Astro Cloudflare Worker reads Strapi via an API token stored as a Worker secret: `npx wrangler secret put STRAPI_API_TOKEN`. Rotate by issuing a new token in Strapi Cloud, updating the Worker secret, and revoking the old token after a successful deploy.
- **Rollback**: Use the deploy history view in the Strapi Cloud dashboard; there is no CLI rollback in current GA. Content changes since the target deploy are not rolled back.
- **Approval**: A human approves Strapi Cloud project creation, region choice, any plan upgrade, content destructive operations (deleting regions/crags/routes), and the eventual Strapi v6 upgrade. An agent may run `strapi deploy` from a connected repo, edit content via the admin REST, and prepare content exports.
- **Logs**: Strapi Cloud runtime and build logs are read from the project dashboard; the CLI does not stream runtime logs in current GA. For admin app issues, the dashboard log viewer is the canonical source.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SendLog becomes commercial and violates Free non-commercial license | Devil's advocate / Pre-mortem | M | M | Keep SendLog explicitly non-commercial in the PRD; if monetization is ever added, budget Essential (~$180/yr) or migrate to a different CMS before launch. |
| Free request quota exhausted by uncached Astro catalog reads | Devil's advocate / Pre-mortem | M | H | Edge-cache catalog responses in the Cloudflare Worker (Cache API and/or KV) with sensible TTL and stale-while-revalidate; revalidate only after admin writes. |
| Wrong region selected at project creation (immutable) | Devil's advocate / Unknown unknowns | L | M | Select Europe-West at project creation; verify region before adding any content. |
| Cold-start latency makes admin sessions frustrating | Devil's advocate | M | L | Accept relaxed editorial timing; warm the admin with one request before editing sessions; revisit if it blocks usage. |
| Media library has no managed backup | Devil's advocate / Unknown unknowns | L | M | Run a periodic scripted export via the Content API, store snapshots in a separate location (e.g. Cloudflare R2 or the SendLog repo). |
| No direct DB access on current infra | Devil's advocate / Research finding | M | M | Limit operations to admin UI and Content API; defer any schema-level debugging until the 2026 infra migration ships. |
| CLI is deploy-only; agents cannot complete the full ops loop | Devil's advocate / Research finding | H | L | Accept dashboard-first ops for the admin app; concentrate agent automation on the Astro user-facing app where CLI coverage is strong. |
| Strapi v5 today, v6 transition on Strapi's timeline | Devil's advocate / Unknown unknowns | M | M | Trust Strapi Cloud's managed upgrade path; review v6 release notes before approving the managed upgrade. |
| Community MCP servers lag Strapi releases | Unknown unknowns | M | L | Treat MCP as a nice-to-have; rely on admin UI and REST for the MVP. |

## Getting Started

1. Decide repo layout for the admin app (separate `sendlog-admin` repo, or `apps/admin/` in a monorepo) and scaffold Strapi v5 locally with the latest 5.x.
2. In the Strapi Cloud dashboard, create a new project from that repo, **select Europe-West as the region**, and confirm the project starts on the Free plan.
3. Confirm in the PRD/README that SendLog is non-commercial; this is the license precondition for the Free plan.
4. In the Astro repo, issue an API token in Strapi Cloud and store it on the Worker with `npx wrangler secret put STRAPI_API_TOKEN`; reference it server-side only.
5. Wire the Astro catalog routes to fetch from Strapi Cloud's REST or GraphQL API behind the Cloudflare Cache API or a KV-backed cache, so admin reads stay well below the Free quota and the user-facing app stays fast at the crag.

## Out of Scope

- Self-hosting Strapi (kept as a documented fallback only; not implemented).
- Migrating from Strapi Cloud to a different CMS (Sanity, Contentful, Directus, custom Supabase admin) — to be researched only if Strapi Cloud Free becomes blocking.
- CI/CD pipeline setup for the admin repo.
- Multi-region admin or production-scale architecture.
- Docker images and self-managed infrastructure.

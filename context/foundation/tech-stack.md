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

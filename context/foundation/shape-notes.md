---
project: "SendLog"
context_type: greenfield
created: 2026-05-25
updated: 2026-05-25
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "missing capability — no online catalog of Polish crags exists; existing global apps (Mountain Project / TheCrag) are shallow on Polish content"
    - topic: "primary persona scope"
      decision: "self + small known group of local climbers (Sokoliki regulars / friends) as MVP user base; not a public utility from day one"
    - topic: "cost today"
      decision: "expensive paper topos are the dominant current solution; no online alternative exists for Polish crags"
    - topic: "insight"
      decision: "existing apps are global, paid, and shallow on Polish crags — a free online equivalent of the paper topo (with personal logging) fills a Polish-market gap"
    - topic: "auth strategy"
      decision: "passwordless email (magic link); kept over invite-only because the app should be ready to outgrow the beta group without rework"
    - topic: "role separation"
      decision: "flat 'climber' user + admin role (project owner) for content curation"
    - topic: "catalog visibility"
      decision: "crag catalog is public (read-only browsing without login); login required only for personal log, comments, favorites, projects"
    - topic: "mvp scope"
      decision: "kept: catalog, map-with-pins, auth, log-climb, projects, personal history, admin CMS — cut from v1: favorites, personal-grade override, public comments"
    - topic: "map contingency"
      decision: "Mapy.com interactive map kept in v1 with documented fallback to static link / QR per crag if integration proves too painful mid-build"
    - topic: "timeline"
      decision: "3 weeks of after-hours solo work, scoped down to fit"
  frs_drafted: 18
  quality_check_status: accepted
---

# Shape notes — SendLog

## Vision & Problem Statement

There is no good online catalog of Polish climbing crags. Climbers who want detailed information about routes at Polish crags either buy expensive paper topos or piece together scraps from scattered forum threads. Global apps like Mountain Project and TheCrag have shallow Polish coverage, are English-first, and miss the local context Polish climbers actually need. The pain hits at planning time (deciding where to climb, what to project) and at the crag (identifying routes, remembering past ascents).

The insight: nobody is building a Polish-first online crag catalog. The expensive paper topos sold on the Polish market are the de-facto solution, which means there is a clear template for what the content should look like — and a clear unmet need for an online, free, detailed alternative. A personal climb log on top of that catalog is a natural add-on, not the headline.

## User & Persona

**Primary persona**: Polish climbers in the project owner's local community — Sokoliki regulars, friends, and the project owner themselves. A small known group (~5-10 beta users for MVP), not a public utility. They climb sport and trad routes at Polish crags regularly, know individual routes by name, and currently rely on paper topos plus memory. They have phones at the crag and a browser at home.

The MVP serves this known group. Broader Polish climbing audience is a v2 concern.

## Access Control

Two roles: **climber** (the default authenticated user) and **admin** (a single role held by the project owner for content curation).

**Sign-in**: passwordless email — a user submits their email, receives a one-time magic link, and clicking it authenticates them. No passwords to store, reset, or recover.

**Public vs. gated**:

- The crag catalog (regions, crags, routes, route details) is **publicly browsable without login**. Anyone landing on the site can see the catalog content.
- Authenticated capabilities (gated behind login): marking routes as climbed with personal notes, adding routes to projects, viewing personal history.

**Admin**: a single admin account (the project owner) curates crag and route content. Admin uses a separate content-management UI — climbers cannot add or edit catalog content in the MVP. Admin is otherwise indistinguishable from a climber for personal-log purposes (the admin can log their own climbs).

**Unauthenticated route**: visitors hitting a gated capability (e.g. trying to mark a route as climbed) are prompted to sign in via magic link.

## Success Criteria

### Primary

- A logged-in beta user can mark a route as climbed and save a text note in under 30 seconds, end-to-end (route already located in the catalog → tap "climbed" → enter date + note → save → confirmation visible).

### Secondary

- Within the first week of beta access, at least 2 of the ~5 beta users add at least one route to their personal projects list. Demonstrates that the projects feature carries weight beyond passive logging.

### Guardrails

- The crag catalog (regions, crags, routes) remains fully browsable without an account. No login wall sneaks into the read-only catalog path.
- Personal climb data — climbed routes, dates, notes, projects — is never visible to any other user. Strict per-user privacy on user-generated content.
- All transcribed catalog content (route name, grade, type, year set) matches the source paper topo. No fabricated or AI-hallucinated routes.
- The site is usable on a phone browser at the crag (assuming decent signal). Mobile-responsive layouts; no desktop-only paths in the core flows (catalog browse, log climb, history view).
- The user-facing UI is in Polish (English fallback acceptable as a secondary toggle, but Polish is the primary language — the audience is Polish climbers).

## MVP scope notes

**In v1**: catalog hierarchy (regions → crags → routes), Mapy.com map with crag pins, passwordless auth, log climb (date + text note), projects (want-to-climb), personal history (climbed + projects), admin CMS for content curation.

**Cut from v1, deferred to v2+**: favorites, personal-grade override on logged climbs, public comments on routes, photo uploads, advanced filters, social features, external climbing-database integrations, climbing stats / analytics.

**Map contingency**: Mapy.com interactive map is in v1. If integration proves too painful mid-build (API quirks, time-sink), fall back to a static crag-locator link (or QR code per crag) that hands off to Mapy.com or Google Maps. Preserves the geographic-locator value without the full integration cost.

## Timeline budget

3 weeks of after-hours solo work, scoped down to fit. No hard external deadline known at this point. After-hours-only commitment.

## Functional Requirements

### Catalog (public, no auth)

- FR-001: Any visitor can browse a list of regions. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-002: Any visitor can open a region and see the list of crags within it. Priority: must-have
  > Socrates: Counter-argument considered: "Map-first UX makes a separate crag list redundant — pins ARE the crag list." Resolution: kept; map is primary entry, list navigation remains as fallback (no-login path, accessibility).
- FR-003: Any visitor can open a crag and see its routes (name, grade, type, year set). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-004: Any visitor can view a map showing crag locations as pins. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Map contingency documented in MVP scope notes.
- FR-005: Any visitor clicking a map pin can navigate to that crag's route list. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Authentication

- FR-006: An unauthenticated visitor can request a magic link by submitting their email. Priority: must-have
  > Socrates: Counter-argument considered: magic-link delivery complexity vs. invite-only. Resolution: auth provider handles delivery; fallback to email+password if magic links fail in practice.
- FR-007: A visitor clicking a valid magic link from their email is signed in as a climber. Priority: must-have
  > Socrates: Counter-argument considered: token prefetch / spam / session issues. Resolution: auth provider handles sign-in; fallback to email+password if problems emerge.
- FR-008: A signed-in climber can sign out. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Personal climb log (auth required)

- FR-009: A signed-in climber can mark a route as climbed, recording the date and a free-text note. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-010: A signed-in climber can view their personal history of climbed routes, ordered by date. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-011: A signed-in climber can delete one of their own logged climbs. Priority: must-have
  > Socrates: Counter-argument considered: "Edit UI doubles form complexity — delete-and-relog is enough for v1." Resolution: revised to delete-only; no edit form in v1. User re-logs if date or note was wrong.

### Projects (auth required)

- FR-012: A signed-in climber can add a route to their personal projects list (want-to-climb). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-013: A signed-in climber can view their personal projects list. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-014: A signed-in climber can remove a route from their projects list. Priority: must-have
  > Socrates: Counter-argument considered: "Removal is implicit when logging a climb (FR-015)." Resolution: kept explicit remove; FR-015 auto-sync remains nice-to-have polish.
- FR-015: A signed-in climber moving a route from "projects" to "climbed" (by logging it) sees the route automatically leave the projects list. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written at nice-to-have priority.

### Admin content management

- FR-016: An admin user can create, edit, and delete regions via a content-management UI. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-017: An admin user can create, edit, and delete crags (with name, location coordinates) within a region. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-018: An admin user can create, edit, and delete routes (name, grade, type, year set) within a crag. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: Beta user logs a climb at the crag

- **Given** a signed-in climber viewing a route at a Polish crag in the catalog
- **When** they mark the route as climbed, enter today's date and a short text note, and save
- **Then** the climb appears in their personal history with the correct route, date, and note, and they see confirmation within 30 seconds of starting the action

#### Acceptance Criteria

- The climber does not need to navigate away from the route view to complete the log
- Date defaults to today but can be changed
- Note field accepts free text (beta, gear, conditions) and can be left empty
- After save, the route shows a visual indicator that this climber has logged it
- Personal history lists the climb ordered by date (most recent first)
- To fix a mistake, the climber deletes the log and re-logs (no edit form in v1)

## Forward: tech-stack

Informational notes from shaping — not PRD commitments; resolved in tech-stack selection downstream.

- User mentioned Supabase for end-user auth (magic links); fallback to email+password if magic-link issues arise in practice.
- User's idea-notes proposed Strapi for catalog CMS, Supabase for user data, Mapy.com for maps — preferences only, not locked here.

## Business Logic

Each climber's private ascent and project state is bound to exactly one canonical catalog route — the application never duplicates route identity per user.

The shared catalog (regions, crags, routes) is admin-curated and identical for every visitor. When a climber logs an ascent or adds a project, they attach private state to an existing catalog route ID — not a copy of the route. The catalog route's name, grade, type, and year set remain admin-controlled; climbers cannot fork or edit catalog entries.

User-facing inputs: which catalog route the climber selects; date climbed (for ascents); free-text note (optional); whether the route is on their projects list or logged as climbed.

Output the user encounters: on a route card, indicators showing *this climber's* relationship to that route (climbed / on projects / untouched); on personal history and projects pages, lists derived from the same canonical route references.

## Non-Functional Requirements

- Core user-facing pages (crag route list, save climb action) respond within 800 ms p95 as perceived by the climber on a typical mobile 4G connection at the crag.
- Any user-initiated action expected to take longer than 2 seconds shows continuous visible progress feedback — no silent wait with no indication.
- User-generated content (climbed routes, dates, notes, projects) is never visible to any other user or to anonymous visitors — strict per-user privacy on all personal data.
- The product is usable on phone browsers at the crag: mobile-responsive layouts on all climber-facing core flows.
- The user-facing UI is in Polish as the primary language.
- Supported environments: latest two major versions of Chrome, Safari, and Firefox on mobile and desktop.

## Non-Goals

- **User-submitted routes or crags** — only admin curates catalog content in v1; avoids moderation burden and bad data.
- **Social features** — no public profiles, following, or shared climb lists; product is a catalog + private log, not a network.
- **Public comments on routes** — no cross-user discussion layer in v1.
- **Favorites list** — deferred; climbed + projects cover v1 needs.
- **Personal grade override** — climbers log against the catalog grade only in v1.
- **Advanced search/filters** — visual browsing (map + lists) only; no grade/type/name search.
- **Offline mode / installable PWA** — responsive web only; requires connectivity at the crag.
- **Native mobile apps** — no iOS/Android binaries; browser-only.
- **Photo uploads on climb notes** — text-only notes in v1.
- **External climbing database integrations** — no sync with Mountain Project, TheCrag, or UKC.
- **Climbing stats / analytics** — no yearly totals, grade progression charts, or dashboards in v1.
- **More than one Polish region at launch** — v1 ships Sokoliki content only; additional regions are v2.

## Quality cross-check

All quality elements present at handoff (2026-05-25). No gaps recorded.


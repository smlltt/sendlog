---
project: "SendLog"
version: 1
status: draft
created: 2026-05-25
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# SendLog — Product Requirements Document

## Vision & Problem Statement

There is no good online catalog of Polish climbing crags. Climbers who want detailed information about routes at Polish crags either buy expensive paper topos or piece together scraps from scattered forum threads. Global apps like Mountain Project and TheCrag have shallow Polish coverage, are English-first, and miss the local context Polish climbers actually need. The pain hits at planning time (deciding where to climb, what to project) and at the crag (identifying routes, remembering past ascents).

The insight: nobody is building a Polish-first online crag catalog. The expensive paper topos sold on the Polish market are the de-facto solution, which means there is a clear template for what the content should look like — and a clear unmet need for an online, free, detailed alternative. A personal climb log on top of that catalog is a natural add-on, not the headline.

## User & Persona

**Primary persona**: Polish climbers in the project owner's local community — Sokoliki regulars, friends, and the project owner themselves. A small known group (~5–10 beta users for MVP), not a public utility. They climb sport and trad routes at Polish crags regularly, know individual routes by name, and currently rely on paper topos plus memory. They have phones at the crag and a browser at home.

The MVP serves this known group. A broader Polish climbing audience is a v2 concern.

## Success Criteria

### Primary

- A logged-in beta user can mark a route as climbed and save a text note in under 30 seconds, end-to-end (route already located in the catalog → mark "climbed" → enter date + note → save → confirmation visible).

### Secondary

- Within the first week of beta access, at least 2 of the ~5 beta users add at least one route to their personal projects list. Demonstrates that the projects feature carries weight beyond passive logging.

### Guardrails

- The crag catalog (regions, crags, routes) remains fully browsable without an account. No login wall sneaks into the read-only catalog path.
- Personal climb data — climbed routes, dates, notes, projects — is never visible to any other user. Strict per-user privacy on user-generated content.
- All transcribed catalog content (route name, grade, type, year set) matches the source paper topo. No fabricated routes.
- The product remains usable on a phone browser at the crag (assuming decent signal) for the core flows: catalog browse, log climb, view history.
- The user-facing UI is in Polish as the primary language. The audience is Polish climbers.

## User Stories

### US-01: Beta user logs a climb at the crag

- **Given** a signed-in climber viewing a route at a Polish crag in the catalog
- **When** they mark the route as climbed, enter today's date and a short text note, and save
- **Then** the climb appears in their personal history with the correct route, date, and note, and they see confirmation within 30 seconds of starting the action

#### Acceptance Criteria

- The climber does not need to navigate away from the route view to complete the log.
- Date defaults to today but can be changed.
- The note field accepts free text (beta, gear, conditions) and can be left empty.
- After saving, the route shows a visual indicator that this climber has logged it.
- Personal history lists the climb ordered by date (most recent first).
- To fix a mistake, the climber deletes the log and re-logs (no edit form in v1).

## Functional Requirements

### Catalog (public, no auth)

- FR-001: Any visitor can browse a list of regions. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-002: Any visitor can open a region and see the list of crags within it. Priority: must-have
  > Socrates: Counter-argument considered: "Map-first UX makes a separate crag list redundant — pins ARE the crag list." Resolution: kept; map is primary entry, list navigation remains as fallback (no-login path, accessibility).
- FR-003: Any visitor can open a crag and see its routes (name, grade, type, year set). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-004: Any visitor can view a map showing crag locations as pins. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Map contingency documented as a scope fallback (see Non-Goals).
- FR-005: Any visitor clicking a map pin can navigate to that crag's route list. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Authentication

- FR-006: An unauthenticated visitor can request a one-time sign-in link by submitting their email. Priority: must-have
  > Socrates: Counter-argument considered: email-link delivery complexity vs. invite-only. Resolution: the auth provider handles delivery; fallback to email + password if email links fail in practice.
- FR-007: A visitor clicking a valid sign-in link from their email is signed in as a climber. Priority: must-have
  > Socrates: Counter-argument considered: token prefetch / spam / session issues. Resolution: auth provider handles sign-in; fallback to email + password if problems emerge.
- FR-008: A signed-in climber can sign out. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Personal climb log (auth required)

- FR-009: A signed-in climber can mark a route as climbed, recording the date and a free-text note. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-010: A signed-in climber can view their personal history of climbed routes, ordered by date. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-011: A signed-in climber can delete one of their own logged climbs. Priority: must-have
  > Socrates: Counter-argument considered: "Edit UI doubles form complexity — delete-and-relog is enough for v1." Resolution: revised to delete-only; no edit form in v1. The user re-logs if the date or note was wrong.

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
- FR-017: An admin user can create, edit, and delete crags (with name and location coordinates) within a region. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-018: An admin user can create, edit, and delete routes (name, grade, type, year set) within a crag. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Non-Functional Requirements

- Core user-facing pages (a crag's route list, the save-climb action) respond within 800 ms p95 as perceived by the climber on a typical mobile cellular connection at the crag.
- Any user-initiated action expected to take longer than 2 seconds shows continuous visible progress feedback — no silent wait.
- User-generated content (climbed routes, dates, notes, projects) is never visible to any other user or to anonymous visitors. Strict per-user privacy on all personal data.
- The product remains fully usable on a phone browser at the crag for the core climber flows (catalog browse, log climb, view personal history), tolerating small touch screens and patchy connectivity.
- The user-facing UI is in Polish as the primary language.
- The product remains usable on the latest two major versions of Chrome, Safari, and Firefox on both mobile and desktop.

## Business Logic

Each climber's private ascent and project state is bound to exactly one canonical catalog route — the product never duplicates route identity per user.

The shared catalog (regions, crags, routes) is admin-curated and identical for every visitor. When a climber logs an ascent or adds a project, their private state references the existing catalog route — never a duplicate of it. The catalog route's name, grade, type, and year set remain admin-controlled; climbers cannot fork or edit catalog entries.

User-facing inputs the rule consumes: which catalog route the climber selects; the date climbed (for ascents); a free-text note (optional); whether the route is on their projects list or logged as climbed.

What the user encounters as output: on a route card, indicators showing *this climber's* relationship to that route (climbed / on projects / untouched); on the personal history and projects pages, lists derived from the same canonical route references.

## Access Control

Two roles: **climber** (the default authenticated user) and **admin** (a single role held by the project owner for content curation).

**Sign-in**: passwordless. A user submits their email, receives a one-time sign-in link in their inbox, and clicking it authenticates them. No passwords to store, reset, or recover.

**Public vs. gated**:

- The crag catalog (regions, crags, routes, route details) is **publicly browsable without login**. Anyone landing on the site can see the catalog content.
- Authenticated capabilities (gated behind login): marking routes as climbed with personal notes, adding routes to projects, viewing personal history.

**Admin**: a single admin account (held by the project owner) curates crag and route content via a separate content-management UI. Climbers cannot add or edit catalog content in the MVP. For personal-log purposes, the admin is indistinguishable from a climber (the admin can log their own climbs).

**Unauthenticated route**: a visitor hitting a gated capability (e.g. trying to mark a route as climbed) is prompted to sign in.

## Non-Goals

### Functional non-goals

- **User-submitted routes or crags** — only admin curates catalog content in v1; avoids moderation burden and bad data.
- **Social features** — no public profiles, following, or shared climb lists. The product is a catalog + private log, not a network.
- **Public comments on routes** — no cross-user discussion layer in v1.
- **Favorites list** — deferred; climbed + projects cover v1 needs.
- **Personal grade override on logged climbs** — climbers log against the catalog grade only in v1.
- **Advanced search/filters** — visual browsing (map + lists) only; no grade/type/name search.
- **Photo uploads on climb notes** — text-only notes in v1.
- **External climbing database integrations** — no sync with Mountain Project, TheCrag, or UKC.
- **Climbing stats / analytics** — no yearly totals, grade progression charts, or dashboards in v1.
- **More than one Polish region at launch** — v1 ships Sokoliki content only; additional regions are v2.
- **Map fallback as a Non-Goal trigger**: the interactive map (FR-004, FR-005) is in v1, but if its integration proves too painful mid-build, the documented fallback is a static crag-locator link (or QR code per crag) handing off to an external mapping service. The fallback preserves the geographic-locator value; the *interactive* map then becomes a v2 concern. This is recorded here so the scope decision is explicit rather than ad-hoc.

### Non-functional non-goals

- **Offline mode / installable PWA** — responsive web only; the product requires connectivity at the crag.
- **Native mobile apps** — no iOS/Android binaries; browser-only.
- **WCAG-AA certification** — accessibility is best-effort on mobile-responsive layouts; formal accessibility audits are out of scope for v1.

## Open Questions

*No open questions at this time. The `/10x-shape` quality cross-check passed with `quality_check_status: accepted` and no recorded gaps (see `context/foundation/shape-notes.md`).*

# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1-§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-16

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `admin/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | A beta climber cannot complete passwordless sign-in, cannot reach a gated page after sign-in, or is silently signed out. | High | Medium | PRD FR-006/007/008; interview Q1; roadmap S-03; hot-spot dirs `src/components/auth` (14 commits/30d), `src/pages/auth` (10 commits/30d) |
| 2 | Private data leaks or authorization fails: user A reads or mutates user B's climbs/projects, anonymous reaches private data, or a gated capability is not gated. | High | Medium | PRD privacy guardrail and Access Control; AGENTS RLS rule; hot-spot dir `src/lib/private-state` (10 commits/30d); abuse/security lens |
| 3 | Climb add/edit/delete breaks: the climb does not persist, history shows the wrong route/date/note, or delete leaves stale state. | High | Medium | PRD US-01 and FR-009/010/011; interview Q1; archived `edit-projects-and-climbs`; hot-spot dirs `src/components/climbs` (12 commits/30d), `src/pages/api` (11 commits/30d) |
| 4 | Project add/delete breaks: the project does not persist, the list is wrong, or route-card state disagrees with saved state. | Medium | Medium | PRD FR-012/013/014; interview Q1; hot-spot dirs `src/components/projects` (6 commits/30d), `src/lib/private-state` (10 commits/30d) |
| 5 | The public map fails in production: pins do not render, or clicking a pin does not reach the crag route list. | Medium | Medium | PRD FR-004/005; interview Q1/Q2; hot-spot dir `src/components/catalog` (25 commits/30d); roadmap S-02 fallback note |
| 6 | The public catalog silently drops routes or renders wrong route name/grade/type/year from the content source. | High | Medium | PRD catalog guardrail and Business Logic; hot-spot dirs `src/components/catalog` (25 commits/30d), `src/lib/catalog` (15 commits/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | A user moves from logged-out to authenticated, reaches a gated page, and can sign out cleanly. | "The sign-in form submits" does not prove the session is established and honored by middleware. | How to obtain a real Supabase session in tests without relying on a live email inbox; session and redirect behavior. | E2e | Mocking auth so the test never exercises the real session and gate path. |
| #2 | User A is denied user B's data on read and write, and anonymous users are denied gated capability. | Being logged in is not the same as owning the row. | Whether ownership is enforced by RLS, app code, or both; request shape for cross-user access. | Request/API-level negative checks plus one e2e gate check, if research confirms this is cheaper and reliable. | Happy-path-only tests that never attempt the forbidden cross-user action. |
| #3 | A logged climb appears in history with the correct route/date/note, survives reload, edits update it, and delete removes it. | A success message does not prove persistence or rendered history correctness. | Persistence boundary, history ordering, edit contract, validation for date/note. | E2e | Copying expected values from implementation logic; skipping reload/persistence verification. |
| #4 | Adding a project updates the projects list and route state after reload; removing clears both. | Optimistic UI can look successful while persistence failed. | Project persistence boundary and how route state is reflected back to the UI. | E2e | Asserting only the immediate toggle state without checking persisted state. |
| #5 | Anonymous visitor sees map pins and clicking one lands on the matching crag route list. | The dev-only map restart flake is not automatically a production risk. | Whether the map is client-only or SSR-assisted, and what content/fallback is expected. | E2e | Building a test around a dev-server condition users never hit. |
| #6 | A known seeded crag route list renders every route returned by the content source with matching visible fields. | "Matches the paper topo" has no machine-readable oracle unless a fixture/source is defined. | The content source for deterministic test data and where fields can be dropped or transformed. | E2e with known fixture/content; request-level check only if e2e cannot create a stable oracle. | Meaningless snapshots or asserting against production logic instead of independent expected data. |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | E2e harness + auth gate | Bootstrap Playwright, prove auth session behavior, and prove gated pages are actually gated. | #1, #2 | e2e; request/API negative check if research confirms better signal | implementing | `context/changes/testing-e2e-auth-foundation/` |
| 2 | Private climber flows + isolation | Prove climb add/edit/delete and project add/delete persist correctly, including user isolation. | #2, #3, #4 | e2e; request/API negative check if research confirms better signal | implementing | `context/changes/private-climber-flows-isolation/` |
| 3 | Public catalog + map | Prove anonymous browse, route-list fidelity, and map pin render/navigation. | #5, #6 | e2e | not started | — |

## 4. Stack

The classic test base for this project. Tool guidance is grounded in local
manifests/configs plus the MCP/tools exposed in the current session.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit | none | n/a | Deliberately out of scope for this rollout per Phase 2 interview. |
| integration | none | n/a | Only consider request/API checks where they beat e2e on cost × signal for authorization negatives. |
| e2e | Playwright | planned | Phase 1 should add the runner and configure `webServer` for `npm run dev -- --host 127.0.0.1 --port 3000`. |
| accessibility | none | n/a | No standalone audit gate planned; use accessible selectors in e2e where practical. |
| AI-native | none | n/a | Not recommended; deterministic e2e covers the selected risks more directly. |

**Stack grounding tools (current session):**
- Docs: Context7 — checked Playwright docs for `webServer`, `storageState`, global setup, and test isolation; checked: 2026-06-09.
- Search: Exa.ai available — not used because official Playwright docs covered the needed setup; checked: 2026-06-09.
- Runtime/browser: Playwright is the planned browser/runtime layer; checked: 2026-06-09.
- Provider/platform: Linear available but not relevant to quality gates; Supabase/Cloudflare MCPs not available in current session; checked: 2026-06-09.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + build | local + CI | required today | syntactic, type, Astro, and deployment-shape drift |
| guardrails | local + CI | required today | missing Polish UI coverage and missing >2s progress-feedback primitives |
| e2e on auth gate | local first, CI once stable | required after §3 Phase 1 | broken login/session/gated access paths |
| e2e on private flows | local first, CI once stable | required after §3 Phase 2 | broken climb/project CRUD and privacy regressions |
| e2e on public catalog + map | local first, CI once stable | required after §3 Phase 3 | broken anonymous browsing, map navigation, and route-list fidelity |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding an e2e test for auth and gated pages

- TBD — see §3 Phase 1 for passwordless session, sign-out, and gated-page patterns.

### 6.2 Adding an e2e test for private climber flows

Covers climb add/edit/delete and project add/remove against the real gated
pages. `seed.spec.ts` (climb add → reload → delete) is the canonical exemplar;
`climb-edit.spec.ts` and `projects-flow.spec.ts` extend the pattern.

- **Prerequisites**: local Supabase running (`npx supabase start`, Docker), a
  seeded Strapi catalog containing the fixture crag/route, and `.env`/`.dev.vars`
  populated from `npx supabase status`. `playwright.config.ts` runs `workers: 1`
  (serial Mailpit mailbox + shared DB state) — do not parallelize.
- **Shared constants** (`tests/e2e/constants.ts`): import `FIXTURE_CRAG_PATH`
  (`/regiony/rzedkowice/mala-gran`) and `FIXTURE_ROUTE_NAME` (`test route`)
  instead of hardcoding catalog paths.
- **Auth**: `signInViaMagicLink(page, { email: E2E_TEST_EMAIL, next: FIXTURE_CRAG_PATH })`
  lands the authenticated session directly on the fixture crag — real
  passwordless magic-link flow, no mocked session.
- **Island hydration**: crag-row and history-row actions are `client:load`
  islands. Wrap the open-then-assert in `expect(async () => { … }).toPass()` so
  the click retries until the island has hydrated (see `climb-edit.spec.ts:25-28`).
- **Unique oracle + cleanup**: tag created rows with a timestamped value
  (`edit-before-${Date.now()}`) so concurrent/leftover data can't false-match,
  and delete every row the spec creates (two-step UI confirm or
  `deleteClimbViaApi`/`deleteProjectViaApi`) so re-runs start clean.
- **Persistence is the point**: always `page.reload()` and re-assert after a
  mutation — a success toast proves optimistic UI, not a persisted PATCH/POST.
- **Climb edit selectors**: row = `getByRole("listitem").filter({ hasText: note })`;
  note field = `getByLabel("Notatka (opcjonalnie)")`; buttons `Edytuj` →
  `Zapisz zmiany`; success notice `Zmiany zostały zapisane.`.
- **Project selectors**: crag-row add = `Dodaj do projektów` (notice
  `Dodano do projektów.`, indicator `W projektach`); on `/projekty` the row is
  `getByRole("listitem").filter({ hasText: FIXTURE_ROUTE_NAME })` with a heading;
  remove is a two-step `Usunąć z projektów?` → `Usuń` (notice
  `Usunięto z projektów.`). Reset to off-list first when the toggle may already
  be on (see `projects-flow.spec.ts:55-71`).

### 6.3 Adding a user-isolation or authorization test

Covers cross-user denial (`isolation-climbs.spec.ts`,
`isolation-projects.spec.ts`, `isolation-read.spec.ts`) and anonymous denial
(`api-auth.spec.ts`). Choose the cheapest layer that proves the risk:

- **API mutation denial vs UI read isolation**: use an **API-level** check
  (`page.request.patch/delete`) for *write* denial — it exercises the real
  session cookie through the endpoint and asserts the structured error directly,
  cheaper and clearer than driving the UI. Use a **UI read-isolation** check
  (visit the gated page, assert the other user's row is absent) for *read* denial,
  because the SSR scoping only manifests in the rendered page. Anonymous denial is
  pure API (no cookies → `request` fixture).
- **Two users**: `E2E_TEST_EMAIL` (A) and `E2E_TEST_EMAIL_B` (B) are distinct
  mailboxes resolving to distinct Supabase identities. Build parallel sessions
  with `createAuthenticatedContext(browser, { email, next })` — each returns
  `{ context, page }` with cookies cleared and magic-link sign-in completed.
- **Capture row ids from the app, never the DOM**: row UUIDs are not rendered.
  Start `waitForClimbCreated(page)` / `waitForProjectCreated(page)` *before*
  triggering the UI action that posts, then `await` it for the created id. Never
  hardcode Strapi document ids.
- **Denial contract**: a non-owned authenticated mutation collapses to
  `404` with `error.code === "not_found"` (ownership is never leaked as `403`);
  an unauthenticated mutation returns `401` with `error.code === "unauthenticated"`.
  Assert status, JSON `Content-Type`, and the `error.code` (see
  `expectNotFound` in `isolation-climbs.spec.ts:93-107`). Note: projects have no
  PATCH endpoint — denial there is DELETE-only.
- **Serial + cleanup**: isolation specs share user A's seeded row, so set
  `test.describe.configure({ mode: "serial" })`, create the row in `beforeAll`,
  and tear it down in `afterAll` (owner session via `deleteClimbViaApi` /
  `deleteProjectViaApi`, then close both contexts).
- **Sanity before denial**: assert user A *can* see the row (e.g. on `/historia`)
  before B probes it, so a setup failure reads as a setup failure, not a false
  pass on B's denial.
- **Name the leak**: name tests after the risk (`Risk #2: …`) and pass a
  message into the denial assertion that says which user/action leaked, so a
  regression is not a bare timeout.

### 6.4 Adding an e2e test for public catalog and map behavior

- TBD — see §3 Phase 3 for anonymous catalog browse, route-list fidelity, and map pin navigation patterns.

### 6.5 Per-rollout-phase notes

- **Phase 2 (private flows + isolation)**: two-user isolation specs require two
  distinct test mailboxes (`E2E_TEST_EMAIL`, `E2E_TEST_EMAIL_B`) and must run
  serially — `workers: 1` is mandatory because each magic-link sign-in clears and
  polls a shared Mailpit inbox, and isolation specs share/clean a single seeded
  row in the DB. Cross-user denial is checked at the API layer (`not_found`),
  read isolation at the rendered gated page; an RLS-only regression where app
  scoping still passes is a known residual gap (see plan "What We're NOT Doing").

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout interview. Future contributors should
respect these unless the underlying assumption changes.

- **UI snapshots** — low signal for the current risk set and likely to become brittle. Re-evaluate only if deterministic visual regressions become a repeated production problem. (Source: Phase 2 interview Q5.)
- **Strapi admin internals** — Strapi owns the admin CRUD mechanics; this project cares about rendered catalog behavior and content contracts. Re-evaluate only if custom admin code becomes product-critical. (Source: Phase 2 interview Q5.)
- **Exhaustive browser coverage** — one high-value browser path is enough for the beta risk profile. Re-evaluate when the audience or browser-support burden grows. (Source: Phase 2 interview Q5.)
- **Unit tests as a rollout goal** — the desired budget is a few high-value end-to-end tests. Re-evaluate only if research finds a risk where e2e cannot provide a stable oracle at reasonable cost. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1-§5) last reviewed: 2026-06-09
- Stack versions last verified: 2026-06-09
- AI-native tool references last verified: 2026-06-09

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.

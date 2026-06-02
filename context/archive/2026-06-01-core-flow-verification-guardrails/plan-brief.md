# Core-Flow Verification Guardrails — Plan Brief

> Full plan: `context/changes/core-flow-verification-guardrails/plan.md`

## What & Why

Ship a lightweight verification harness for three NFR gates from the PRD (Polish UI, mobile usability, ≥2s progress feedback) plus a response-time observation captured each cycle, so that S-04's beta climb-log flow can be checked against them. Today the app has zero machinery to verify any of these — auth is still in English, no shared progress primitive exists, and there's no response-time measurement. F-03 closes that gap before the primary beta flow is judged by "it works on my machine." The PRD's 800 ms p95 cellular response-time NFR is intentionally treated as observation rather than gate because the ~5-10 person friends-only beta provides a fast human feedback loop; the throttled DevTools session captures trend data cheaply and the gate can be promoted back when the audience grows.

## Starting Point

Catalog pages render Polish copy and `<html lang="pl">` is set; the entire auth surface is still English (page titles, `MagicLinkForm`, `AUTH_ERROR_MESSAGES` in `src/lib/auth/types.ts`). `SubmitButton` has an inline form-submit spinner but there's no reusable `<Pending>` or `<Skeleton>` for non-form states. No test runner exists — the team's verification pattern is `npx astro sync` + `npm run lint` + `npm run build` + a manual smoke checklist in each plan. ESLint with `eslint-plugin-jsx-a11y` is already enabled.

## Desired End State

A contributor can verify any climber-facing flow against three NFR gates and capture response-time observations by running one command (`npm run guardrails`) and stepping through one document (`docs/verification/beta-flow-checklist.md`). CI runs the static half on every PR; the manual half runs once per pre-beta cycle. The auth surface is fully Polish, two shared progress primitives exist and are enforced by static check, and the throttled mobile + progress + observation sweep is a documented, repeatable DevTools session.

## Key Decisions Made

| Decision                          | Choice                                                                                                                                                                | Why (1 sentence)                                                                                                              | Source |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Pages in scope                    | Climb-log + auth + route view                                                                                                                                          | The three pages an actual beta climb crosses end-to-end.                                                                       | Plan   |
| Verification cadence              | Static checks in CI on every PR + a committed pre-beta manual checklist for the dynamic stuff                                                                          | Lint patterns catch regressions cheaply; cellular emulation and viewport sweeps need a human session and don't belong in CI.   | Plan   |
| Polish UI approach                | Official Astro i18n recipe: `src/i18n/{ui,utils}.ts` (single locale `pl`, no routing layer, no library install) + a curated ripgrep static guard                       | Recipe is small, idiomatic, future-proof; no new dependency; routing can be added in one line later if a second locale lands.  | Plan   |
| Response-time verification        | Demoted to **observation** — median of 3 throttled runs recorded in "Latest run" per cycle, no pass/fail threshold                                                       | 5-10 person friends-only beta provides fast human feedback for obvious cliffs; cycle-over-cycle trend data costs near-zero given the throttled session is already happening for mobile + progress. | Plan   |
| Mobile verification               | Viewport sweep (375×667, 390×844, 412×915) folded into the same throttled DevTools session                                                                              | One physical activity yields three guardrail checks (mobile + response time + progress feedback); avoids three separate runs.  | Plan   |
| Progress-feedback standardization | Reusable `<Pending>` + `<Skeleton>` in `src/components/ui/`, a `docs/verification/progress-feedback-actions.md` registry, and a static guard enforcing primitive imports | Same enforcement surface as a heavier library, zero runtime cost; `SubmitButton`'s existing spinner stays as the form-submit option. | Plan   |

## Scope

**In scope:**

- `src/i18n/{ui,utils,index}.ts` scaffold (single Polish locale)
- Translate auth surface: `src/pages/auth/*.astro`, `src/components/auth/MagicLinkForm.tsx`, `src/lib/auth/types.ts`
- Relocate existing Polish strings into the dictionary: `src/pages/regiony/[region]/[crag].astro`, `src/components/catalog/*`, `src/layouts/*`, `src/components/Banner.astro`, `src/lib/config-status.ts`
- `src/components/ui/Pending.tsx`, `src/components/ui/Skeleton.tsx`
- `scripts/check-i18n.mjs`, `scripts/check-progress.mjs` + `npm run guardrails*` scripts
- `docs/verification/progress-feedback-actions.md`, `docs/verification/beta-flow-checklist.md`
- `.github/workflows/ci.yml` (add the guardrails step), root `AGENTS.md` (cross-reference)

**Out of scope:**

- Shipping the climb-log feature itself (S-04)
- Adopting a test runner (Vitest/Playwright/Lighthouse-CI)
- Multi-locale routing layer, language switcher, `astro.config.mjs` `i18n:` block
- Translating admin/Strapi UI or non-in-scope pages (homepage, region list, dashboard, 404)
- Real-user monitoring, `Server-Timing` headers, any app-side perf instrumentation
- Custom ARIA/touch-target ESLint rules

## Architecture / Approach

Three thin layers stacked on top of the existing build pipeline:

1. **A single-locale i18n module** (`src/i18n/`) following the official Astro recipe — `ui.pl` dictionary + `useTranslations` → `t(key)` helper used identically from `.astro` and React island files. Compile-time key autocomplete via TypeScript.
2. **Two shared UI primitives** (`<Pending>`, `<Skeleton>`) extending the spinner pattern already inlined in `SubmitButton`, plus a documented registry of which user-initiated action uses which primitive.
3. **A verification harness**: two ripgrep-based npm scripts (`guardrails:i18n`, `guardrails:progress`) unified under `npm run guardrails` and wired into CI between `lint` and `build`; one manual checklist (`docs/verification/beta-flow-checklist.md`) that walks Polish copy + throttled mobile + progress feedback as gates and captures response-time as an observation in a single DevTools session.

S-04 (and every subsequent climber-facing flow) inherits both halves without re-deciding the verification posture.

## Phases at a Glance

| Phase                                                             | What it delivers                                                                                              | Key risk                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1. Polish i18n foundation + audit                                 | i18n scaffold, auth surface translated, catalog Polish relocated into dictionary, `guardrails:i18n` script    | Regex-based guard generates false positives or misses novel English; mitigated by `// i18n-allow` opt-out + manual checklist.    |
| 2. Progress-feedback primitives + static guard                    | `<Pending>`, `<Skeleton>`, actions registry, `guardrails:progress` script                                     | Markdown-table parsing in the script is brittle; implementer has a JSON-companion escape hatch noted in the contract.            |
| 3. Beta-flow checklist + unified `guardrails` script + CI wiring  | `docs/verification/beta-flow-checklist.md`, `npm run guardrails`, CI step, AGENTS.md cross-reference          | Manual checklist drifts out of date; mitigated by "Latest run" subsection forcing a date/commit/result stamp per cycle.          |

**Prerequisites:** None — F-03 has no upstream dependencies in the roadmap (`roadmap.md:97`). Can be implemented immediately and runs alongside F-02 / S-01 / S-07 (all already done).

**Estimated effort:** ~2-3 focused sessions for a solo dev. Phase 1 is the most work (translate + relocate ~12 files); Phases 2 and 3 are mostly mechanical.

## Open Risks & Assumptions

- The i18n static guard is a regex, not a full lint rule. It will miss novel English phrasings; the manual Polish walkthrough in Phase 3 is the safety net.
- Response time is recorded as an observation, not gated. The PRD's NFR has been softened to "aspirational guideline" (`prd.md:122`) so the PRD and the verification harness now agree. Cycle-over-cycle data flows into "Latest run"; the friends-only beta provides the fast feedback loop for obvious cliffs. Promotion to a hard gate (and the supporting RUM/telemetry work) is appropriate once the audience scales beyond the known beta group.
- The plan assumes local dev (`127.0.0.1:3000`) is acceptable as the manual checklist target. If a preview environment becomes available later, the checklist can name it.
- The audit/guard scope deliberately excludes user-facing pages outside the chosen three (homepage, region-list, dashboard, 404). Widening it later is one constant-list change in `scripts/check-i18n.mjs`.

## Success Criteria (Summary)

- A contributor on a fresh checkout can run `npm run guardrails` and the manual checklist and know whether the climber-facing flow meets all four NFRs — without prior context on this foundation.
- A regression that adds an inline English literal in an in-scope user-facing file is blocked at CI (not at code review).
- The first end-to-end checklist run against local dev passes for all currently-shipped pages and produces a dated, commit-stamped entry in the "Latest run" subsection.

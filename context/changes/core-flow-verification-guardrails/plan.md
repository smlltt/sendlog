# Core-Flow Verification Guardrails Implementation Plan

## Overview

A lightweight foundation that ships three *checkable* guardrails before the S-04 climb-log beta path lands — Polish-primary UI, mobile usability, and ≥2-second progress feedback — plus a response-time observation captured per cycle with no pass/fail threshold. Verification is half automated (CI-runnable npm scripts using ripgrep) and half manual (a committed pre-beta checklist driven from Chrome DevTools throttling).

This is foundation work — it does not ship climb-log itself. F-03 hands S-04 (and every climber-facing flow after it) a reusable verification harness so the primary beta flow isn't judged by "it works on my machine."

The PRD's 800 ms p95 cellular response-time NFR is intentionally demoted to an observation in F-03 (rather than a gate) because the ~5-10 person friends-only beta provides a fast human feedback loop for obvious perf cliffs. The throttled DevTools session still records timings each cycle so trend data is captured cheaply; promoting it back to a gate is a one-paragraph edit in the checklist if a later release scales beyond the known beta group.

## Current State Analysis

The PRD's NFR section names four guardrails (`context/foundation/prd.md:122-126`); F-03 treats three as gates and the fourth (response time) as a recorded observation. The codebase has no machinery to check any of them today:

- **Polish UI is inconsistent.** Catalog pages render Polish copy (`Trasy`, `Współrzędne`, `Nie udało się załadować` in `src/pages/regiony/[region]/[crag].astro:36-66`) and the homepage layout sets `<html lang="pl">` (`src/layouts/Layout.astro:14`), but the entire auth surface is still English — auth pages (`src/pages/auth/signin.astro:14-26`, `src/pages/auth/check-email.astro:11-27`), the `MagicLinkForm` (`src/components/auth/MagicLinkForm.tsx:18-57`), and the user-facing error messages exported by the auth helper (`src/lib/auth/types.ts:16-21`). There is no i18n library, no centralized copy registry, and no lint rule against English in user-facing components.
- **No test runner is configured** (`package.json:5-13`). The team's established verification pattern is `npx astro sync` + `npm run lint` + `npm run build` + a manual smoke checklist embedded in each plan's Phase blocks (see `context/archive/2026-06-01-passwordless-auth-flow/plan.md`).
- **No reusable progress-feedback primitive** exists. `SubmitButton` has an inlined spinner + `pendingText` prop (`src/components/auth/SubmitButton.tsx:11-32`) that works for form-submit lifecycles but isn't usable for non-form pending states (deferred fetch, initial route load).
- **No response-time instrumentation.** Cloudflare Worker observability is enabled at the platform layer (`context/foundation/roadmap.md:60`) but the app emits no Web Vitals beacon, no `Server-Timing` header, and no per-handler timing log. The throttled DevTools session is enough to capture cycle-over-cycle observation data without committing to RUM in this foundation.
- **`eslint-plugin-jsx-a11y` is already enabled** (`eslint.config.js:48,82`), so a11y basics for the mobile guardrail are covered without adding rules.
- **F-03 budget signal**: "kept lightweight for speed, but placed before the climb-log beta path so the primary flow is not judged only by 'it works on my machine.'" (`context/foundation/roadmap.md:100`). Solo dev, 3-week MVP, after-hours only (`context/foundation/prd.md:12-15`).

## Desired End State

After this plan lands, a contributor can verify any climber-facing flow against three NFR gates (Polish UI, mobile usability, progress feedback) and capture response-time observations by running one command (`npm run guardrails`) and stepping through one document (`docs/verification/beta-flow-checklist.md`). CI runs the static half on every PR; the manual half runs once per pre-beta cycle.

Concretely:

- A single Polish dictionary at `src/i18n/ui.ts` is the source of truth for every visible string in the climb-log + auth + route-view flow. The auth surface is fully translated (no English lingers).
- Two shared primitives (`<Pending>`, `<Skeleton>`) live in `src/components/ui/` and are referenced by a small convention doc enumerating the in-scope >2s actions.
- A single markdown checklist documents the mobile + response-time + progress-feedback + Polish manual checks, and includes a "Latest run" subsection that the implementer fills in per cycle.
- CI fails when someone adds an inline English literal in user-facing files or when an in-scope >2s action file omits the agreed primitive.

### Key Discoveries

- **Auth surface is the entire substantive translation work.** Catalog code is already Polish-native (`src/pages/regiony/[region]/[crag].astro`, `src/lib/config-status.ts:15,22`, `src/components/catalog/CragMapSection.astro:7-11,26`); for those files the audit is a mechanical key-extraction, not a translation. Auth pages and `MagicLinkForm` are the real work.
- **`AUTH_ERROR_MESSAGES` is a single chokepoint** for four English error messages (`src/lib/auth/types.ts:16-21`). Translating those keys is the smallest possible fix for all server-side error paths.
- **`SubmitButton` is reusable as-is** for form-submit pending UI. The new `<Pending>` primitive is for non-form cases; we do not replace `SubmitButton`. The convention doc names both as acceptable.
- **The official Astro i18n recipe** (https://docs.astro.build/en/recipes/i18n/) maps directly onto a `src/i18n/{ui,utils}.ts` pair. The routing layer (`astro.config.mjs` `i18n:` block, language picker, `/en/...` prefixes) is *not* needed for one locale — skipping it keeps the change lightweight, and adding routing later is a one-line config change.
- **The throttling profile is shared.** The mobile + response-time + progress-feedback manual checks all want the same DevTools session (Slow 4G + 4× CPU on iPhone-SE-class viewports), so the checklist groups them under a single throttled walkthrough rather than three separate ones.

## What We're NOT Doing

- Shipping the climb-log feature itself (S-04). F-03 is a foundation; S-04 consumes its outputs.
- Adopting a test runner (Vitest/Playwright/Lighthouse-CI). Static checks are ripgrep-based npm scripts; dynamic checks are a manual DevTools session.
- A multi-locale routing layer. Single locale (Polish); no `/en/...` prefix, no language switcher. The `ui.ts`+`utils.ts` pair keeps the door open for a second locale without committing to URL routing.
- A custom ARIA / touch-target lint rule. `eslint-plugin-jsx-a11y` covers the basics; this plan does not add a rule on top.
- Real-user monitoring, `Server-Timing` headers, or any app-side perf instrumentation. Response time is recorded as a manual observation per cycle, not gated. RUM is deferred to a future change.
- Treating response time as a pass/fail gate. The PRD's 800 ms p95 NFR stays as the aspirational target; F-03 captures throttled timings each cycle in the "Latest run" subsection of the checklist (see Phase 3 §3 Section B), and the friends-only beta provides fast human feedback for obvious cliffs. Promoting it back to a gate is a one-paragraph edit when the audience grows.
- Translating admin-side surfaces or `admin/` Strapi UI. The PRD targets *climber-facing* UI in Polish (`prd.md:48,126`); admin curation is the project owner's job and runs in the Strapi Cloud admin.
- Broadening the audit / static-guard scope beyond climb-log + auth + route view. Other user-facing pages (`/dashboard`, `/regiony/[region]/index.astro`, `/`, `/404`) inherit the i18n scaffold but are not audited in this plan; widening the glob is a future task.
- A pre-deploy preview environment for the manual checklist. The checklist runs against local dev (and optionally any preview the implementer has handy).
- Updating `change.md` status to `archived` or moving the folder. That is `/10x-archive`'s job, run after the manual checklist passes.

## Implementation Approach

Three phases roughly in dependency order:

1. **Polish i18n foundation + audit.** Scaffold first because the static guard depends on it (the guard says "every user-facing string goes through `t()`"; without `t()` there's nothing to enforce against). Then translate the auth surface and relocate the already-Polish catalog strings into the dictionary.
2. **Progress-feedback primitives + convention.** Add `<Pending>` + `<Skeleton>` so the climb-log save UI (S-04) doesn't have to invent its own spinner, and add a static guard that enforces the convention.
3. **Beta-flow checklist + unified guardrails script.** Wire `npm run guardrails` (running both static checks together) into CI, write the manual checklist that captures the three NFR gates plus the response-time observation, and run the first cycle end-to-end against local dev.

## Critical Implementation Details

### i18n static guard pattern (single-locale flavor)

A general "no inline user-facing strings" lint rule is heavy (requires a custom ESLint rule or full i18n tooling). For one locale, a curated ripgrep regex of common UI words in JSX text positions and string attributes catches the realistic regression cases — someone hard-coding "Email" or "Save" or "Loading" in a new component. The guard is intentionally narrow (high-value catches, low false-positive noise), ships with a small inline allowlist (e.g. `you@example.com`, brand names), and supports an opt-out comment (`// i18n-allow`) for the rare intentional exception (third-party attribution strings, etc.). It will miss novel English phrasings; that gap is closed by the manual Polish walkthrough in the Phase 3 checklist.

### Throttling profile is shared across the mobile and progress-feedback gates plus the response-time observation

The manual checklist's mobile, progress-feedback, and response-time sections all run in the *same* DevTools session: viewport sweep (375×667, 390×844, 412×915) + Network "Slow 4G" + Performance 4× CPU throttle. They share a profile because they're testing the same condition — "the climber at the crag" — from three angles. The checklist must call this out so the response-time observation isn't accidentally recorded on a desktop fiber connection (which would make the cycle-over-cycle data useless even though it's not a gate).

### "Pages in scope" decision is structural, not exhaustive

The user's chosen scope is *climb-log + auth + route view* — the three pages an actual beta climb crosses. That scope drives both the audit and the static-guard globs. Other user-facing pages (homepage, region-list, dashboard, 404) are intentionally excluded from this plan to keep the foundation lightweight; they still inherit the i18n scaffold and can opt into the static guard later by expanding the glob in one place. The plan should make the glob list a single named constant so a future widening is one line of code.

---

## Phase 1: Polish i18n Foundation + Audit

### Overview

Set up the single-locale i18n scaffold per the official Astro recipe, replace inline English strings on the auth surface with `t()` calls, relocate the already-Polish catalog strings into the dictionary, and add a CI-runnable static check that catches new inline literals.

### Changes Required:

#### 1. i18n scaffold (single-locale Polish)

**Files**: `src/i18n/ui.ts`, `src/i18n/utils.ts`, `src/i18n/index.ts`, `src/i18n/__tests__/README.md`

**Intent**: Centralize all in-scope user-facing strings in one dictionary so the static guard has a single source of truth and a future second locale can be added without touching the component layer.

**Contract**: `ui.ts` exports `defaultLang = "pl" as const` and `ui = { pl: {...} } as const` with namespaced keys (`auth.*`, `catalog.*`, `common.*`, `errors.*`, `nav.*`). `utils.ts` exports `useTranslations(lang?: keyof typeof ui)` returning a `t(key)` function whose key type is `keyof typeof ui.pl` — full TypeScript autocomplete and compile-time typo detection. For one locale, the implementation is a one-line lookup (`(key) => ui[lang ?? defaultLang][key]`); no fallback chain needed beyond the one in the recipe. `index.ts` re-exports the public surface (`useTranslations`, `defaultLang`, type alias for keys). Module follows the repo's `index.ts` + `__tests__/` convention from `context/AGENTS.md`. No `astro.config.mjs` change in this phase — the routing layer is unnecessary for one locale. Cite the source recipe in a top-of-file comment.

#### 2. Audit and translate the auth surface

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/check-email.astro`, `src/pages/auth/confirm-email.astro`, `src/components/auth/MagicLinkForm.tsx`, `src/lib/auth/types.ts`

**Intent**: Every English literal that an authenticated or unauthenticated visitor sees on an auth surface is replaced by a `t()` call backed by a Polish translation in `ui.pl`. This is the substantive translation work in the plan.

**Contract**: For each file, every JSX text node, `placeholder=`, `aria-label=`, `title=`, `alt=`, and string prop value containing visible English becomes `t("auth.<descriptive_key>")` (or the appropriate namespace). The auth page titles (`title="Sign in"` etc.) become `t("auth.signin.page_title")`. The `AUTH_ERROR_MESSAGES` map in `src/lib/auth/types.ts` keeps its `Record<AuthErrorCode, string>` shape but each value becomes a Polish translation; if the existing English message phrasing matters for any caller, change call sites to look up via `useTranslations` instead. The `MagicLinkForm`'s `pendingText` and `children` props are populated from `t()` at the call site (the form is a React island and can call `useTranslations` directly). Placeholder values that are intentionally locale-neutral (`"you@example.com"`, `"SendLog"`) stay as literals; document them in the allowlist created in #4.

#### 3. Relocate already-Polish catalog strings

**Files**: `src/pages/regiony/[region]/[crag].astro`, `src/components/catalog/CragMap.tsx`, `src/components/catalog/CragMapSection.astro`, `src/components/catalog/RoutesTable.astro`, `src/components/catalog/CragPhotos.astro`, `src/components/catalog/CatalogErrorAlert.astro`, `src/components/catalog/CragMapFallbackList.astro`, `src/components/catalog/CatalogHeader.astro`, `src/components/catalog/CatalogFooter.astro`, `src/layouts/Layout.astro`, `src/layouts/CatalogLayout.astro`, `src/components/Banner.astro`, `src/lib/config-status.ts`

**Intent**: Pull existing Polish copy into the `ui.pl` dictionary so the static guard's "no inline strings in user-facing files" rule passes uniformly. No user-visible change.

**Contract**: Same mechanical replacement pattern as #2 — JSX text + string attributes + string prop values become `t("catalog.<key>")` / `t("common.<key>")` / `t("errors.<key>")`. Pluralization helpers like `pluralizeCrags` in `src/components/catalog/CragMapSection.astro:7-11` stay as JS functions but pull each branch's text from `t()`. The OSM tile attribution in `src/components/catalog/CragMap.tsx:98` is a third-party legal-required string and stays as a literal; mark it with the allowlist mechanism from #4. The page `<title>` in `Layout.astro` becomes `t("common.app_title")` with the existing Polish default `"SendLog — katalog polskich rejonów wspinaczkowych"`.

#### 4. Static i18n lint guard

**Files**: `scripts/check-i18n.mjs`, `package.json` (script entry only)

**Intent**: Catch new inline user-facing English literals before they merge, without taking on a custom ESLint rule.

**Contract**: A small Node script that ripgreps a curated set of file globs — defined as a single exported `IN_SCOPE_GLOBS` constant inside the script so future widening is one line — for two pattern families: (a) JSX/Astro text content containing curated English words from a `KNOWN_ENGLISH_WORDS` list (start with: `Email`, `Password`, `Sign in`, `Sign up`, `Sign out`, `Save`, `Cancel`, `Continue`, `Submit`, `Search`, `Filter`, `Settings`, `Profile`, `Welcome`, `Error`, `Required`, `Optional`, `Loading`, `Sending`, `Check your email`); (b) string attribute values matching the same patterns in `placeholder=`, `aria-label=`, `title=`, `alt=`, and `pendingText=`. Initial in-scope globs reflect the chosen scope: `src/components/auth/**/*.{astro,tsx,ts}`, `src/pages/auth/**/*.astro`, `src/pages/regiony/[region]/[crag].astro`, `src/components/catalog/**/*.{astro,tsx,ts}`, `src/layouts/**/*.astro`, `src/lib/auth/**/*.ts`, `src/lib/config-status.ts`, plus a forward-compat slot for `src/components/climbs/**` and `src/pages/climbs/**` that does not fail if the path doesn't exist yet. The script ignores any line containing `t("` or `t('` or the explicit opt-out comment `// i18n-allow` (and its Astro/HTML variant `<!-- i18n-allow -->`); and ignores entries in an inline `ALLOWED_LITERALS` array (start with: `you@example.com`, `SendLog`, `Supabase`, `Astro`, `Cloudflare`, `OpenStreetMap`). Exit non-zero on any hit, printing each violation as `<file>:<line>: <matched literal>`. Add `"guardrails:i18n": "node scripts/check-i18n.mjs"` to `package.json` `scripts`.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- New script reports zero violations on the post-audit tree: `npm run guardrails:i18n`
- `rg "Email is required|Enter a valid email|Sending link|Send sign-in link|Sign in to SendLog|Check your email" src/components/auth src/pages/auth` returns no matches (proves the auth audit removed the known English strings).

#### Manual Verification:

- Loading `/auth/signin` in a browser shows fully Polish copy (page title, h1, intro paragraph, form label, placeholder hint, button label, validation error text).
- Loading `/auth/check-email`, `/auth/signup`, `/auth/confirm-email`, and `/regiony/sokoliki/<a-real-crag-slug>` shows no visible English fallbacks.
- Triggering a server-side auth error (e.g. submitting `/api/auth/magic-link` with an empty body in DevTools) renders the resulting Polish error message on `/auth/signin?error=invalid_email`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Progress Feedback Primitives + Static Guard

### Overview

Add the two shared primitives the >2-second actions will use and the static guard that enforces them on in-scope action files. Generalizes the spinner pattern that's currently inlined in `SubmitButton` without replacing `SubmitButton` itself.

### Changes Required:

#### 1. `<Pending>` primitive

**File**: `src/components/ui/Pending.tsx`

**Intent**: A reusable inline spinner with optional label for non-form-submit pending UI — deferred fetch, route loading state, optimistic update in flight.

**Contract**: Default-export a React component. Props: `{ label?: string; size?: "sm" | "md"; className?: string }`. Default `size="md"`. Renders an animated SVG/CSS spinner visually identical to the one in `src/components/auth/SubmitButton.tsx:22` (border-based, `animate-spin`) so the visual language is consistent across form and non-form contexts. When `label` is provided, render it next to the spinner in a `<span>` with `role="status"` and `aria-live="polite"` so screen readers announce state changes. When `label` is omitted, the wrapper still has `role="status"` and a visually-hidden default label resolved via `useTranslations` (`t("common.loading")`) so accessibility holds without forcing a label on every caller. Uses `cn()` from `@/lib/utils` for class composition.

#### 2. `<Skeleton>` primitive

**File**: `src/components/ui/Skeleton.tsx`

**Intent**: A block placeholder that matches expected content shape during initial loads (history list, projects list, route table fallback).

**Contract**: Default-export a React component (also usable inside Astro via `client:load` if the consumer needs it; pure SSR Astro consumers can render the same markup statically). Props: `{ rows?: number; rowClassName?: string; className?: string }`. Default `rows=3`. Renders `rows` block elements with `animate-pulse` and a neutral background matching the catalog palette (`bg-slate-200`). Wrapping element has `role="status"` and `aria-label` resolved via `useTranslations` (`t("common.loading")`). Uses `cn()`.

#### 3. >2s actions convention doc

**File**: `docs/verification/progress-feedback-actions.md`

**Intent**: Single source of truth for which user-initiated actions are designated as ">2s" and which primitive each one uses. The static guard (#4) consumes this list; the manual checklist (Phase 3) walks through it.

**Contract**: A short markdown table with columns `Action | File(s) | Primitive | Rationale | Status`. Initial rows: (1) **Magic-link request** — `src/components/auth/MagicLinkForm.tsx` — `SubmitButton` (inherits its spinner) — Rationale: form submit lifecycle may exceed 2s on cellular — Status: `shipped`. (2) **Climb-log save** — `src/components/climbs/ClimbLogForm.tsx` (planned by S-04) — `SubmitButton` — Rationale: form submit, same pattern — Status: `planned: S-04`. (3) **Personal history initial load** — `src/pages/historia.astro` (planned by S-04) — `Skeleton` for the history-list rows — Rationale: server-fetched data may exceed 2s on cellular — Status: `planned: S-04`. (4) **Projects list initial load** — `src/pages/projekty.astro` (planned by S-06) — `Skeleton` — Status: `planned: S-06`. Rows with `Status: shipped` are checked by the static guard. Rows with `Status: planned: *` are skipped while the file doesn't exist and start being checked the moment it lands.

#### 4. Static progress-primitive guard

**Files**: `scripts/check-progress.mjs`, `package.json` (script entry only)

**Intent**: Catch the case where a new action file in scope ships without using one of the agreed primitives.

**Contract**: Node script that reads `docs/verification/progress-feedback-actions.md`. For each row, parse the file path and the primitive name. For rows whose file exists, assert the file imports the named primitive (either `Pending`, `Skeleton`, or `SubmitButton`) via a ripgrep import-pattern check (e.g. `from "@/components/ui/Pending"` or the `SubmitButton` import line). For rows whose file does not exist, skip silently. Exit non-zero on any in-scope shipped row that fails the import check; print `<file>: missing import of <primitive>` per violation. Parsing the table is tolerable from a small regex; if the markdown table parsing becomes brittle, the implementer may add a sibling JSON companion (`docs/verification/progress-feedback-actions.json`) and keep the markdown as docs only. Add `"guardrails:progress": "node scripts/check-progress.mjs"` to `package.json`.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `npm run guardrails:progress` exits zero against the current file set (only the magic-link row's file is `shipped`; it imports `SubmitButton`).
- `rg "role=\"status\"" src/components/ui/Pending.tsx src/components/ui/Skeleton.tsx` returns at least one match in each file (a11y signal preserved).

#### Manual Verification:

- Importing `<Pending label="..." />` into a throwaway scratch page renders a spinner with the label visible next to it.
- Importing `<Skeleton rows={5} />` renders five pulsing placeholder rows that visually match the catalog palette.
- Chrome DevTools accessibility tree (or VoiceOver) announces the loading state (Polish translation) when `<Pending>` mounts.
- Submitting the magic-link form on a throttled connection (DevTools "Slow 4G") shows the existing `SubmitButton` spinner within ~300 ms of click and remains visible until the redirect to `/auth/check-email`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Beta-Flow Verification Checklist + Unified Guardrails Script

### Overview

Stitch Phases 1 and 2 into one CI hook and write the manual pre-beta checklist that future climber-facing flows — starting with S-04 — will run. This is the artifact F-03 hands to its downstream consumers.

### Changes Required:

#### 1. Unified `guardrails` npm script

**File**: `package.json`

**Intent**: One command runs all static guardrails so CI can invoke them together and a developer can pre-flight before pushing.

**Contract**: Add `"guardrails": "npm run guardrails:i18n && npm run guardrails:progress"` to `scripts`. Keep the individual `guardrails:i18n` and `guardrails:progress` entries so they can be run in isolation during incremental work. No change to other scripts.

#### 2. CI integration

**File**: `.github/workflows/ci.yml`

**Intent**: Make guardrails a hard build gate so they can't drift quietly between PRs.

**Contract**: In the `ci` job, add a `- run: npm run guardrails` step *after* `npm run lint` and *before* `npm run build`. The `deploy` job is unchanged. Per `AGENTS.md`, the canonical CI step order becomes `npm ci` → `npx astro sync` → `npm run lint` → `npm run guardrails` → `npm run build`. Update the matching `AGENTS.md` sentence in #4 to reflect the new step.

#### 3. Beta-flow manual verification checklist

**File**: `docs/verification/beta-flow-checklist.md`

**Intent**: A single committed document that any climber-facing flow (S-04, S-05, S-06, future) runs against before beta release. This is the substantive deliverable of Phase 3.

**Contract**: Markdown document with the following structure.

- **Header**: name, purpose, when to run (before any beta-flow release), what to fill in (the Latest run subsection at the bottom).
- **Pages in scope**: explicit list — `/auth/signin`, `/auth/signup`, `/auth/check-email`, `/auth/confirm-email`, `/regiony/sokoliki/<crag>` (route view) — plus placeholder paths for climb-log save and personal history once S-04 lands. Each row notes "current" or "planned: S-04" so the runner skips unimplemented rows cleanly.
- **Section A — Polish UI walkthrough**: tester loads each in-scope page; confirms every visible string is Polish (page title, headings, body copy, form labels, button labels, validation errors, server errors). One checkbox per page. Header note: `npm run guardrails:i18n` is the static half; this section catches the visual cases the regex doesn't cover.
- **Section B — Throttled walkthrough (mobile gate + progress-feedback gate + response-time observation)**: a single DevTools session. Steps: (1) open DevTools → Device toolbar → set to iPhone SE (375×667); (2) Network panel → "Slow 4G"; (3) Performance panel → CPU throttle "4× slowdown"; (4) reload each in-scope page and visit it; (5) for each page, **gate**: assert no horizontal scroll, all interactive controls reachable, tap targets visually adequate; **observation**: record First Contentful Paint and a stable proxy for time-to-meaningful-interaction (e.g. "route table visible" on the crag page, "form visible" on signin); (6) repeat the page sweep at 390×844 (iPhone 14) and 412×915 (Pixel 7) without re-recording timings (the observation only needs one viewport); (7) for each `shipped` row in `docs/verification/progress-feedback-actions.md`, trigger the action and visually confirm the primitive (Pending / Skeleton / SubmitButton spinner) appears within ~300 ms and stays until completion. **Response-time observation**: record the median of 3 timed runs on the smallest viewport in the "Latest run" subsection — no pass/fail threshold. The checklist explicitly explains the demotion: the PRD's 800 ms p95 NFR is the aspirational target; F-03 captures observational data so cycle-over-cycle trends are visible while the friends-only beta provides fast human feedback for obvious cliffs. Promoting it back to a gate is a one-paragraph edit when the audience grows. Each `(page × viewport)` mobile-gate cell and each progress-feedback action gets one checkbox; the timing row is recorded as free-form notes, not checkboxes.
- **Section C — Run log**: a "Latest run" subsection with fields for date, app commit SHA, results per section (pass / pass-with-notes / fail), free-form notes, and a "next steps" line. The implementer fills this in at the end of each cycle. Earlier runs get archived above the latest one by demoting them with a small header (the implementer doesn't need to maintain every old run — keep the last 2-3, prune the rest).
- **Cross-references**: top of doc links to `docs/verification/progress-feedback-actions.md`, `context/foundation/prd.md` NFR section, and `npm run guardrails`. Footer reiterates that this doc + the CI script together are the verification harness; neither alone is sufficient.

The checklist explicitly calls out: (a) it runs against local dev (`npm run dev -- --host 127.0.0.1 --port 3000`, consistent with the passwordless-auth plan's Supabase smoke setup) unless a preview env is available; (b) it is not exhaustive — the goal is "the primary flow isn't judged by 'it works on my machine'", not full QA; (c) climb-log and history rows are skipped in the first cycle and become live once S-04 lands.

#### 4. `AGENTS.md` cross-reference

**File**: `AGENTS.md` (root)

**Intent**: Make the guardrails discoverable so the next contributor doesn't have to find F-03 in the roadmap to learn about them.

**Contract**: Add to the "Build, Test, and Development Commands" section: `- npm run guardrails — static checks for i18n coverage and >2s progress-feedback primitives (CI runs this between lint and build). See docs/verification/beta-flow-checklist.md for the matching manual checklist.` Update the CI flow sentence in the "Commit & Pull Request Guidelines" section from `npm ci → npx astro sync → npm run lint → npm run build` to `npm ci → npx astro sync → npm run lint → npm run guardrails → npm run build`. No other policy changes; do not add a new Tripwires bullet — the static gate plus the docs reference are enough.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- `npm run guardrails` exits zero (runs both `guardrails:i18n` and `guardrails:progress` in sequence).
- `.github/workflows/ci.yml` contains `npm run guardrails` between `npm run lint` and `npm run build`: `rg "npm run guardrails" .github/workflows/ci.yml` returns the new step in the `ci` job.
- `docs/verification/beta-flow-checklist.md` exists and references all three viewport sizes (`375×667`, `390×844`, `412×915`), the throttling profile keywords (`Slow 4G`, `4×`), the in-scope pages (signin, check-email, route view), and `docs/verification/progress-feedback-actions.md`.
- `AGENTS.md` mentions `npm run guardrails` and links to `docs/verification/beta-flow-checklist.md`: `rg "npm run guardrails|beta-flow-checklist" AGENTS.md` returns hits.

#### Manual Verification:

- A first end-to-end run of `docs/verification/beta-flow-checklist.md` against local dev passes all gate sections for the currently-shipped pages (auth + route view); climb-log/history rows are recorded as `planned: S-04` and skipped. The "Latest run" subsection is filled in with date, commit, gate results, and the response-time observation.
- Response-time observation on the route-view page (`/regiony/sokoliki/<crag>`) on iPhone-SE + Slow 4G + 4× CPU is recorded in "Latest run" as the median of 3 timed runs, with no pass/fail check (the data is for trend visibility, not gating beta release).
- A simulated regression — temporarily hard-code `"Loading..."` into a new component file under `src/components/auth/` — causes `npm run guardrails` to fail locally, proving the static i18n gate works end-to-end.
- A simulated regression — temporarily change a `shipped` row in `docs/verification/progress-feedback-actions.md` to point at a file that does not import its named primitive — causes `npm run guardrails:progress` to fail, proving the progress gate works.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering F-03 complete. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

No test runner is configured. Future coverage notes belong in `src/i18n/__tests__/README.md` (key lookup, missing-key behavior, single-locale invariant) and `src/components/ui/__tests__/README.md` (Pending/Skeleton render, a11y attributes, default-label resolution).

### Integration Tests

The static guardrails (`npm run guardrails:i18n`, `npm run guardrails:progress`) are the structural integration gate, run on every CI build. The manual checklist (`docs/verification/beta-flow-checklist.md`) is the behavioral integration gate, run once per beta-readiness cycle against local dev or any available preview.

### Manual Testing Steps

See `docs/verification/beta-flow-checklist.md` after Phase 3 lands. Summary:

1. Run `npm run guardrails` locally; expect green.
2. Start local dev: `npm run dev -- --host 127.0.0.1 --port 3000`.
3. Open Chrome DevTools; sweep each in-scope page at three viewport sizes confirming Polish copy and no horizontal scroll.
4. Switch to "Slow 4G" + 4× CPU throttle; record median of 3 timed runs per in-scope page as an observation (no pass/fail).
5. Trigger every `shipped` row in `docs/verification/progress-feedback-actions.md`; visually confirm the primitive appears.
6. Fill in the "Latest run" subsection of `docs/verification/beta-flow-checklist.md` and commit.

## Performance Considerations

- The i18n helper resolves at runtime via a flat object lookup — O(1) per key, no meaningful overhead.
- The static guardrail scripts run only on CI and on developer demand; zero app-runtime cost.
- `<Pending>` and `<Skeleton>` use CSS-only animations (`animate-spin`, `animate-pulse`), no JavaScript work on the main thread.
- The manual checklist itself adds operational time (estimated 15-30 min per cycle) but the foundation is explicitly time-boxed to lightweight: faster manual cycles + static CI gates beat heavyweight automated infra for this MVP.

## Migration Notes

No data migration. No Supabase schema change. Rollback is a code revert plus removing the new CI step in `.github/workflows/ci.yml`. If the i18n static guard becomes too noisy in CI mid-implementation, the script can be temporarily flipped to warn-mode (exit 0 + print) by changing the exit-code line — preserving diagnostic value while unblocking merges; the right long-term fix is widening the allowlist or tightening the regex, not silencing the script.

## References

- Roadmap F-03: `context/foundation/roadmap.md:90-101`
- PRD NFR section (the four guardrails): `context/foundation/prd.md:122-126`
- Official Astro i18n recipe (cited in `src/i18n/utils.ts` header): https://docs.astro.build/en/recipes/i18n/
- Existing spinner pattern to mirror in `<Pending>`: `src/components/auth/SubmitButton.tsx:11-32`
- Existing mobile-viewport precedent: `context/archive/2026-06-01-passwordless-auth-flow/plan.md:213` (the `375x667` check)
- Existing Polish copy convention to extract: `src/lib/config-status.ts:15,22`, `src/components/catalog/CragMapSection.astro:7-11`
- Layout `lang="pl"` declaration: `src/layouts/Layout.astro:14`
- CI workflow to extend: `.github/workflows/ci.yml:20-21`
- AGENTS.md CI flow sentence to update: root `AGENTS.md` "Commit & Pull Request Guidelines" section
- Change identity: `context/changes/core-flow-verification-guardrails/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Polish i18n Foundation + Audit

#### Automated

- [x] 1.1 Astro types regenerate: `npx astro sync` — dd5c3d9
- [x] 1.2 Lint passes: `npm run lint` — dd5c3d9
- [x] 1.3 Production build passes: `npm run build` — dd5c3d9
- [x] 1.4 New script reports zero violations on the post-audit tree: `npm run guardrails:i18n` — dd5c3d9
- [x] 1.5 `rg "Email is required|Enter a valid email|Sending link|Send sign-in link|Sign in to SendLog|Check your email" src/components/auth src/pages/auth` returns no matches. — dd5c3d9

#### Manual

- [x] 1.6 Loading `/auth/signin` in a browser shows fully Polish copy (page title, h1, intro paragraph, form label, placeholder hint, button label, validation error text). — dd5c3d9
- [x] 1.7 Loading `/auth/check-email`, `/auth/signup`, `/auth/confirm-email`, and `/regiony/sokoliki/<a-real-crag-slug>` shows no visible English fallbacks. — dd5c3d9
- [x] 1.8 Triggering a server-side auth error renders the resulting Polish error message on `/auth/signin?error=invalid_email`. — dd5c3d9

### Phase 2: Progress Feedback Primitives + Static Guard

#### Automated

- [x] 2.1 Astro types regenerate: `npx astro sync`
- [x] 2.2 Lint passes: `npm run lint`
- [x] 2.3 Production build passes: `npm run build`
- [x] 2.4 `npm run guardrails:progress` exits zero against the current file set.
- [x] 2.5 `rg "role=\"status\"" src/components/ui/Pending.tsx src/components/ui/Skeleton.tsx` returns at least one match in each file.

#### Manual

- [x] 2.6 Importing `<Pending label="..." />` into a throwaway scratch page renders a spinner with the label visible.
- [x] 2.7 Importing `<Skeleton rows={5} />` renders five pulsing placeholder rows that match the catalog palette.
- [x] 2.8 Chrome DevTools accessibility tree (or VoiceOver) announces the loading state in Polish when `<Pending>` mounts.
- [x] 2.9 Submitting the magic-link form on Slow 4G shows the existing `SubmitButton` spinner within ~300 ms of click and remains visible until the redirect.

### Phase 3: Beta-Flow Verification Checklist + Unified Guardrails Script

#### Automated

- [ ] 3.1 Astro types regenerate: `npx astro sync`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Production build passes: `npm run build`
- [ ] 3.4 `npm run guardrails` exits zero (runs both `guardrails:i18n` and `guardrails:progress`).
- [ ] 3.5 `.github/workflows/ci.yml` contains `npm run guardrails` between `npm run lint` and `npm run build`.
- [ ] 3.6 `docs/verification/beta-flow-checklist.md` exists and references all three viewport sizes, the throttling profile keywords, the in-scope pages, and `docs/verification/progress-feedback-actions.md`.
- [ ] 3.7 `AGENTS.md` mentions `npm run guardrails` and links to `docs/verification/beta-flow-checklist.md`.

#### Manual

- [ ] 3.8 First end-to-end run of `docs/verification/beta-flow-checklist.md` passes all gate sections for currently-shipped pages; planned rows skipped; Latest run subsection filled in with gate results and response-time observation.
- [ ] 3.9 Response-time observation on `/regiony/sokoliki/<crag>` on iPhone-SE + Slow 4G + 4× CPU is recorded in "Latest run" as the median of 3 timed runs (no pass/fail).
- [ ] 3.10 Simulated regression (inline English literal in a new component) causes `npm run guardrails` to fail locally.
- [ ] 3.11 Simulated regression (shipped row pointing at a file without the named primitive import) causes `npm run guardrails:progress` to fail.

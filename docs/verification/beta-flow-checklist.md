# Beta-flow verification checklist

The manual half of the F-03 verification harness. Walks through every
climber-facing flow against the three NFR gates (Polish UI, mobile usability,
progress feedback) and captures a response-time observation per cycle.

> Together with `npm run guardrails`, this checklist is the verification
> harness. Neither alone is sufficient — the script catches structural
> regressions on every PR; this document catches the visual and behavioral
> regressions a regex cannot see.

## Purpose

A single committed document that any climber-facing flow (S-04, S-05, S-06,
and every future slice) runs against before beta release. The goal is _not_
exhaustive QA — it is "the primary flow isn't judged by 'it works on my
machine.'"

## When to run

Once per pre-beta cycle: before any slice ships to the friends-only beta
audience, before merging the slice's epilogue commit, and any time the
in-scope page list grows. The Section C "Latest run" subsection captures
the result.

## What to fill in

The **Section C — Latest run** subsection at the bottom. Everything else is
read-only between cycles.

## Cross-references

- Companion docs: `docs/verification/progress-feedback-actions.md`
  (the action ↔ primitive registry consumed by the static guard).
- Aspirational NFRs: `context/foundation/prd.md` §NFR (Polish-primary UI,
  mobile-first, ≥2-second progress feedback, 800 ms p95 cellular).
- Static half: `npm run guardrails` (runs `guardrails:i18n` +
  `guardrails:progress`; CI runs it between `npm run lint` and
  `npm run build`).

## How to run

1. Boot local dev: `npm run dev -- --host 127.0.0.1 --port 3000` (matches the
   passwordless-auth plan's Supabase smoke-test setup). A preview environment
   is acceptable if available, but local dev is the default.
2. Run `npm run guardrails` once before starting; expect green. Any
   violations here block the manual walkthrough.
3. Work through Section A, then Section B in a single throttled DevTools
   session, then fill in Section C.

Estimated time per cycle: 15–30 minutes.

## Pages in scope

| Page                                         | Path                                       | Status         |
| -------------------------------------------- | ------------------------------------------ | -------------- |
| Magic-link sign-in                           | `/auth/signin`                             | current        |
| Sign-up (magic-link bootstrap)               | `/auth/signup`                             | current        |
| Post-submit confirmation                     | `/auth/check-email`                        | current        |
| Email-confirmation landing                   | `/auth/confirm-email`                      | current        |
| Crag route view + inline climb-log save      | `/regiony/sokoliki/<crag-slug>`            | current        |
| Personal climb history                       | `/historia`                                | current        |
| Projects list                                | `/projekty`                                | planned: S-06  |

Rows marked `planned: <slice>` are skipped in the current cycle and become
live the moment the slice lands. Use `pass-with-notes` in Section C if a
planned row's owning slice was expected to land this cycle but slipped.

---

## Section A — Polish UI walkthrough

> Static half: `npm run guardrails:i18n` enforces the known-English-word
> regex against in-scope files. This section catches the visual cases the
> regex cannot — novel phrasings, missing translations on server-rendered
> error pages, accidentally-untranslated `<title>` tags.

Load each `current` page in a browser (any viewport is fine for this
section — Section B handles mobile). Confirm every visible string is Polish:
page `<title>`, headings, body copy, form labels, placeholder text, button
labels, validation errors, server errors.

For server-error coverage on the auth surface, trigger at least one error
deliberately (e.g. POST `/api/auth/magic-link` with an empty body in the
DevTools console) and confirm the resulting Polish message on the redirected
`/auth/signin?error=…`.

- [ ] `/auth/signin` — fully Polish (page title, h1, intro, form label,
      placeholder, button label, validation error)
- [ ] `/auth/signup` — fully Polish (no visible English fallback)
- [ ] `/auth/check-email` — fully Polish
- [ ] `/auth/confirm-email` — fully Polish (both success and error states)
- [ ] `/regiony/sokoliki/<crag-slug>` — fully Polish (header, route table,
      coordinates label, map fallback list, photo grid alt text, footer,
      signed-out sign-in CTA, signed-in inline climb-log form labels,
      pending text, success message, validation/error messages, row count
      and latest-date indicator)
- [ ] `/historia` — fully Polish (page title, h1, lead, empty state, row
      labels, link-back fallback when crag context is missing, load-error
      diagnostic)
- [ ] At least one server-side auth error renders Polish on
      `/auth/signin?error=…`

---

## Section B — Throttled walkthrough (mobile gate + progress-feedback gate + response-time observation)

> All three checks share one DevTools session because they're testing the
> same condition ("the climber at the crag") from three angles. Do not split
> them across separate sessions — the response-time observation needs the
> throttled profile or the cycle-over-cycle data becomes useless.

### Setup (do this once per cycle)

1. Open Chrome DevTools (Cmd-Opt-I).
2. Toggle the device toolbar (Cmd-Shift-M).
3. Set the viewport to **iPhone SE (375×667)** as the starting size.
4. Network panel → throttling dropdown → **Slow 4G**.
5. Performance panel → CPU throttle → **4× slowdown**.
6. Confirm the throttle persists across reloads (Chrome resets the CPU
   throttle when DevTools closes; re-apply if needed).

### B1 — Mobile gate (per page × viewport)

For each `current` page, reload at each of the three target viewports
(**375×667**, **390×844**, **412×915**). For each `(page × viewport)` cell,
confirm:

- No horizontal scroll at any scroll position.
- All interactive controls (links, buttons, form fields) are reachable
  without horizontal scroll.
- Tap targets look visually adequate — no controls smaller than roughly
  the surrounding line-height; no overlapping hit areas. (Strict 44×44 px is
  not enforced; this is a visual sanity check.)
- The page renders meaningful content without overflowing its container.

| Page                                          | 375×667 | 390×844 | 412×915 |
| --------------------------------------------- | ------- | ------- | ------- |
| `/auth/signin`                                | [ ]     | [ ]     | [ ]     |
| `/auth/signup`                                | [ ]     | [ ]     | [ ]     |
| `/auth/check-email`                           | [ ]     | [ ]     | [ ]     |
| `/auth/confirm-email`                         | [ ]     | [ ]     | [ ]     |
| `/regiony/sokoliki/<crag-slug>` signed-out    | [ ]     | [ ]     | [ ]     |
| `/regiony/sokoliki/<crag-slug>` signed-in     | [ ]     | [ ]     | [ ]     |
| `/historia`                                   | [ ]     | [ ]     | [ ]     |

### B2 — Progress-feedback gate (per shipped action)

For each row in `docs/verification/progress-feedback-actions.md` whose
Status is `shipped`, trigger the action and visually confirm the named
primitive (`SubmitButton` spinner / `Pending` / `Skeleton`) appears within
~300 ms of the trigger and remains visible until completion (redirect,
content swap, or visible end-state).

- [ ] **Magic-link request** (`src/components/auth/MagicLinkForm.tsx` →
      `SubmitButton`) — submit `/auth/signin` form, spinner visible within
      ~300 ms, persists until redirect to `/auth/check-email`.
- [ ] **Climb-log save** (`src/components/climbs/ClimbLogForm.tsx` →
      `SubmitButton`) — on `/regiony/sokoliki/<crag-slug>` while signed in,
      expand a route's inline log form and submit. Pending text visible
      within ~300 ms, persists until the route-row success state +
      count/latest-date indicator updates.

Add one checkbox row per new `shipped` row added to the actions doc.

### B3 — Response-time observation (informational, not a gate)

> **Demoted to observation in F-03 by design.** The PRD's 800 ms p95
> cellular response-time NFR remains the aspirational target. F-03 captures
> throttled timings each cycle so trends are visible while the friends-only
> beta provides fast human feedback for obvious cliffs. Promoting it back to
> a gate is a one-paragraph edit when the audience grows beyond the known
> beta group.

On the **smallest** viewport (375×667), with **Slow 4G** + **4×** CPU still
applied, time three reloads each of the route-view page
(`/regiony/sokoliki/<crag-slug>`) and the personal history page
(`/historia`, signed in). Record:

- **First Contentful Paint** (DevTools Performance panel summary, or
  Lighthouse "Performance" run; the latter resets throttling — use
  whichever is convenient as long as the throttle profile matches).
- **Time-to-meaningful-interaction proxy**: pick a stable visual signal
  per page and record when it appears.
  - Crag route view: "route table fully visible."
  - Personal history: "first history row fully visible."
  - Sign-in page: "form fully visible and interactive."

Record the **median of 3 runs** per signal in Section C — no pass/fail
threshold.

---

## Section C — Run log

Keep the last 2–3 runs here. Older runs can be deleted; the latest run is
authoritative.

### Latest run

- **Date**: 2026-06-03
- **App commit SHA**: `8d762b3`
- **Branch / slice context**: `feature/S04-route-climb-log` / S-04 route climb log
- **Pages skipped this cycle (still `planned`)**: `/projekty` (S-06)
- **Section A result**: pass
- **Section B1 (mobile) result**: pass
- **Section B2 (progress feedback) result**: pass
- **Section B3 (response-time observation)**:
  - Crag route view FCP, 3-run median: observed during manual pass; exact median not reported.
  - Crag route view "route table visible", 3-run median: observed during manual pass; exact median not reported.
  - Personal history FCP, 3-run median: observed during manual pass; exact median not reported.
  - Personal history "first row visible", 3-run median: observed during manual pass; exact median not reported.
  - Sign-in "form visible", 3-run median: observed during manual pass; exact median not reported.
- **Notes**: S-04 route-log and history manual verification passed. Climb-log save progress feedback remained visible through the save result; route view and `/historia` passed the mobile viewport checks; newest-first history plus repeat-route count/latest-date behavior were verified with at least two logs on one route.
- **Next steps**: None blocking S-04 beta verification.

### Previous runs

_(Demote the previous "Latest run" block here at the start of each cycle.
Keep the last 2–3; prune older entries.)_

---

_This document plus `npm run guardrails` together are the F-03 verification
harness. Neither alone is sufficient. See
`context/changes/core-flow-verification-guardrails/plan.md` for the
foundation work that produced both halves._

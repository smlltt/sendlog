# Projects UI module — future test coverage

No automated test runner is currently configured in this repository (see
`AGENTS.md` → "No test runner is configured"). This directory exists to
satisfy the repo module-structure rule (`index.ts`, `types.ts`, `__tests__/`)
and to record the test surface that should be covered once a runner is added —
Vitest is the likely candidate given the Vite/Astro toolchain. See
`src/components/climbs/` and `src/lib/private-state/__tests__/README.md` for
the matching precedents.

End-to-end verification of the projects flow today is the manual checklist in
`docs/verification/beta-flow-checklist.md` plus the static guardrails
(`npm run guardrails`).

## Client-safe boundary (`types.ts`, islands)

- The DTOs in `types.ts` (`ProjectResponse`, `AddProjectResponse`,
  `DeleteProjectResponse`, `ProjectApiErrorBody`, `ProjectListItem`) are
  primitive mirrors of the server-only `@/lib/private-state` shapes. No island
  in this module imports `@/lib/private-state`; the only path back to Supabase
  is the JSON `/api/projects` endpoint. Enforced by
  `rg "from \"@/lib/private-state\"" src/components` staying empty.

## API contract round-trip (`ProjectAction`, `ProjectsListCard`)

- `POST /api/projects { routeId }` → `201 { project: { id, routeId, createdAt } }`;
  a second identical POST → `422 duplicate_project`.
- `DELETE /api/projects { id }` → `200 { deleted: { id } }`; repeating →
  `404 not_found`, which both islands treat as an idempotent "already gone".
- Both verbs return `401 unauthenticated` (JSON, not a redirect) when signed
  out — `/api/projects` is intentionally NOT in `PROTECTED_ROUTES`.

## Add-then-remove without refresh (`ProjectAction`)

- After a successful add, the island stores the returned `project.id` in local
  state so an immediate remove issues `DELETE { id }` without a server
  round-trip to resolve the id from the route id.

# E2E Testing Rules

- Model new specs on `seed.spec.ts`; it is the canonical Playwright exemplar for this project.
- Use `getByRole`, `getByLabel`, and `getByText` as primary locators. Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, DOM structure, fixed sleeps, or `page.waitForTimeout()`. Wait for application state with web-first assertions, URL assertions, or response waits.
- Each spec must be independently runnable: create its own data, use unique timestamped oracles, and clean up rows it creates.
- Use real passwordless auth through `signInViaMagicLink` or `createAuthenticatedContext`; do not mock Supabase sessions in browser-level specs.
- Keep internal boundaries real: auth, routing, API routes, middleware, and Supabase-backed private state. Mock only expensive or nondeterministic external services at the network layer.
- Name tests after the risk they protect, and make failure messages name the leaking user/action for isolation checks.
- For private-state rows, capture UUIDs from the app's POST responses with `waitForClimbCreated` or `waitForProjectCreated`; do not hardcode Strapi document IDs or read hidden DOM state.

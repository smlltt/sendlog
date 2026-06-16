import { type Page } from "@playwright/test";

/**
 * Private-state e2e helpers.
 *
 * Climb and project row UUIDs are never rendered in the visible DOM, and
 * hardcoding Strapi `routeId` document ids is brittle. Instead, capture the row
 * id from the mutation response the app already returns: `POST /api/climbs`
 * answers `201 { climb: { id } }` and `POST /api/projects` answers
 * `201 { project: { id } }` (see `src/pages/api/{climbs,projects}.ts`). Isolation
 * specs create data as user A through the real UI, capture the id here, then
 * have user B attack that id through the same endpoints.
 */

interface CreatedClimbResponse {
  climb?: { id?: string };
}

interface CreatedProjectResponse {
  project?: { id?: string };
}

/**
 * Wait for the next successful `POST /api/climbs` and return the created climb's
 * UUID. Start awaiting this BEFORE triggering the UI action that posts, so the
 * response is not missed.
 */
export async function waitForClimbCreated(page: Page): Promise<string> {
  const response = await page.waitForResponse(
    (res) => res.url().includes("/api/climbs") && res.request().method() === "POST" && res.status() === 201,
  );
  const body = (await response.json()) as CreatedClimbResponse;
  const id = body.climb?.id;
  if (!id) {
    throw new Error("expected POST /api/climbs to return { climb: { id } }");
  }
  return id;
}

/**
 * Wait for the next successful `POST /api/projects` and return the created
 * project's UUID. Start awaiting this BEFORE triggering the UI add toggle.
 */
export async function waitForProjectCreated(page: Page): Promise<string> {
  const response = await page.waitForResponse(
    (res) => res.url().includes("/api/projects") && res.request().method() === "POST" && res.status() === 201,
  );
  const body = (await response.json()) as CreatedProjectResponse;
  const id = body.project?.id;
  if (!id) {
    throw new Error("expected POST /api/projects to return { project: { id } }");
  }
  return id;
}

/**
 * Delete a climb row via `DELETE /api/climbs` using the page's session cookies.
 * Used for `afterAll` cleanup as the owning user so re-runs start clean. The
 * endpoint is idempotent (`not_found` collapses to "already gone"), so this is
 * safe to call even if a prior step already removed the row.
 */
export async function deleteClimbViaApi(page: Page, id: string): Promise<void> {
  await page.request.delete("/api/climbs", { data: { id } });
}

/** Delete a project row via `DELETE /api/projects` (idempotent, owner session). */
export async function deleteProjectViaApi(page: Page, id: string): Promise<void> {
  await page.request.delete("/api/projects", { data: { id } });
}
